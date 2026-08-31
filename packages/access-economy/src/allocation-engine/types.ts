/**
 * ACCESS Wave 1 / Prompt 29 — Access Allocation Engine types.
 *
 * Converts eligible SunRey + MoonRey participation into non-cash Access
 * entitlements bounded by real available capacity. Read-only against token
 * balances — no mint, burn, transfer, or fiat peg.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SubjectRef } from '../ids.ts';
import type {
  AccessAllocationCategory,
  AccessCapacityPool,
  BalanceCheckpoint,
  EligibleSupplySnapshot,
  IssuedAccessEntitlement,
} from '../dual-token-allocation/types.ts';

export const ACCESS_ALLOCATION_ENGINE_VERSION = 'sunrey.access.allocation-engine.v1' as const;
export const ENGINEERING_SIMULATION_PARAMETERS = 'ENGINEERING_SIMULATION_PARAMETERS' as const;

export const ALLOCATION_SNAPSHOT_STATUSES = [
  'CALCULATING',
  'FINALIZED',
  'CANCELLED',
  'SUPERSEDED',
] as const;
export type AccessAllocationSnapshotStatus = (typeof ALLOCATION_SNAPSHOT_STATUSES)[number];

export const DIMINISHING_RETURN_FUNCTIONS = ['SQRT'] as const;
export type DiminishingReturnFunction = (typeof DIMINISHING_RETURN_FUNCTIONS)[number];

export const ROLLOVER_POLICIES = ['NO_ROLLOVER', 'LIMITED_ROLLOVER', 'FULL_ROLLOVER'] as const;
export type RolloverPolicy = (typeof ROLLOVER_POLICIES)[number];

export const UNIT_ROUNDING_MODES = ['WHOLE', 'FRACTIONAL_MILLI'] as const;
export type UnitRoundingMode = (typeof UNIT_ROUNDING_MODES)[number];

export const ALLOCATION_MODES = ['PREVIEW', 'FINALIZE'] as const;
export type AllocationMode = (typeof ALLOCATION_MODES)[number];

/** Minimum participation thresholds for eligibility. */
export type MinimumEligibility = {
  readonly minimumSunReyTwab: bigint;
  readonly minimumMoonReyTwab: bigint;
  readonly minimumParticipantWeightScaled: bigint;
};

/**
 * Governed allocation policy. Reference balances are allocation reference
 * quantities — NOT fiat prices, redemption values, or token pegs.
 */
export type AccessAllocationPolicy = {
  readonly policyId: string;
  readonly version: string;
  /** When set, overrides the base policy for this category only. */
  readonly category: AccessAllocationCategory | null;
  readonly twabWindowDays: number;
  /** SR_REFERENCE_BALANCE — allocation reference quantity, not a fiat peg. */
  readonly srReferenceBalance: bigint;
  /** MR_REFERENCE_BALANCE — allocation reference quantity, not a fiat peg. */
  readonly mrReferenceBalance: bigint;
  readonly srCoefficient: number;
  readonly mrCoefficient: number;
  readonly dualCoefficient: number;
  readonly diminishingReturnFunction: DiminishingReturnFunction;
  readonly minimumEligibility: MinimumEligibility;
  /** Maximum share of category capacity one participant may receive (bps, 10000 = 100%). */
  readonly maximumAllocationShareBps: number | null;
  readonly expirationDays: number;
  readonly rolloverPolicy: RolloverPolicy;
  readonly unitRoundingMode: UnitRoundingMode;
  readonly enabled: boolean;
  readonly effectiveFrom: UtcInstant;
  readonly label: typeof ENGINEERING_SIMULATION_PARAMETERS;
};

export type AccessAllocationSnapshot = {
  readonly snapshotId: string;
  readonly category: AccessAllocationCategory;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly capacityId: string;
  readonly totalCapacity: bigint;
  readonly eligibleCapacity: bigint;
  readonly participantCount: number;
  readonly totalParticipantWeightScaled: bigint;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly generatedAt: UtcInstant;
  readonly inputLedgerSnapshotReference: string;
  readonly status: AccessAllocationSnapshotStatus;
  readonly mode: AllocationMode;
};

