/**
 * Simulation Expedia access provider.
 */

import type { AccessProvider, AccessProviderOutcome, ProviderHealth, ProviderSearchRequest, ProviderSearchResult } from '../../types.ts';
import { PROVIDER_CAPABILITY_REGISTRY } from '../../capabilities.ts';
import {
  bookingIdFor,
  buildQuote,
  fail,
  ok,
  quoteIdFor,
  reservationIdFor,
  SIMULATION_NOW,
} from '../shared.ts';
import { EXPEDIA_PROVIDER_CONTRACT } from './contract.ts';

const ROME_HOTEL_ITEM = Object.freeze({
  catalogItemId: 'expedia_rome_trastevere',
  category: 'HOUSING_ROOM_NIGHTS' as const,
  canonicalUnit: 'ROOM_NIGHT' as const,
  title: 'Trastevere boutique hotel — Rome',
  description: 'Simulation lodging candidate for ACCESS-14 Rome redemption.',
  location: 'Rome, IT',
  serviceClass: 'STANDARD',
  rightKind: 'OCCUPANCY_RIGHT' as const,
});

export class SimulationExpediaProvider implements AccessProvider {
  readonly providerId = 'expedia' as const;
  readonly displayName = 'Simulation Expedia';
  readonly integrationState = 'SIMULATED' as const;
  readonly capabilities = PROVIDER_CAPABILITY_REGISTRY.expedia.capabilities;

  health(): ProviderHealth {
    return Object.freeze({
      providerId: this.providerId,
      integrationState: this.integrationState,
      healthy: true,
      lastCheckedAt: SIMULATION_NOW,
      message: EXPEDIA_PROVIDER_CONTRACT.notes,
    });
  }

  search(request: ProviderSearchRequest): AccessProviderOutcome<ProviderSearchResult> {
    const haystack = `${request.query} ${request.location ?? ''}`.toLowerCase();
    if (!haystack.includes('rome')) {
      return fail('NO_MATCH', 'no simulation Expedia catalog item matches this search');
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        items: Object.freeze([
          Object.freeze({
            ...ROME_HOTEL_ITEM,
            providerId: this.providerId,
          }),
        ]),
        simulationOnly: true as const,
      }),
    );
  }

  availability(request: import('../../types.ts').ProviderAvailabilityRequest): AccessProviderOutcome<import('../../types.ts').ProviderAvailabilityResult> {
    if (request.catalogItemId !== ROME_HOTEL_ITEM.catalogItemId) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        providerId: this.providerId,
        available: request.quantity <= 5n,
        availableQuantity: 5n,
        earliestStart: '2026-09-01T15:00:00.000Z',
        reason: 'simulation lodging availability',
        simulationOnly: true,
      }),
    );
  }

  quote(request: import('../../types.ts').ProviderQuoteRequest): AccessProviderOutcome<import('../../types.ts').ProviderQuote> {
    if (request.catalogItemId !== ROME_HOTEL_ITEM.catalogItemId) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    const nightly = 18_000n;
    const total = nightly * request.quantity;
    return ok(
      buildQuote({
        quoteId: quoteIdFor(`${request.idempotencyKey}:${request.catalogItemId}`),
        providerId: this.providerId,
        catalogItemId: request.catalogItemId,
        canonicalUnit: 'ROOM_NIGHT',
        quantity: request.quantity,
        providerPriceMinorUnits: total,
      }),
    );
  }

  reserve(request: import('../../types.ts').ProviderReservationRequest): AccessProviderOutcome<import('../../types.ts').ProviderReservation> {
    return ok(
      Object.freeze({
        reservationId: reservationIdFor(request.idempotencyKey),
        providerId: this.providerId,
        quoteId: request.quoteId,
        state: 'HELD',
        expiresAt: '2026-08-24T12:00:00.000Z',
        simulationOnly: true,
      }),
    );
  }

  book(request: import('../../types.ts').ProviderBookingRequest): AccessProviderOutcome<import('../../types.ts').ProviderBooking> {
    return ok(
      Object.freeze({
        bookingId: bookingIdFor(request.idempotencyKey),
        providerId: this.providerId,
        reservationId: request.reservationId,
        state: 'CONFIRMED',
        rightKind: 'OCCUPANCY_RIGHT',
        accessRightRef: `occ_${request.reservationId}`,
        simulationOnly: true,
      }),
    );
  }

  cancel(request: import('../../types.ts').ProviderCancellationRequest): AccessProviderOutcome<import('../../types.ts').ProviderCancellation> {
    return ok(
      Object.freeze({
        cancellationId: `pcn_${request.bookingId}`,
        providerId: this.providerId,
        bookingId: request.bookingId,
        state: 'CANCELLED',
        simulationOnly: true,
      }),
    );
  }
}

export function createSimulationExpediaProvider(): SimulationExpediaProvider {
  return new SimulationExpediaProvider();
}
