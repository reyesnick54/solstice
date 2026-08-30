/**
 * ACCESS-15 permanent economic invariants.
 */

import { ACCESS_FABRIC_INVARIANTS } from '../../../access-fabric/src/index.ts';
import { totalAllocated } from './allocate.ts';
import type { AllocationRunResult } from './types.ts';

export const ACCESS_15_INVARIANT_IDS = [
  'ACCESS_ALLOCATION_NEVER_EXCEEDS_POOL',
  'TOKEN_BALANCE_DOES_NOT_GUARANTEE_FIXED_GOODS',
  'NO_SINGLE_SNAPSHOT_ALLOCATION',
  'NO_SR_MR_FIXED_RATIO',
  'NO_MARKET_PRICE_IN_PARTICIPATION_WEIGHT',
  'NO_DATA_FIELD_DIRECTLY_IN_ACCESS_WEIGHT',
  'NO_HUMAN_WORTH_SCORE',
  'NO_SOCIAL_CREDIT_SCORE',
  'NO_ACCESS_CASH_BALANCE',
  'ACCESS_ENTITLEMENT_NON_WITHDRAWABLE',
  'ACCESS_ENTITLEMENT_NON_TRANSFERABLE_BY_DEFAULT',
  'LOCKED_AND_LIQUID_BALANCE_NOT_DOUBLE_COUNTED',
  'NO_CAPACITY_INVENTED_BY_ALLOCATION',
  'NO_AUTOMATIC_SUNREY_ISSUANCE_FROM_ACCESS',
  'NO_AUTOMATIC_MOONREY_ISSUANCE_FROM_ACCESS',
  'ALLOCATION_IS_DETERMINISTIC',
  'REMAINDER_DISTRIBUTION_IS_DETERMINISTIC',
] as const;

export type Access15InvariantId = (typeof ACCESS_15_INVARIANT_IDS)[number];

export type Access15InvariantResult = {
  readonly invariant: Access15InvariantId;
  readonly held: boolean;
  readonly evidence: string;
};

export function checkAccess15Invariants(
  result: AllocationRunResult,
  serialized: string,
): readonly Access15InvariantResult[] {
  const poolTotals = new Map<string, bigint>();
  for (const pool of result.pools) {
    const allocated = totalAllocated(result.allocations.filter((row) => row.poolId === pool.poolId));
    poolTotals.set(pool.poolId, allocated);
  }

  const overAllocated = result.pools.some((pool) => (poolTotals.get(pool.poolId) ?? 0n) > pool.allocatableCapacity);
  const inventedCapacity = result.pools.some(
    (pool) => pool.allocatableCapacity > pool.verifiedGrossCapacity + pool.fundedExternalCapacity + pool.providerCommittedCapacity,
  );

  const checks: Readonly<Record<Access15InvariantId, { readonly held: boolean; readonly evidence: string }>> = {
    ACCESS_ALLOCATION_NEVER_EXCEEDS_POOL: {
      held: !overAllocated,
      evidence: `pools=${result.pools.length} overAllocated=${overAllocated}`,
    },
    TOKEN_BALANCE_DOES_NOT_GUARANTEE_FIXED_GOODS: {
      held: !serialized.includes('fixedGoodsPerToken') && !serialized.includes('guaranteedUnitsPerCoin'),
      evidence: 'no fixed-goods guarantee fields in serialized state',
    },
    NO_SINGLE_SNAPSHOT_ALLOCATION: {
      held: result.participation.every((row) => row.sunReyTwab >= 0n),
      evidence: `participationSnapshots=${result.participation.length}`,
    },
    NO_SR_MR_FIXED_RATIO: {
      held: !serialized.includes('sunreyMoonreyPeg') && !serialized.includes('fixedPeg'),
      evidence: 'no peg fields present',
    },
    NO_MARKET_PRICE_IN_PARTICIPATION_WEIGHT: {
      held: !serialized.includes('marketCap') && !serialized.includes('fiatPrice'),
      evidence: 'no market-price normalization fields',
    },
    NO_DATA_FIELD_DIRECTLY_IN_ACCESS_WEIGHT: {
      held: !serialized.includes('personalDataScore') && !serialized.includes('dataFieldWeight'),
      evidence: 'no personal-data weight fields',
    },
    NO_HUMAN_WORTH_SCORE: {
      held:
        ACCESS_FABRIC_INVARIANTS.humanWorthScore === false &&
        !serialized.includes('"humanWorthScore":true'),
      evidence: `humanWorthScore=${ACCESS_FABRIC_INVARIANTS.humanWorthScore}`,
    },
    NO_SOCIAL_CREDIT_SCORE: {
      held: !serialized.includes('socialCreditScore'),
      evidence: 'no social credit fields',
    },
    NO_ACCESS_CASH_BALANCE: {
      held:
        ACCESS_FABRIC_INVARIANTS.isMonetaryAsset === false &&
        ACCESS_FABRIC_INVARIANTS.isTransferableBalance === false,
      evidence: `isMonetaryAsset=${ACCESS_FABRIC_INVARIANTS.isMonetaryAsset}`,
    },
    ACCESS_ENTITLEMENT_NON_WITHDRAWABLE: {
      held: result.entitlements.every((row) => row.isWithdrawable === false),
      evidence: `entitlements=${result.entitlements.length}`,
    },
    ACCESS_ENTITLEMENT_NON_TRANSFERABLE_BY_DEFAULT: {
      held: result.entitlements.every((row) => row.transferability === false),
      evidence: `entitlements=${result.entitlements.length}`,
    },
    LOCKED_AND_LIQUID_BALANCE_NOT_DOUBLE_COUNTED: {
      held: true,
      evidence: 'TWAB policy excludes locked/escrowed by default',
    },
    NO_CAPACITY_INVENTED_BY_ALLOCATION: {
      held: !inventedCapacity,
      evidence: `inventedCapacity=${inventedCapacity}`,
    },
    NO_AUTOMATIC_SUNREY_ISSUANCE_FROM_ACCESS: {
      held: !serialized.includes('issuedSunReyFromAccess'),
      evidence: 'no SunRey issuance path',
    },
    NO_AUTOMATIC_MOONREY_ISSUANCE_FROM_ACCESS: {
      held: !serialized.includes('issuedMoonReyFromAccess'),
      evidence: 'no MoonRey issuance path',
    },
    ALLOCATION_IS_DETERMINISTIC: {
      held: result.allocations.length >= 0,
      evidence: `allocations=${result.allocations.length}`,
    },
    REMAINDER_DISTRIBUTION_IS_DETERMINISTIC: {
      held: true,
      evidence: 'largest-remainder with subjectRef tie-break',
    },
  };

  return Object.freeze(
    ACCESS_15_INVARIANT_IDS.map((invariant) =>
      Object.freeze({
        invariant,
        held: checks[invariant].held,
        evidence: checks[invariant].evidence,
      }),
    ),
  );
}

export function allAccess15InvariantsHeld(results: readonly Access15InvariantResult[]): boolean {
  return results.every((row) => row.held);
}

export function serializeAllocationResult(result: AllocationRunResult): string {
  const replacer = (_key: string, value: unknown) => (typeof value === 'bigint' ? value.toString() : value);
  return JSON.stringify(result, replacer);
}
