import type { AccessProvider } from '../../types.ts';
import { PROVIDER_CAPABILITY_REGISTRY } from '../../capabilities.ts';
import { bookingIdFor, buildQuote, fail, ok, quoteIdFor, reservationIdFor, SIMULATION_NOW } from '../shared.ts';
import { DOORDASH_PROVIDER_CONTRACT } from './contract.ts';

const MEAL_ITEM = Object.freeze({
  catalogItemId: 'doordash_neighborhood_meal',
  category: 'FOOD' as const,
  canonicalUnit: 'MEAL' as const,
  title: 'Neighborhood meal delivery',
  description: 'Simulation food delivery candidate.',
  location: 'Miami, FL',
  serviceClass: 'STANDARD',
  rightKind: 'DELIVERY_RIGHT' as const,
});

export class SimulationDoorDashProvider implements AccessProvider {
  readonly providerId = 'doordash' as const;
  readonly displayName = 'Simulation DoorDash';
  readonly integrationState = 'SIMULATED' as const;
  readonly capabilities = PROVIDER_CAPABILITY_REGISTRY.doordash.capabilities.map((row) =>
    Object.freeze({ ...row, integrationState: 'SIMULATED' as const, supported: row.capabilityId !== 'RESERVE' }),
  );

  health() {
    return Object.freeze({
      providerId: this.providerId,
      integrationState: 'SIMULATED' as const,
      healthy: true,
      lastCheckedAt: SIMULATION_NOW,
      message: DOORDASH_PROVIDER_CONTRACT.notes,
    });
  }

  search(request: import('../../types.ts').ProviderSearchRequest) {
    const haystack = `${request.query} ${request.location ?? ''}`.toLowerCase();
    if (!haystack.includes('meal') && !haystack.includes('food')) {
      return fail('NO_MATCH', 'no simulation DoorDash catalog item matches this search');
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        items: Object.freeze([Object.freeze({ ...MEAL_ITEM, providerId: this.providerId })]),
        simulationOnly: true as const,
      }),
    );
  }

  availability(request: import('../../types.ts').ProviderAvailabilityRequest) {
    if (request.catalogItemId !== MEAL_ITEM.catalogItemId) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        providerId: this.providerId,
        available: true,
        availableQuantity: 12n,
        earliestStart: '2026-08-23T18:00:00.000Z',
        reason: 'simulation meal availability',
        simulationOnly: true,
      }),
    );
  }

  quote(request: import('../../types.ts').ProviderQuoteRequest) {
    if (request.catalogItemId !== MEAL_ITEM.catalogItemId) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    return ok(
      buildQuote({
        quoteId: quoteIdFor(request.idempotencyKey),
        providerId: this.providerId,
        catalogItemId: request.catalogItemId,
        canonicalUnit: 'MEAL',
        quantity: request.quantity,
        providerPriceMinorUnits: 2_800n * request.quantity,
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
        rightKind: 'DELIVERY_RIGHT',
        accessRightRef: `dr_${request.reservationId}`,
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

export function createSimulationDoorDashProvider(): SimulationDoorDashProvider {
  return new SimulationDoorDashProvider();
}
