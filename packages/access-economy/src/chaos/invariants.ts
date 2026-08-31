/**
 * ACCESS Wave 5 / Prompt 41 — reusable Access invariant suite for CI.
 */

import { TOKEN_CONVERSION_CONTRIBUTION } from '../funding-solvency/taxonomy.ts';
import {
  allWave1InvariantsHeld,
  checkAllWave1Invariants,
  type Wave1InvariantResult,
} from '../funding-solvency/invariants.ts';
import type { AccessSolvencyService } from '../funding-solvency/solvency-service.ts';
import type { AccessTransactionStore } from '../transaction/store.ts';
import type { AccessTransactionContext } from '../transaction/types.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export const ACCESS_CHAOS_INVARIANT_IDS = [
  'CONSUMED_LE_ALLOCATED',
  'RESERVED_PLUS_CONSUMED_LE_ALLOCATED',
  'COMMITTED_LE_ELIGIBLE_FUNDING',
  'FUNDING_NON_NEGATIVE',
  'REFUNDED_LE_CAPTURED',
  'PROVIDER_SETTLEMENT_EQUATION',
  'NO_DUPLICATE_BOOKING',
  'NO_DUPLICATE_CAPTURE',
  'TOKEN_CONVERSION_ZERO',
] as const;

export type AccessChaosInvariantId = (typeof ACCESS_CHAOS_INVARIANT_IDS)[number];

export type AccessChaosInvariantResult = {
  readonly id: AccessChaosInvariantId;
  readonly held: boolean;
  readonly detail: string;
};

export type AccessInvariantSnapshot = {
  readonly solvency: AccessSolvencyService;
  readonly store: AccessTransactionStore;
  readonly entitlementId: string;
  readonly fundingPoolId: string;
  readonly currency: string;
  readonly now: UtcInstant;
};

export function checkAccessChaosInvariants(snapshot: AccessInvariantSnapshot): readonly AccessChaosInvariantResult[] {
  const results: AccessChaosInvariantResult[] = [];
  const entBalance = snapshot.solvency.getEntitlementLedger().getBalance(snapshot.entitlementId);
  const poolBalance = snapshot.solvency.getFundingPoolBalance(snapshot.fundingPoolId, snapshot.currency, snapshot.now);

  const wave1 = checkAllWave1Invariants({
    ...(entBalance ? { entitlementBalance: entBalance } : {}),
    fundingBalance: poolBalance,
  });
  const wave1Held = allWave1InvariantsHeld(wave1);

  const push = (id: AccessChaosInvariantId, held: boolean, detail: string): void => {
    results.push(Object.freeze({ id, held, detail }));
  };

  if (entBalance) {
    push(
      'CONSUMED_LE_ALLOCATED',
      entBalance.consumed <= entBalance.allocated,
      `consumed=${entBalance.consumed} allocated=${entBalance.allocated}`,
    );
    push(
      'RESERVED_PLUS_CONSUMED_LE_ALLOCATED',
      entBalance.reserved + entBalance.consumed <= entBalance.allocated,
      `reserved=${entBalance.reserved} consumed=${entBalance.consumed} allocated=${entBalance.allocated}`,
    );
  }

  const committed = poolBalance.pendingSettlement + poolBalance.capturedSettlement;
  const eligible =
    poolBalance.cashReceived +
    poolBalance.discountCapacity -
    poolBalance.refundReserve -
    poolBalance.riskReserve;
  push(
    'COMMITTED_LE_ELIGIBLE_FUNDING',
    committed <= eligible,
    `committed=${committed} eligible=${eligible}`,
  );
  push(
    'FUNDING_NON_NEGATIVE',
    poolBalance.availableFunding >= 0n && poolBalance.availableCashFunding >= 0n,
    `available=${poolBalance.availableFunding}`,
  );

  const contexts = snapshot.store.listAll();
  let refundedOk = true;
  let settlementOk = true;
  const bookingIds = new Set<string>();
  let duplicateBooking = false;
  const captureKeys = new Set<string>();

  for (const ctx of contexts) {
    if (ctx.refundedAmountMinorUnits > ctx.capturedAmountMinorUnits) {
      refundedOk = false;
    }
    if (ctx.quote) {
      const providerAmount = ctx.quote.totalProviderAmountMinorUnits;
      const sources =
        ctx.quote.accessPoolContributionMinorUnits +
        ctx.quote.userContributionMinorUnits +
        ctx.quote.tokenConversionContributionMinorUnits;
      if (sources !== providerAmount) {
        settlementOk = false;
      }
    }
    if (ctx.providerBookingReference) {
      if (bookingIds.has(ctx.providerBookingReference)) {
        duplicateBooking = true;
      }
      bookingIds.add(ctx.providerBookingReference);
    }
    if (ctx.providerPaymentCaptureId) {
      if (captureKeys.has(ctx.providerPaymentCaptureId)) {
        push('NO_DUPLICATE_CAPTURE', false, `duplicate capture ${ctx.providerPaymentCaptureId}`);
      }
      captureKeys.add(ctx.providerPaymentCaptureId);
    }
  }

  push('REFUNDED_LE_CAPTURED', refundedOk, `transactions=${contexts.length}`);
  push('PROVIDER_SETTLEMENT_EQUATION', settlementOk, `transactions=${contexts.length}`);
  push('NO_DUPLICATE_BOOKING', !duplicateBooking, `bookings=${bookingIds.size}`);
  if (!results.some((row) => row.id === 'NO_DUPLICATE_CAPTURE')) {
    push('NO_DUPLICATE_CAPTURE', true, `captures=${captureKeys.size}`);
  }
  push(
    'TOKEN_CONVERSION_ZERO',
    TOKEN_CONVERSION_CONTRIBUTION === 0n && contexts.every((ctx) => (ctx.quote?.tokenConversionContributionMinorUnits ?? 0n) === 0n),
    `global=${TOKEN_CONVERSION_CONTRIBUTION}`,
  );

  void wave1Held;
  return Object.freeze(results);
}

export function allChaosInvariantsHeld(results: readonly AccessChaosInvariantResult[]): boolean {
  return results.every((row) => row.held);
}

export function summarizeWave1(results: readonly Wave1InvariantResult[]): string {
  return results.map((row) => `${row.id}:${row.held ? 'ok' : 'FAIL'}`).join(', ');
}
