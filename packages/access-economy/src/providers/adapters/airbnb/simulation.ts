import type { AccessProvider } from '../../types.ts';
import { PROVIDER_CAPABILITY_REGISTRY } from '../../capabilities.ts';
import { bookingIdFor, buildQuote, fail, ok, quoteIdFor, reservationIdFor, SIMULATION_NOW } from '../shared.ts';
import { AIRBNB_PROVIDER_CONTRACT } from './contract.ts';

const STAY_ITEM = Object.freeze({
  catalogItemId: 'airbnb_rome_apartment',
  category: 'HOUSING_ROOM_NIGHTS' as const,
  canonicalUnit: 'OCCUPANCY_NIGHT' as const,
  title: 'Rome apartment stay',
  description: 'Simulation stay candidate.',
  location: 'Rome, IT',
  serviceClass: 'STANDARD',
  rightKind: 'OCCUPANCY_RIGHT' as const,
});

export class SimulationAirbnbProvider implements AccessProvider {
  readonly providerId = 'airbnb' as const;
  readonly displayName = 'Simulation Airbnb';
  readonly integrationState = 'SIMULATED' as const;
  readonly capabilities = PROVIDER_CAPABILITY_REGISTRY.airbnb.capabilities.map((row) =>
    Object.freeze({ ...row, integrationState: 'SIMULATED' as const }),
  );

  health() {
    return Object.freeze({
      providerId: this.providerId,
      integrationState: 'SIMULATED' as const,
      healthy: true,
      lastCheckedAt: SIMULATION_NOW,
      message: AIRBNB_PROVIDER_CONTRACT.notes,
    });
  }

  search(request: import('../../types.ts').ProviderSearchRequest) {
    const haystack = `${request.query} ${request.location ?? ''}`.toLowerCase();
    if (!haystack.includes('rome')) {
      return fail('NO_MATCH', 'no simulation Airbnb catalog item matches this search');
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        items: Object.freeze([Object.freeze({ ...STAY_ITEM, providerId: this.providerId })]),
        simulationOnly: true as const,
      }),
    );
  }

  availability(request: import('../../types.ts').ProviderAvailabilityRequest) {
    if (request.catalogItemId !== STAY_ITEM.catalogItemId) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        providerId: this.providerId,
        available: request.quantity <= 5n,
        availableQuantity: 5n,
        earliestStart: '2026-09-01T15:00:00.000Z',
        reason: 'simulation stay availability',
        simulationOnly: true,
      }),
    );
  }

  quote(request: import('../../types.ts').ProviderQuoteRequest) {
    if (request.catalogItemId !== STAY_ITEM.catalogItemId) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    return ok(
      buildQuote({
        quoteId: quoteIdFor(request.idempotencyKey),
        providerId: this.providerId,
        catalogItemId: request.catalogItemId,
        canonicalUnit: 'OCCUPANCY_NIGHT',
        quantity: request.quantity,
        providerPriceMinorUnits: 16_500n * request.quantity,
      }),
    );
  }

  reserve(request: import('../../types.ts').ProviderReservationRequest) {
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

  book(request: import('../../types.ts').ProviderBookingRequest) {
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

  cancel(request: import('../../types.ts').ProviderCancellationRequest) {
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

export function createSimulationAirbnbProvider(): SimulationAirbnbProvider {
  return new SimulationAirbnbProvider();
}
