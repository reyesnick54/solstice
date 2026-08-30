/**
 * ACCESS-15 Dual-Token Access Allocation Protocol types.
 *
 * Converts SunRey + MoonRey participation into non-cash, non-transferable
 * Access entitlements backed by verified capacity. No third token.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SubjectRef } from '../ids.ts';

export const ACCESS_15_POLICY_VERSION = 'sunrey.access.dual-token-allocation.v1' as const;
export const ACCESS_15_SCHEMA_VERSION = 1 as const;
export const ENGINEERING_SIMULATION_PARAMETERS = 'ENGINEERING_SIMULATION_PARAMETERS' as const;

export const ACCESS_EPOCH_STATUSES = [
  'PLANNED',
  'OPEN',
  'SNAPSHOT_PENDING',
  'ALLOCATING',
  'FINALIZED',
  'CLOSED',
  'FAILED',
] as const;
export type AccessEpochStatus = (typeof ACCESS_EPOCH_STATUSES)[number];

export const ACCESS_EPOCH_CADENCES = ['MONTHLY', 'WEEKLY', 'QUARTERLY'] as const;
export type AccessEpochCadence = (typeof ACCESS_EPOCH_CADENCES)[number];

export const ACCESS_ALLOCATION_CATEGORIES = [
  'MOBILITY',
  'TRAVEL',
  'STAY',
  'FOOD',
  'SHOP',
  'EXPERIENCES',
  'AI_COMPUTE',
  'ROBOTICS',
  'ENERGY',
] as const;
export type AccessAllocationCategory = (typeof ACCESS_ALLOCATION_CATEGORIES)[number];

export const ACCESS_ECONOMIC_MODES = [
  'INCLUDED_ACCESS',
  'ACCESS_PLUS_TOKEN',
  'TOKEN_ONLY_ACCESS',
] as const;
export type AccessEconomicMode = (typeof ACCESS_ECONOMIC_MODES)[number];

export const ACCESS_COMMITMENT_KINDS = [
  'LIQUID',
  '90_DAY_COMMITMENT',
  '180_DAY_COMMITMENT',
  '365_DAY_COMMITMENT',
] as const;
export type AccessCommitmentKind = (typeof ACCESS_COMMITMENT_KINDS)[number];

export const PARTICIPATION_TRANSFORM_TYPES = ['SQRT_CONCAVE'] as const;
export type ParticipationTransformType = (typeof PARTICIPATION_TRANSFORM_TYPES)[number];

export const PARTICIPATION_ROUNDING_MODES = ['TRUNCATE'] as const;
export type ParticipationRoundingMode = (typeof PARTICIPATION_ROUNDING_MODES)[number];

export const POLICY_STATUSES = ['DRAFT', 'SIMULATION', 'RETIRED'] as const;
export type AccessAllocationPolicyStatus = (typeof POLICY_STATUSES)[number];

export const CAPACITY_POOL_STATUSES = ['DRAFT', 'VERIFIED', 'ALLOCATING', 'EXHAUSTED', 'CLOSED'] as const;
export type AccessCapacityPoolStatus = (typeof CAPACITY_POOL_STATUSES)[number];

export type AccessEpoch = {
  readonly epochId: string;
  readonly policyVersion: string;
  readonly cadence: AccessEpochCadence;
  readonly startsAt: UtcInstant;
  readonly endsAt: UtcInstant;
  readonly snapshotCutoff: UtcInstant;
  readonly allocationFinalizedAt: UtcInstant | null;
  readonly status: AccessEpochStatus;
};

export type BalanceCheckpoint = {
  readonly observedAt: UtcInstant;
  readonly sunReyLiquid: bigint;
  readonly moonReyLiquid: bigint;
  readonly sunReyLocked: bigint;
  readonly moonReyLocked: bigint;
  readonly sunReyEscrowed: bigint;
  readonly moonReyEscrowed: bigint;
};

export type TokenBalanceHistoryPort = {
  readonly checkpointsFor: (
    subjectRef: SubjectRef,
    epoch: AccessEpoch,
  ) => readonly BalanceCheckpoint[];
};

export type EligibleSupplySnapshot = {
  readonly sunReyEligibleBase: bigint;
  readonly moonReyEligibleBase: bigint;
  readonly sourceStateCommitment: string;
  readonly observedAt: UtcInstant;
};

export type TokenParticipationSnapshot = {
  readonly subjectRef: SubjectRef;
  readonly epochId: string;
  readonly sunReyTwab: bigint;
  readonly moonReyTwab: bigint;
  readonly eligibleSunReyTwab: bigint;
  readonly eligibleMoonReyTwab: bigint;
  readonly policyVersion: string;
  readonly sourceStateCommitment: string;
  readonly calculatedAt: UtcInstant;
};

export type ParticipationTransformPolicy = {
  readonly transformId: string;
  readonly version: string;
  readonly type: ParticipationTransformType;
  readonly scale: bigint;
  readonly roundingMode: ParticipationRoundingMode;
  readonly maximumEffectiveParticipation: bigint | null;
  readonly status: AccessAllocationPolicyStatus;
};

export type CategoryParticipationCoefficients = {
  readonly category: AccessAllocationCategory;
  readonly alphaBps: bigint;
  readonly betaBps: bigint;
  readonly gammaBps: bigint;
  readonly label: typeof ENGINEERING_SIMULATION_PARAMETERS;
};

export type DualParticipationPolicy = {
  readonly policyId: string;
  readonly version: string;
  readonly coefficients: readonly CategoryParticipationCoefficients[];
  readonly coeffScale: bigint;
  readonly status: AccessAllocationPolicyStatus;
};

export type AccessCommitmentPolicy = {
  readonly commitmentId: string;
  readonly version: string;
  readonly kind: AccessCommitmentKind;
  /** Fixed-point multiplier on PARTICIPATION_SCALE. Simulation only until governed. */
  readonly participationMultiplierScaled: bigint;
  readonly maximumMultiplierScaled: bigint;
  readonly status: AccessAllocationPolicyStatus;
  readonly label: typeof ENGINEERING_SIMULATION_PARAMETERS;
};

