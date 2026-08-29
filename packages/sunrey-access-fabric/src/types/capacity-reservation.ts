import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessResourceKind } from './access-right.ts';

/** ACCESS-09. Temporary or committed capacity hold against a provider. */
export const CAPACITY_RESERVATION_STATES = [
  'PENDING',
  'HELD',
  'COMMITTED',
  'RELEASED',
  'EXPIRED',
  'FAILED',
] as const;
export type CapacityReservationState = (typeof CAPACITY_RESERVATION_STATES)[number];

export type CapacityReservation = {
  readonly reservationId: string;
  readonly providerId: string;
  readonly resourceKind: AccessResourceKind;
  readonly quantity: number;
  readonly unit: string;
  readonly state: CapacityReservationState;
  readonly holdExpiresAt: UtcInstant | null;
  readonly committedAt: UtcInstant | null;
  readonly releasedAt: UtcInstant | null;
  readonly idempotencyKey: string;
  readonly evidenceId: string | null;
};

export function freezeCapacityReservation(row: CapacityReservation): CapacityReservation {
  if (row.quantity <= 0) {
    throw new Error('reservation quantity must be positive');
  }
  return Object.freeze({ ...row });
}

export function canReleaseReservation(state: CapacityReservationState): boolean {
  return state === 'HELD' || state === 'PENDING';
}

export function canCommitReservation(state: CapacityReservationState): boolean {
  return state === 'HELD';
}
