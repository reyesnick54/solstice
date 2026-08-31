/**
 * Viator commercial Access provider adapter shell.
 *
 * BLOCKED_PENDING_CREDENTIALS — experiences category only.
 */

export const VIATOR_PROVIDER_CONTRACT = Object.freeze({
  providerId: 'viator',
  activationState: 'BLOCKED_PENDING_CREDENTIALS',
  supportedDomains: Object.freeze(['experiences']),
  liveConnectivity: false,
  notes: 'Fixture adapter shell; Viator partner credentials not configured.',
});

import type {
  AccessProviderAvailabilityRequest,
  AccessProviderBookingRequest,
  AccessProviderCancellationRequest,
  AccessProviderQuoteRequest,
  AccessProviderSearchRequest,
  CommercialProviderOutcome,
} from '../../types.ts';
import { CommercialAdapterShell, type CommercialAdapterShellDeps } from '../adapter-shell.ts';
import {
  fixtureAvailability,
  fixtureBooking,
  fixtureCancellation,
  fixtureFirmQuote,
  fixtureSearchItems,
} from '../../fixtures.ts';
import { commercialOk } from '../../shared.ts';

export class ViatorCommercialAdapter extends CommercialAdapterShell {
  constructor(deps: CommercialAdapterShellDeps = {}) {
    super('viator', deps);
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

  book(request: AccessProviderBookingRequest) {
    return this.gate('BOOK', () => {
      const profileCheck = this.validateProfileForBooking(request);
      if (!profileCheck.ok) {
        return profileCheck;
      }
      const existing = this.checkIdempotency('BOOK', request.idempotencyKey, () =>
        commercialOk(fixtureBooking(this.providerId, request.providerQuoteId, request.idempotencyKey)),
      );
      if (existing) {
        return existing;
      }
      const booking = fixtureBooking(this.providerId, request.providerQuoteId, request.idempotencyKey);
      this.recordIdempotency('BOOK', request.idempotencyKey, booking.providerBookingId);
      return commercialOk(booking);
    });
  }

  cancelBooking(request: AccessProviderCancellationRequest) {
    return this.gate('CANCEL', () => commercialOk(fixtureCancellation(this.providerId, request.providerBookingId)));
  }

  getBookingStatus(input: { readonly providerBookingId: string }) {
    return this.gate('STATUS', () => commercialOk(fixtureBooking(this.providerId, 'status', input.providerBookingId)));
  }
}

export function createViatorCommercialAdapter(deps?: CommercialAdapterShellDeps): ViatorCommercialAdapter {
  return new ViatorCommercialAdapter(deps);
}