/** Reproducible evidence for a single participant allocation. */
export type ParticipantAllocationEvidence = {
  readonly evidenceId: string;
  readonly snapshotId: string;
  readonly subjectRef: SubjectRef;
  readonly category: AccessAllocationCategory;
  readonly sunReyTwab: bigint;
  readonly moonReyTwab: bigint;
  readonly normalizedSunReyScoreScaled: bigint;
  readonly normalizedMoonReyScoreScaled: bigint;
  readonly dualScoreScaled: bigint;
  readonly participantWeightScaled: bigint;
  readonly totalCategoryWeightScaled: bigint;
  readonly availableCapacity: bigint;
  readonly allocatedUnits: bigint;
  readonly capacityUnit: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly allocationId: string | null;
};

export type ParticipantAllocationInput = {
  readonly subjectRef: SubjectRef;
  readonly checkpoints?: readonly BalanceCheckpoint[];
  readonly sunReyLiquid?: bigint;
  readonly moonReyLiquid?: bigint;
  readonly custodySources?: readonly string[];
  readonly restricted?: boolean;
  readonly jurisdictionAllowed?: boolean;
};

export type ParticipantWeightResult = {
  readonly subjectRef: SubjectRef;
  readonly category: AccessAllocationCategory;
  readonly sunReyTwab: bigint;
  readonly moonReyTwab: bigint;
  readonly normalizedSunReyScoreScaled: bigint;
  readonly normalizedMoonReyScoreScaled: bigint;
  readonly dualScoreScaled: bigint;
  readonly participantWeightScaled: bigint;
  readonly eligible: boolean;
  readonly ineligibleReason: string | null;
  readonly policyId: string;
  readonly policyVersion: string;
};

export type CategoryAllocationResult = {
  readonly category: AccessAllocationCategory;
  readonly pool: AccessCapacityPool;
  readonly evidence: readonly ParticipantAllocationEvidence[];
  readonly totalAllocated: bigint;
  readonly residualCapacity: bigint;
  readonly totalParticipantWeightScaled: bigint;
};

export type AllocationSnapshotResult = {
  readonly snapshot: AccessAllocationSnapshot;
  readonly categoryResults: readonly CategoryAllocationResult[];
  readonly entitlements: readonly IssuedAccessEntitlement[];
};

export type UserAllocationPreview = {
  readonly subjectRef: SubjectRef;
  readonly category: AccessAllocationCategory;
  readonly participantWeightScaled: bigint;
  readonly estimatedAllocatedUnits: bigint;
  readonly capacityUnit: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly snapshotId: string | null;
};

export type EligibilityPort = {
  readonly isProgramEnabled: () => boolean;
  readonly isSubjectRestricted: (subjectRef: SubjectRef) => boolean;
  readonly isJurisdictionAllowed: (subjectRef: SubjectRef) => boolean;
};

export type TokenBalanceReaderPort = {
  readonly checkpointsFor: (
    subjectRef: SubjectRef,
    periodStart: UtcInstant,
    periodEnd: UtcInstant,
  ) => readonly BalanceCheckpoint[];
};

export type FinalizeSnapshotInput = {
  readonly snapshotId: string;
  readonly idempotencyKey: string;
};

export type GenerateSnapshotInput = {
  readonly snapshotId: string;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly pools: readonly AccessCapacityPool[];
  readonly participants: readonly ParticipantAllocationInput[];
  readonly supply: EligibleSupplySnapshot;
  readonly policy?: AccessAllocationPolicy;
  readonly categories?: readonly AccessAllocationCategory[];
  readonly mode: AllocationMode;
  readonly generatedAt?: UtcInstant;
};
