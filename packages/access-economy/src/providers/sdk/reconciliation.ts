/**
 * ACCESS Wave 2 — Booking reconciliation for unknown provider states.
 */

import type { AccessProviderId } from '../types.ts';
import type { AccessBooking } from './interfaces.ts';
import type { AccessProviderEvidenceRecord } from './evidence.ts';

export const BOOKING_RECONCILIATION_STATES = [
  'PENDING_RECONCILIATION',
  'RECONCILED_CONFIRMED',
  'RECONCILED_CANCELLED',
  'RECONCILED_FAILED',
  'REQUIRES_MANUAL_REVIEW',
] as const;
export type BookingReconciliationState = (typeof BOOKING_RECONCILIATION_STATES)[number];

export type BookingReconciliationRecord = {
  readonly reconciliationId: string;
  readonly providerId: AccessProviderId;
  readonly reservationId: string;
  readonly bookingId: string | null;
  readonly state: BookingReconciliationState;
  readonly reason: string;
  readonly evidence: readonly AccessProviderEvidenceRecord[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export class AccessBookingReconciliationService {
  private readonly records = new Map<string, BookingReconciliationRecord>();
  private readonly nowUtc: () => string;

  constructor(options: { readonly nowUtc?: () => string } = {}) {
    this.nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  enqueueUnknownBooking(input: {
    readonly providerId: AccessProviderId;
    readonly reservationId: string;
    readonly reason: string;
    readonly evidence?: readonly AccessProviderEvidenceRecord[];
  }): BookingReconciliationRecord {
    const reconciliationId = `recon_${input.providerId}_${input.reservationId}`;
    const now = this.nowUtc();
    const record: BookingReconciliationRecord = Object.freeze({
      reconciliationId,
      providerId: input.providerId,
      reservationId: input.reservationId,
      bookingId: null,
      state: 'PENDING_RECONCILIATION',
      reason: input.reason,
      evidence: Object.freeze(input.evidence ?? []),
      createdAt: now,
      updatedAt: now,
    });
    this.records.set(reconciliationId, record);
    return record;
  }

  resolve(reconciliationId: string, booking: AccessBooking): BookingReconciliationRecord {
    const existing = this.records.get(reconciliationId);
    if (!existing) {
      throw new Error(`reconciliation record not found: ${reconciliationId}`);
    }
    const state: BookingReconciliationState =
      booking.state === 'CONFIRMED'
        ? 'RECONCILED_CONFIRMED'
        : booking.state === 'CANCELLED'
          ? 'RECONCILED_CANCELLED'
          : booking.state === 'FAILED'
            ? 'RECONCILED_FAILED'
            : 'REQUIRES_MANUAL_REVIEW';
    const updated: BookingReconciliationRecord = Object.freeze({
      ...existing,
      bookingId: booking.bookingId,
      state,
      reason: `reconciled to ${booking.state}`,
      updatedAt: this.nowUtc(),
    });
    this.records.set(reconciliationId, updated);
    return updated;
  }

  get(reconciliationId: string): BookingReconciliationRecord | null {
    return this.records.get(reconciliationId) ?? null;
  }

  listPending(): readonly BookingReconciliationRecord[] {
    return Object.freeze(
      [...this.records.values()].filter((row) => row.state === 'PENDING_RECONCILIATION' || row.state === 'REQUIRES_MANUAL_REVIEW'),
    );
  }
}
