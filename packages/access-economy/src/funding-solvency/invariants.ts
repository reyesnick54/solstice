/**
 * ACCESS Wave 1 — Solvency and entitlement invariants.
 */

import type { EntitlementBalance, FundingPoolBalance } from './types.ts';
import { TOKEN_CONVERSION_CONTRIBUTION } from './taxonomy.ts';

export const ACCESS_WAVE1_INVARIANT_IDS = [
  'FUNDING_NON_NEGATIVE',
  'ENTITLEMENT_NON_NEGATIVE',
  'NO_ENTITLEMENT_DOUBLE_SPEND',
  'COMMITTED_LE_ELIGIBLE_FUNDING',
  'RESERVED_PLUS_CONSUMED_LE_ALLOCATED',
  'TOKEN_CONVERSION_ZERO',
  'NO_CANONICAL_LEDGER_MUTATION',
] as const;

export type AccessWave1InvariantId = (typeof ACCESS_WAVE1_INVARIANT_IDS)[number];

export type Wave1InvariantResult = {
  readonly id: AccessWave1InvariantId;
  readonly held: boolean;
  readonly detail: string;
};

export function checkFundingNonNegative(balance: FundingPoolBalance): Wave1InvariantResult {
  const held = balance.availableFunding >= 0n && balance.availableCashFunding >= 0n;
  return {
    id: 'FUNDING_NON_NEGATIVE',
    held,
    detail: held
      ? 'available funding is non-negative'
      : `availableFunding=${balance.availableFunding}`,
  };
}

export function checkEntitlementNonNegative(balance: EntitlementBalance): Wave1InvariantResult {
  const held = balance.remaining >= 0n && balance.reserved >= 0n && balance.consumed >= 0n;
  return {
    id: 'ENTITLEMENT_NON_NEGATIVE',
    held,
    detail: held ? 'entitlement balance is non-negative' : `remaining=${balance.remaining}`,
  };
}

export function checkNoEntitlementDoubleSpend(balance: EntitlementBalance): Wave1InvariantResult {
  const held = balance.reserved + balance.consumed + balance.expired <= balance.allocated;
  return {
    id: 'NO_ENTITLEMENT_DOUBLE_SPEND',
    held,
    detail: held
      ? 'reserved + consumed + expired <= allocated'
      : `reserved=${balance.reserved} consumed=${balance.consumed} expired=${balance.expired} allocated=${balance.allocated}`,
  };
}

export function checkCommittedFundingEligible(balance: FundingPoolBalance): Wave1InvariantResult {
  const committed = balance.pendingSettlement + balance.capturedSettlement;
  const eligible =
    balance.cashReceived +
    balance.discountCapacity -
    balance.refundReserve -
    balance.riskReserve;
  const held = committed <= eligible;
  return {
    id: 'COMMITTED_LE_ELIGIBLE_FUNDING',
    held,
    detail: held ? 'committed funding within eligible available' : `committed=${committed} eligible=${eligible}`,
  };
}

export function checkReservedPlusConsumedLeAllocated(balance: EntitlementBalance): Wave1InvariantResult {
  const held = balance.reserved + balance.consumed <= balance.allocated;
  return {
    id: 'RESERVED_PLUS_CONSUMED_LE_ALLOCATED',
    held,
    detail: held
      ? 'reserved + consumed <= allocated'
      : `reserved=${balance.reserved} consumed=${balance.consumed} allocated=${balance.allocated}`,
  };
}

export function checkTokenConversionZero(): Wave1InvariantResult {
  const held = TOKEN_CONVERSION_CONTRIBUTION === 0n;
  return {
    id: 'TOKEN_CONVERSION_ZERO',
    held,
    detail: held ? 'tokenConversionContribution is zero' : 'token conversion must be zero',
  };
}

export function checkAllWave1Invariants(input: {
  readonly fundingBalance?: FundingPoolBalance;
  readonly entitlementBalance?: EntitlementBalance;
}): readonly Wave1InvariantResult[] {
  const results: Wave1InvariantResult[] = [checkTokenConversionZero()];
  if (input.fundingBalance) {
    results.push(
      checkFundingNonNegative(input.fundingBalance),
      checkCommittedFundingEligible(input.fundingBalance),
    );
  }
  if (input.entitlementBalance) {
    results.push(
      checkEntitlementNonNegative(input.entitlementBalance),
      checkNoEntitlementDoubleSpend(input.entitlementBalance),
      checkReservedPlusConsumedLeAllocated(input.entitlementBalance),
    );
  }
  return Object.freeze(results);
}

export function allWave1InvariantsHeld(results: readonly Wave1InvariantResult[]): boolean {
  return results.every((row) => row.held);
}
