import type { UtcInstant } from '../../domain/src/time.ts';
import type { CapacityPoolId, CapacityReservationId, CapacityResourceId } from './ids.ts';

/**
 * Canonical capacity reservation lifecycle.
 * REQUESTED -> HELD -> CONFIRMED -> ACTIVE -> COMPLETED
 */
export const RESERVATION_STATES = [
  'REQUESTED',
  'HELD',
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
  'DISPUTED',
] as const;

export type ReservationState = (typeof RESERVATION_STATES)[number];

export const TERMINAL_RESERVATION_STATES: readonly ReservationState[] = [
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
];

export const POLICY_STAGES = [
  'DISCOVERY',
  'QUOTE',
  'HOLD',
  'CONFIRM',
  'ACTIVATION',
] as const;

export type PolicyStage = (typeof POLICY_STAGES)[number];

/**
 * Existing productive capacity pool. The Access Fabric reads and reserves
 * capacity; it does not create productive capacity.
 */
export type CapacityPool = {
  readonly poolId: CapacityPoolId;
  readonly resourceId: CapacityResourceId;
  readonly resourceLabel: string;
  readonly windowStart: UtcInstant;
  readonly windowEnd: UtcInstant;
  /** Total existing units in this window (not minted here). */
  readonly totalUnits: number;
  /** Firmly reserved (CONFIRMED + ACTIVE). */
  readonly reservedUnits: number;
  /** Soft-held units (HELD, not yet confirmed). */
  readonly heldUnits: number;
  readonly partialAllowed: boolean;
  readonly epoch: number;
  readonly updatedAt: UtcInstant;
};

export type CapacityReservation = {
  readonly reservationId: CapacityReservationId;
  readonly poolId: CapacityPoolId;
  readonly resourceId: CapacityResourceId;
  readonly actorId: string;
  readonly accountId: string;
  readonly jurisdiction: string;
  readonly requestedUnits: number;
  readonly heldUnits: number;
  readonly confirmedUnits: number;
  readonly state: ReservationState;
  readonly idempotencyKey: string;
  readonly holdExpiresAt: UtcInstant | null;
  readonly confirmationExpiresAt: UtcInstant | null;
  readonly authorityId: string | null;
  readonly policyVersion: string;
  readonly evidenceRefs: readonly string[];
  readonly settlementIntentId: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly epoch: number;
};

export type CapacityQuote = {
  readonly poolId: CapacityPoolId;
  readonly resourceId: CapacityResourceId;
  readonly resourceLabel: string;
  readonly windowStart: UtcInstant;
  readonly windowEnd: UtcInstant;
  readonly availableUnits: number;
  readonly requestedUnits: number;
  readonly quotableUnits: number;
  readonly partialAllowed: boolean;
  readonly policyVersion: string;
  readonly quotedAt: UtcInstant;
};

export type PolicyCheckContext = {
  readonly stage: PolicyStage;
  readonly actorId: string;
  readonly accountId: string;
  readonly poolId: CapacityPoolId;
  readonly resourceId: CapacityResourceId;
  readonly requestedUnits: number;
  readonly policyVersion: string;
};

export type PolicyDecision =
  | { readonly outcome: 'ALLOW'; readonly policyVersion: string; readonly reason: string }
  | { readonly outcome: 'DENY'; readonly code: string; readonly message: string };
import type { AccessEntitlementId, AccessReservationId, AccessUsageEventId, PersonalAccessEnvelopeId } from './ids.ts';
import type {
  AccessEntitlementFailureCode,
  AccessEntitlementSource,
  AccessRestrictionKind,
  ReplenishmentPolicyKind,
} from './taxonomy.ts';

export type AccessFabricFailure = {
  readonly code: AccessEntitlementFailureCode;
  readonly message: string;
};

export type AccessRestriction = {
  readonly kind: AccessRestrictionKind;
  readonly code: string;
  readonly description: string;
};

