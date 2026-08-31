/**
 * Ticketmaster Partner commercial Access provider adapter shell.
 *
 * BLOCKED_PENDING_CONTRACT — distinct from Ticketmaster Discovery.
 */

export const TICKETMASTER_PARTNER_PROVIDER_CONTRACT = Object.freeze({
  providerId: 'ticketmaster_partner',
  activationState: 'BLOCKED_PENDING_CONTRACT',
  supportedDomains: Object.freeze(['events', 'admission']),
  liveConnectivity: false,
  notes: 'Fixture adapter shell; Ticketmaster Partner contract not signed.',
});

import type {
  AccessProviderAvailabilityRequest,
  AccessProviderBookingRequest,
  AccessProviderCancellationRequest,
  AccessProviderQuoteRequest,
  AccessProviderRefundRequest,
  AccessProviderReconcileRequest,
  AccessProviderSearchRequest,
  CommercialProviderOutcome,
} from '../../types.ts';
import { CommercialAdapterShell, type CommercialAdapterShellDeps } from '../adapter-shell.ts';
import {
  fixtureAvailability,
  fixtureBooking,
  fixtureCancellation,
  fixtureFirmQuote,
  fixturePartialRefund,
  fixtureSearchItems,
} from '../../fixtures.ts';
import { commercialOk } from '../../shared.ts';

export class TicketmasterPartnerCommercialAdapter extends CommercialAdapterShell {
  constructor(deps: CommercialAdapterShellDeps = {}) {
    super('ticketmaster_partner', deps);
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

  refund(request: AccessProviderRefundRequest) {
    return this.gate('REFUND', () => commercialOk(fixturePartialRefund(this.providerId, request.providerBookingId)));
  }

  reconcile(request: AccessProviderReconcileRequest) {
    return this.gate('RECONCILE', () => {
      const booking = fixtureBooking(this.providerId, 'reconcile', request.idempotencyKey);
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
    return this.gate('STATUS', () => commercialOk(fixtureBooking(this.providerId, 'status', input.providerBookingId)));
  }
}

export function createTicketmasterPartnerCommercialAdapter(
  deps?: CommercialAdapterShellDeps,
): TicketmasterPartnerCommercialAdapter {
  return new TicketmasterPartnerCommercialAdapter(deps);
}
