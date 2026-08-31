/**
 * ACCESS Wave 1 — Funded capacity state markers.
 *
 * Distinguishes allocation rights from currently payable provider coverage.
 */

import type { FundedCapacityMarker, FundedCapacityState } from './types.ts';
import type { FundingPoolBalance } from './types.ts';

export function classifyFundedCapacity(input: {
  readonly poolId: string;
  readonly category: string;
  readonly allocatableUnits: bigint;
  readonly allocationRightsUnits: bigint;
  readonly balance: FundingPoolBalance;
  readonly providerContributedUnits?: bigint;
}): FundedCapacityMarker {
  const providerContributedUnits = input.providerContributedUnits ?? 0n;
  const cashFunding = input.balance.availableCashFunding;
  const discountCapacity = input.balance.availableDiscountCapacity;

  let state: FundedCapacityState;
  if (cashFunding > 0n && discountCapacity > 0n) {
    state = 'PARTIALLY_FUNDED';
  } else if (cashFunding > 0n) {
    state = 'FUNDED';
  } else if (discountCapacity > 0n || providerContributedUnits > 0n) {
    state = providerContributedUnits > 0n ? 'PROVIDER_CONTRIBUTED' : 'PARTIALLY_FUNDED';
  } else {
    state = 'UNFUNDED';
  }

  const payableCoverageUnits =
    state === 'UNFUNDED' ? 0n : input.allocatableUnits;

  return Object.freeze({
    poolId: input.poolId,
    category: input.category,
    state,
    cashFundingMinorUnits: cashFunding,
    discountCapacityMinorUnits: discountCapacity,
    providerContributedUnits,
    allocatableUnits: input.allocatableUnits,
    allocationRightsUnits: input.allocationRightsUnits,
    payableCoverageUnits,
  });
}
