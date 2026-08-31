/**
 * Commercial provider timeout and unknown-booking safety.
 *
 * API timeout does not automatically mean FAILED when booking may have
 * succeeded remotely. Booking POST must not be blindly retried.
 */

import type { AccessProviderBooking, ProviderBookingStatus, ReconciliationState } from './types.ts';

export type BookingOperationOutcome =
  | { readonly kind: 'SUCCESS'; readonly booking: AccessProviderBooking }
  | { readonly kind: 'KNOWN_FAILURE'; readonly code: string; readonly message: string }
  | { readonly kind: 'UNKNOWN'; readonly reconciliationRequired: true; readonly providerBookingId: string | null };

export function classifyBookingTimeout(input: {
  readonly providerBookingId: string | null;
  readonly hadTransportTimeout: boolean;
}): BookingOperationOutcome {
  if (input.hadTransportTimeout) {
    return Object.freeze({
      kind: 'UNKNOWN',
      reconciliationRequired: true,
      providerBookingId: input.providerBookingId,
    });
  }
  return Object.freeze({
    kind: 'KNOWN_FAILURE',
    code: 'BOOKING_FAILED',
    message: 'booking operation failed with a definitive provider response',
  });
}

export function unknownBookingStatus(
  providerBookingId: string,
  travelerReference: string,
  totalAmount: AccessProviderBooking['totalAmount'],
  startsAt: string,
  endsAt: string,
): AccessProviderBooking {
  return Object.freeze({
    providerBookingId,
    providerId: 'amadeus' as const,
    reservationReference: null,
    confirmationCode: null,
    status: 'UNKNOWN' as ProviderBookingStatus,
    reconciliationState: 'RECONCILIATION_REQUIRED' as ReconciliationState,
    startsAt,
    endsAt,
    travelerReference,
    providerTerms: null,
    cancellationPolicy: null,
    totalAmount,
    createdAt: '2026-08-23T12:00:00.000Z',
    provenance: Object.freeze({
      source: 'FIXTURE' as const,
      retrievedAt: '2026-08-23T12:00:00.000Z',
      cacheHit: false,
      providerRequestId: null,
    }),
  });
}

export function mayRetryBooking(input: {
  readonly supportsIdempotency: boolean;
  readonly idempotencyKeySupplied: boolean;
  readonly documentedSafe: boolean;
}): boolean {
  return input.supportsIdempotency && input.idempotencyKeySupplied && input.documentedSafe;
}
