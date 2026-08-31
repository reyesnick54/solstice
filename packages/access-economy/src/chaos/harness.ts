/**
 * ACCESS Wave 5 / Prompt 41 — chaos test harness.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import { buildQuote } from '../providers/adapters/shared.ts';
import type { ProviderQuote } from '../providers/types.ts';
import { createWave3TestStack, seedMobilityEntitlement, seedMobilityFundingPool, WAVE3_NOW, WAVE3_USER, withFutureQuoteExpiry } from '../transaction/test-harness.ts';
import type { AccessTransactionOrchestrator } from '../transaction/orchestrator.ts';
import type { ConfigurableSimulationProvider } from '../transaction/simulation-provider.ts';
import type { AccessSolvencyService } from '../funding-solvency/solvency-service.ts';
import type { AccessPaymentRail } from '../transaction/payment-rail.ts';

export { WAVE3_NOW as CHAOS_NOW, WAVE3_USER as CHAOS_USER };
export { createWave3TestStack, seedMobilityEntitlement, seedMobilityFundingPool };

export type ChaosStack = {
  readonly solvency: AccessSolvencyService;
  readonly simulationProvider: ConfigurableSimulationProvider;
  readonly paymentRail: AccessPaymentRail;
  readonly orchestrator: AccessTransactionOrchestrator;
};

export function mobilityQuote(material: string, priceMinorUnits = 340_00n, expiresAt?: string): ProviderQuote {
  const quote = buildQuote({
    quoteId: `pq_chaos_${material}`,
    providerId: 'turo',
    catalogItemId: 'turo_mustang_gt_miami',
    canonicalUnit: 'VEHICLE_DAY',
    quantity: 1n,
    providerPriceMinorUnits: priceMinorUnits,
  });
  if (expiresAt) {
    return Object.freeze({ ...quote, expiresAt: asUtcInstant(expiresAt) });
  }
  return withFutureQuoteExpiry(quote);
}

export async function quoteCheckout(
  stack: ChaosStack,
  input: {
    readonly txId: string;
    readonly idempotencyKey: string;
    readonly providerQuote?: ProviderQuote;
    readonly now?: string;
  },
): Promise<void> {
  await stack.orchestrator.quote({
    transactionId: input.txId,
    providerId: 'turo',
    providerProductId: 'turo_mustang_gt_miami',
    providerQuote: input.providerQuote ?? mobilityQuote(input.idempotencyKey),
    taxesMinorUnits: 60_00n,
    mandatoryFeesMinorUnits: 0n,
    securityDepositMinorUnits: 500_00n,
    entitlementClass: 'MOBILITY_WAVE3',
    idempotencyKey: input.idempotencyKey,
    now: asUtcInstant(input.now ?? WAVE3_NOW),
  });
}

export async function startMobilityTx(
  stack: ChaosStack,
  input: {
    readonly idempotencyKey: string;
    readonly entitlementUnits?: bigint;
    readonly fundingMinorUnits?: bigint;
    readonly now?: string;
  },
): Promise<{ readonly txId: string; readonly entitlementId: string; readonly poolId: string }> {
  const entitlementId = seedMobilityEntitlement(stack.solvency, input.entitlementUnits ?? 3n);
  const poolId = seedMobilityFundingPool(stack.solvency, input.fundingMinorUnits ?? 500_000_00n);
  const start = await stack.orchestrator.start({
    userId: WAVE3_USER,
    category: 'MOBILITY',
    entitlementId,
    fundingPoolId: poolId,
    unit: 'VEHICLE_DAY',
    idempotencyKey: input.idempotencyKey,
    now: asUtcInstant(input.now ?? WAVE3_NOW),
  });
  if (!start.ok) {
    throw new Error(`start failed: ${start.message}`);
  }
  return Object.freeze({
    txId: start.value!.transactionId,
    entitlementId,
    poolId,
  });
}

export async function reserveAndBook(
  stack: ChaosStack,
  txId: string,
  idempotencyPrefix: string,
  now = WAVE3_NOW,
): Promise<{ readonly reserveOk: boolean; readonly bookOk: boolean }> {
  const reserve = await stack.orchestrator.reserve({
    transactionId: txId,
    userApproved: true,
    idempotencyKey: `${idempotencyPrefix}-reserve`,
    now: asUtcInstant(now),
  });
  if (!reserve.ok) {
    return Object.freeze({ reserveOk: false, bookOk: false });
  }
  const book = await stack.orchestrator.book({
    transactionId: txId,
    idempotencyKey: `${idempotencyPrefix}-book`,
    now: asUtcInstant(now),
  });
  return Object.freeze({ reserveOk: true, bookOk: book.ok });
}

export function suspendFundingPool(stack: ChaosStack, poolId: string, now = WAVE3_NOW): void {
  stack.solvency.getPoolRegistry().suspendPool(poolId, asUtcInstant(now));
}
