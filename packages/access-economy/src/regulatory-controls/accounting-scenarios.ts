/**
 * ACCESS Wave 5 — Accounting scenario runners (Mustang full/partial refund).
 *
 * Verifies financial ledger consistency without posting to canonical ledger.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  createAccessSolvencyService,
  type AccessSolvencyService,
} from '../funding-solvency/index.ts';
import {
  AccessAccountingEventStore,
  refundAccountingEventSequence,
  settlementAccountingEventSequence,
} from './accounting-events.ts';
import { proportionalRefundSplit } from './consumer-protection.ts';
import { assertTokenConversionContributionZero } from './economic-classification.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-01T00:00:00.000Z');

export type MustangAccountingResult = {
  readonly transactionId: string;
  readonly providerTotal: bigint;
  readonly accessCoverage: bigint;
  readonly userContribution: bigint;
  readonly tokenContribution: bigint;
  readonly providerSettlement: bigint;
  readonly accountingEvents: readonly import('./types.ts').AccessAccountingEvent[];
  readonly fundingBalanceAfter: bigint;
  readonly reconciled: boolean;
};

export type PartialRefundAccountingResult = {
  readonly transactionId: string;
  readonly originalAccessCoverage: bigint;
  readonly originalUserContribution: bigint;
  readonly providerRefund: bigint;
  readonly accessFundingRestored: bigint;
  readonly userRefund: bigint;
  readonly accountingEvents: readonly import('./types.ts').AccessAccountingEvent[];
  readonly reconciled: boolean;
};

function seedPool(service: AccessSolvencyService, amount: bigint): string {
  const poolRegistry = service.getPoolRegistry();
  const fundingLedger = service.getFundingLedger();
  const pool = poolRegistry.createPool({
    name: 'Mustang MOBILITY Pool',
    category: 'MOBILITY',
    currency: 'USD',
    categoryPolicy: 'STRICT_CATEGORY',
    now: NOW,
  });
  const source = poolRegistry.addSource({
    fundingPoolId: pool.fundingPoolId,
    sourceType: 'TREASURY',
    currency: 'USD',
    amountCommitted: amount,
    amountReceived: amount,
    effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
    evidenceReference: 'evidence:mustang-treasury',
  });
  fundingLedger.recordFundingReceived({
    fundingPoolId: pool.fundingPoolId,
    sourceId: source.sourceId,
    currency: 'USD',
    amountMinorUnits: amount,
    transactionReference: 'mustang:seed',
    evidenceReference: 'evidence:mustang-treasury',
    createdAt: NOW,
    idempotencyKey: `fund:mustang:${pool.fundingPoolId}`,
  });
  return pool.fundingPoolId;
}

export async function runMustangFullRefundScenario(): Promise<{
  readonly purchase: MustangAccountingResult;
  readonly fullRefund: MustangAccountingResult;
}> {
  const service = createAccessSolvencyService();
  const eventStore = new AccessAccountingEventStore();
  const poolId = seedPool(service, 500_00n);

  const providerTotal = 400_00n;
  const accessCoverage = 300_00n;
  const userContribution = 100_00n;
  const tokenContribution = 0n;
  assertTokenConversionContributionZero(tokenContribution);

  if (accessCoverage + userContribution !== providerTotal) {
    throw new Error('Mustang scenario price components must reconcile');
  }

  const transactionId = 'txn_mustang_miami_001';

  const reserve = await service.reserveFunding({
    fundingPoolId: poolId,
    accessTransactionId: transactionId,
    userId: 'user:mustang',
    currency: 'USD',
    amountMinorUnits: accessCoverage,
    category: 'MOBILITY',
    expiresAt: EXPIRES,
    evidenceReference: 'evidence:mustang-reserve',
    idempotencyKey: 'mustang:reserve',
    now: NOW,
  });
  if (!reserve.ok) {
    throw new Error(`funding reservation failed: ${reserve.code}`);
  }

  const settlementEvents = settlementAccountingEventSequence({
    accessTransactionId: transactionId,
    fundingPoolId: poolId,
    currency: 'USD',
    accessPoolContribution: accessCoverage,
    userCopay: userContribution,
    providerAmount: providerTotal,
    tokenConversionContribution: tokenContribution,
    canonicalAuthorizeRef: 'money:auth:mustang',
    canonicalCaptureRef: 'money:capture:mustang',
    evidenceReference: 'evidence:mustang-settlement',
    createdAt: NOW,
  });
  for (const event of settlementEvents) {
    eventStore.append(event);
  }

  service.getFundingLedger().captureSettlement({
    fundingPoolId: poolId,
    currency: 'USD',
    amountMinorUnits: accessCoverage,
    transactionReference: transactionId,
    reservationReference: reserve.reservation.fundingReservationId,
    evidenceReference: 'evidence:mustang-capture',
    createdAt: NOW,
    idempotencyKey: 'mustang:capture',
  });

  const balanceAfterPurchase = service.getFundingPoolBalance(poolId, 'USD', NOW);
  const purchase: MustangAccountingResult = Object.freeze({
    transactionId,
    providerTotal,
    accessCoverage,
    userContribution,
    tokenContribution,
    providerSettlement: providerTotal,
    accountingEvents: eventStore.listByTransaction(transactionId),
    fundingBalanceAfter: balanceAfterPurchase.availableFunding,
    reconciled:
      providerTotal === accessCoverage + userContribution + tokenContribution &&
      tokenContribution === 0n,
  });

  const refundEvents = refundAccountingEventSequence({
    accessTransactionId: transactionId,
    fundingPoolId: poolId,
    currency: 'USD',
    providerRefund: providerTotal,
    accessPoolRestored: accessCoverage,
    userRefund: userContribution,
    canonicalRefundRef: 'money:refund:mustang',
    evidenceReference: 'evidence:mustang-refund',
    createdAt: NOW,
  });
  for (const event of refundEvents) {
    eventStore.append(event);
  }

  service.getFundingLedger().recordRefund({
    fundingPoolId: poolId,
    currency: 'USD',
    amountMinorUnits: accessCoverage,
    transactionReference: transactionId,
    evidenceReference: 'evidence:mustang-refund-pool',
    createdAt: NOW,
    idempotencyKey: 'mustang:refund-pool',
  });

  const balanceAfterRefund = service.getFundingPoolBalance(poolId, 'USD', NOW);
  const fullRefund: MustangAccountingResult = Object.freeze({
    transactionId,
    providerTotal,
    accessCoverage,
    userContribution,
    tokenContribution,
    providerSettlement: providerTotal,
    accountingEvents: eventStore.listByTransaction(transactionId),
    fundingBalanceAfter: balanceAfterRefund.availableFunding,
    reconciled:
      balanceAfterRefund.availableFunding >= balanceAfterPurchase.availableFunding &&
      providerTotal === accessCoverage + userContribution,
  });

  return Object.freeze({ purchase, fullRefund });
}

export function runPartialRefundScenario(): PartialRefundAccountingResult {
  const originalAccessCoverage = 300_00n;
  const originalUserContribution = 100_00n;
  const providerRefund = 200_00n;
  const { accessRestored, userRefunded } = proportionalRefundSplit({
    providerRefundMinorUnits: providerRefund,
    originalAccessCoverage,
    originalUserContribution,
    accessShareNumerator: 75n,
    accessShareDenominator: 100n,
  });

  const transactionId = 'txn_mustang_partial_001';
  const eventStore = new AccessAccountingEventStore();
  const refundEvents = refundAccountingEventSequence({
    accessTransactionId: transactionId,
    fundingPoolId: 'pool_mobility',
    currency: 'USD',
    providerRefund,
    accessPoolRestored: accessRestored,
    userRefund: userRefunded,
    canonicalRefundRef: 'money:refund:partial',
    evidenceReference: 'evidence:partial-refund',
    createdAt: NOW,
  });
  for (const event of refundEvents) {
    eventStore.append(event);
  }

  const reconciled =
    accessRestored === 150_00n &&
    userRefunded === 50_00n &&
    accessRestored + userRefunded === providerRefund;

  return Object.freeze({
    transactionId,
    originalAccessCoverage,
    originalUserContribution,
    providerRefund,
    accessFundingRestored: accessRestored,
    userRefund: userRefunded,
    accountingEvents: eventStore.listByTransaction(transactionId),
    reconciled,
  });
}
