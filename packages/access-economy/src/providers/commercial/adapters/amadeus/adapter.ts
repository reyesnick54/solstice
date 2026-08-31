/**
 * Amadeus commercial Access provider adapter shell.
 *
 * BLOCKED_PENDING_CREDENTIALS — fixture transport only. No live Amadeus keys.
 */

export const AMADEUS_PROVIDER_CONTRACT = Object.freeze({
  providerId: 'amadeus',
  activationState: 'BLOCKED_PENDING_CREDENTIALS',
  supportedDomains: Object.freeze(['travel', 'hotels', 'cars', 'experiences_reference']),
  liveConnectivity: false,
  sandboxConnectivity: false,
  notes: 'Fixture adapter shell; Amadeus credentials not configured in repository.',
});

import type {
  AccessProviderAvailabilityRequest,
  AccessProviderBookingRequest,
  AccessProviderCancellationRequest,
  AccessProviderQuoteRequest,
  AccessProviderReconcileRequest,
  AccessProviderReservationRequest,
  AccessProviderSearchRequest,
  CommercialProviderOutcome,
} from '../../types.ts';
import { CommercialAdapterShell, type CommercialAdapterShellDeps } from '../adapter-shell.ts';
import {
  fixtureAvailability,
  fixtureBooking,
  fixtureCancellation,
  fixtureFirmQuote,
  fixtureReservation,
  fixtureSearchItems,
  fixtureUnknownBooking,
} from '../../fixtures.ts';
import { commercialOk } from '../../shared.ts';
import { classifyBookingTimeout } from '../../timeout-safety.ts';

export type AmadeusAdapterScenario = 'SUCCESS' | 'BOOKING_FAILURE' | 'BOOKING_TIMEOUT';

export type AmadeusAdapterDeps = CommercialAdapterShellDeps & {
  readonly scenario?: AmadeusAdapterScenario;
};

export class AmadeusCommercialAdapter extends CommercialAdapterShell {
  private readonly scenario: AmadeusAdapterScenario;

  constructor(deps: AmadeusAdapterDeps = {}) {
    super('amadeus', deps);
    this.scenario = deps.scenario ?? 'SUCCESS';
  }

  search(request: AccessProviderSearchRequest): CommercialProviderOutcome<import('../../types.ts').AccessProviderSearchResult> {
    return this.gate('SEARCH', () =>
      commercialOk(
        Object.freeze({
          requestId: request.requestId,
          providerId: this.providerId,
          items: fixtureSearchItems(this.providerId),
          provenance: Object.freeze({
            source: 'FIXTURE' as const,
            retrievedAt: this.now(),
            cacheHit: false,
            providerRequestId: null,
          }),
        }),
      ),
    );
  }

  getAvailability(request: AccessProviderAvailabilityRequest) {
    return this.gate('AVAILABILITY', () => commercialOk(fixtureAvailability(this.providerId, request.providerProductId)));
  }

  quote(request: AccessProviderQuoteRequest) {
    return this.gate('QUOTE', () => commercialOk(fixtureFirmQuote(this.providerId, request.providerProductId, request.idempotencyKey)));
  }

  reserve(request: AccessProviderReservationRequest) {
    return this.gate('RESERVE', () => {
      const existing = this.checkIdempotency('RESERVE', request.idempotencyKey, (ref) =>
        commercialOk(fixtureReservation(this.providerId, request.providerQuoteId, request.idempotencyKey)),
      );
      if (existing) {
        return existing;
      }
      const reservation = fixtureReservation(this.providerId, request.providerQuoteId, request.idempotencyKey);
      this.recordIdempotency('RESERVE', request.idempotencyKey, reservation.providerReservationId);
      return commercialOk(reservation);
    });
  }

  book(request: AccessProviderBookingRequest) {
    return this.gate('BOOK', () => {
      const profileCheck = this.validateProfileForBooking(request);
      if (!profileCheck.ok) {
        return profileCheck;
      }
      const existing = this.checkIdempotency('BOOK', request.idempotencyKey, (ref) =>
        commercialOk(fixtureBooking(this.providerId, request.providerQuoteId, request.idempotencyKey)),
      );
      if (existing) {
        return existing;
      }
      if (this.scenario === 'BOOKING_TIMEOUT') {
        const unknown = classifyBookingTimeout({ providerBookingId: null, hadTransportTimeout: true });
        if (unknown.kind === 'UNKNOWN') {
          const booking = fixtureUnknownBooking(this.providerId, request.idempotencyKey);
          this.recordIdempotency('BOOK', request.idempotencyKey, booking.providerBookingId);
          return commercialOk(booking);
        }
      }
      if (this.scenario === 'BOOKING_FAILURE') {
        return Object.freeze({ ok: false as const, code: 'BOOKING_FAILED', message: 'Amadeus fixture booking failure' });
      }
      const booking = fixtureBooking(this.providerId, request.providerQuoteId, request.idempotencyKey);
      this.recordIdempotency('BOOK', request.idempotencyKey, booking.providerBookingId);
      return commercialOk(booking);
    });
  }

  cancelBooking(request: AccessProviderCancellationRequest) {
    return this.gate('CANCEL', () => commercialOk(fixtureCancellation(this.providerId, request.providerBookingId)));
  }

  reconcile(request: AccessProviderReconcileRequest) {
    return this.gate('RECONCILE', () => {
      const booking = fixtureBooking(this.providerId, 'reconcile_quote', request.idempotencyKey);
      return commercialOk(
        Object.freeze({
          providerBookingId: request.providerBookingId,
          status: booking.status,
          reconciliationState: 'RESOLVED' as const,
          providerReference: booking.confirmationCode,
          provenance: booking.provenance,
        }),
      );
    });
  }

  getBookingStatus(input: { readonly providerBookingId: string }) {
    return this.gate('STATUS', () => commercialOk(fixtureBooking(this.providerId, 'status_quote', input.providerBookingId)));
  }
}

export function createAmadeusCommercialAdapter(deps?: AmadeusAdapterDeps): AmadeusCommercialAdapter {
  return new AmadeusCommercialAdapter(deps);
}
