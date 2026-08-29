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