export type AccessCapacityPool = {
  readonly poolId: string;
  readonly epochId: string;
  readonly category: AccessAllocationCategory;
  readonly geography: string;
  readonly timeWindow: string;
  readonly capacityUnit: string;
  readonly verifiedGrossCapacity: bigint;
  readonly reservedCapacity: bigint;
  readonly providerCommittedCapacity: bigint;
  readonly fundedExternalCapacity: bigint;
  readonly policyReservedCapacity: bigint;
  readonly allocatableCapacity: bigint;
  readonly sourceRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly status: AccessCapacityPoolStatus;
};

export type NormalizedParticipation = {
  readonly subjectRef: SubjectRef;
  readonly epochId: string;
  readonly category: AccessAllocationCategory;
  readonly sunReyParticipationScaled: bigint;
  readonly moonReyParticipationScaled: bigint;
  readonly gSunReyScaled: bigint;
  readonly gMoonReyScaled: bigint;
  readonly dualBonusScaled: bigint;
  readonly weightScaled: bigint;
};

export type AccessAllocationRecord = {
  readonly allocationId: string;
  readonly subjectRef: SubjectRef;
  readonly epochId: string;
  readonly poolId: string;
  readonly category: AccessAllocationCategory;
  readonly allocatedUnits: bigint;
  readonly capacityUnit: string;
  readonly weightScaled: bigint;
  readonly economicMode: AccessEconomicMode;
  readonly policyVersion: string;
  readonly remainderRank: number | null;
};

export type IssuedAccessEntitlement = {
  readonly entitlementId: string;
  readonly subjectRef: SubjectRef;
  readonly epochId: string;
  readonly category: AccessAllocationCategory;
  readonly quantity: bigint;
  readonly unit: string;
  readonly transferability: false;
  readonly isMonetaryAsset: false;
  readonly isWithdrawable: false;
  readonly expiresAt: UtcInstant;
  readonly economicMode: AccessEconomicMode;
};

export type AllocationRunResult = {
  readonly epoch: AccessEpoch;
  readonly participation: readonly TokenParticipationSnapshot[];
  readonly normalized: readonly NormalizedParticipation[];
  readonly allocations: readonly AccessAllocationRecord[];
  readonly entitlements: readonly IssuedAccessEntitlement[];
  readonly pools: readonly AccessCapacityPool[];
  readonly policyVersion: string;
  readonly sourceStateCommitment: string;
};