export type ReplenishmentPolicy = {
  readonly kind: ReplenishmentPolicyKind;
  /** Inclusive UTC instant when the current replenishment window started. */
  readonly windowStartAt: UtcInstant;
  /** Exclusive UTC instant when the current replenishment window ends. */
  readonly windowEndAt: UtcInstant | null;
  readonly quantityPerWindow: bigint;
};

/**
 * A grant of requestable access capacity. Not money, not a transferable balance,
 * and not a measure of human worth.
 */
export type AccessEntitlement = {
  readonly entitlementId: AccessEntitlementId;
  readonly subjectId: string;
  readonly category: string;
  readonly capacity: bigint;
  readonly startAt: UtcInstant;
  readonly endAt: UtcInstant;
  readonly jurisdiction: string;
  readonly geographicScope: string;
  readonly purpose: string;
  readonly restrictions: readonly AccessRestriction[];
  readonly expiry: UtcInstant;
  readonly replenishment: ReplenishmentPolicy;
  readonly provenance: AccessEntitlementSource;
  readonly transferability: boolean;
  readonly humanWorthScore: false;
  readonly isMonetaryAsset: false;
  readonly isTransferableBalance: false;
};

export type AccessUsageRecord = {
  readonly eventId: AccessUsageEventId;
  readonly entitlementId: AccessEntitlementId;
  readonly subjectId: string;
  readonly quantity: bigint;
  readonly consumedAt: UtcInstant;
  readonly purpose: string;
  readonly idempotent: true;
};

export type AccessReservation = {
  readonly reservationId: AccessReservationId;
  readonly entitlementId: AccessEntitlementId;
  readonly subjectId: string;
  readonly quantity: bigint;
  readonly reservedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly purpose: string;
  readonly executed: false;
};

export type AccessMandateConstraint = {
  readonly mandateId: string;
  readonly allowedCategories?: readonly string[];
  readonly allowedPurposes?: readonly string[];
  readonly allowedJurisdictions?: readonly string[];
  readonly maxQuantityPerRequest?: bigint;
};

export type AccessPolicyEligibilityDecision = {
  readonly entitlementId: AccessEntitlementId;
  readonly eligible: boolean;
  readonly policyRef: string;
  readonly evaluatedAt: UtcInstant;
  readonly reasonCode: string;
};

export type JurisdictionCapability = {
  readonly actorJurisdiction: string;
  readonly permittedJurisdictions: readonly string[];
  readonly geographicScopes: readonly string[];
};

export type EligibleAccessRequest = {
  readonly entitlementId: AccessEntitlementId;
  readonly category: string;
  readonly remainingCapacity: bigint;
  readonly purpose: string;
  readonly jurisdiction: string;
  readonly geographicScope: string;
  readonly restrictions: readonly AccessRestriction[];
  readonly provenance: AccessEntitlementSource;
  readonly transferability: boolean;
  readonly replenishesAt: UtcInstant | null;
  readonly policyRef: string | null;
};

/**
 * Answers: "What access is this person currently eligible to request?"
 */
export type PersonalAccessEnvelope = {
  readonly envelopeId: PersonalAccessEnvelopeId;
  readonly subjectId: string;
  readonly evaluatedAt: UtcInstant;
  readonly humanWorthScore: false;
  readonly eligibleRequests: readonly EligibleAccessRequest[];
};

export type AccessEntitlementEngineInput = {
  readonly subjectId: string;
  readonly evaluatedAt: UtcInstant;
  readonly entitlements: readonly AccessEntitlement[];
  readonly mandates: readonly AccessMandateConstraint[];
  readonly policyEligibility: readonly AccessPolicyEligibilityDecision[];
  readonly usage: readonly AccessUsageRecord[];
  readonly reservations: readonly AccessReservation[];
  readonly jurisdictionCapability: JurisdictionCapability;
  readonly processedEventIds?: ReadonlySet<string>;
};

export type AccessEntitlementEngineResult = {
  readonly envelope: PersonalAccessEnvelope;
  readonly excluded: readonly {
    readonly entitlementId: AccessEntitlementId;
    readonly code: AccessEntitlementFailureCode;
    readonly message: string;
  }[];
};
