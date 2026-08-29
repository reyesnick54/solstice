import type { AccessProvider, ProviderRightKind } from '../../types.ts';
import { PROVIDER_CAPABILITY_REGISTRY } from '../../capabilities.ts';
import { bookingIdFor, buildQuote, fail, ok, quoteIdFor, reservationIdFor, SIMULATION_NOW } from '../shared.ts';
import { AMAZON_PROVIDER_CONTRACT } from './contract.ts';

const CONSUMABLE_ITEM = Object.freeze({
  catalogItemId: 'amazon_household_consumable',
  category: 'GOODS' as const,
  canonicalUnit: 'CONSUMPTION_RIGHT' as const,
  title: 'Household consumable bundle',
  description: 'Delivered consumable; not temporary access.',
  location: null,
  serviceClass: 'STANDARD',
  rightKind: 'DELIVERY_RIGHT' as const,
});

const OWNERSHIP_ITEM = Object.freeze({
  catalogItemId: 'amazon_permitted_product',
  category: 'GOODS' as const,
  canonicalUnit: 'OWNERSHIP_PURCHASE' as const,
  title: 'Permitted product purchase',
  description: 'Permanent ownership transfer when policy allows.',
  location: null,
  serviceClass: 'STANDARD',
  rightKind: 'OWNERSHIP_PURCHASE' as const,
});

function resolveItem(query: string): (typeof CONSUMABLE_ITEM | typeof OWNERSHIP_ITEM) | null {
  const haystack = query.toLowerCase();
  if (haystack.includes('own') || haystack.includes('purchase')) {
    return OWNERSHIP_ITEM;
  }
  if (haystack.includes('consumable') || haystack.includes('delivery') || haystack.includes('product')) {
    return CONSUMABLE_ITEM;
  }
  return null;
}

export class SimulationAmazonProvider implements AccessProvider {
  readonly providerId = 'amazon' as const;
  readonly displayName = 'Simulation Amazon';
  readonly integrationState = 'SIMULATED' as const;
  readonly capabilities = PROVIDER_CAPABILITY_REGISTRY.amazon.capabilities.map((row) =>
    Object.freeze({ ...row, integrationState: 'SIMULATED' as const }),
  );

  health() {
    return Object.freeze({
      providerId: this.providerId,
      integrationState: 'SIMULATED' as const,
      healthy: true,
      lastCheckedAt: SIMULATION_NOW,
      message: AMAZON_PROVIDER_CONTRACT.notes,
    });
  }

  search(request: import('../../types.ts').ProviderSearchRequest) {
    const item = resolveItem(request.query);
    if (!item) {
      return fail('NO_MATCH', 'no simulation Amazon catalog item matches this search');
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        items: Object.freeze([Object.freeze({ ...item, providerId: this.providerId })]),
        simulationOnly: true as const,
      }),
    );
  }

  availability(request: import('../../types.ts').ProviderAvailabilityRequest) {
    if (request.catalogItemId !== CONSUMABLE_ITEM.catalogItemId && request.catalogItemId !== OWNERSHIP_ITEM.catalogItemId) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        providerId: this.providerId,
        available: true,
        availableQuantity: 99n,
        earliestStart: SIMULATION_NOW,
        reason: 'simulation commerce availability',
        simulationOnly: true,
      }),
    );
  }

  quote(request: import('../../types.ts').ProviderQuoteRequest) {
    const isOwnership = request.catalogItemId === OWNERSHIP_ITEM.catalogItemId;
    const isConsumable = request.catalogItemId === CONSUMABLE_ITEM.catalogItemId;
    if (!isOwnership && !isConsumable) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    const unitPrice = isOwnership ? 15_999n : 3_499n;
    return ok(
      buildQuote({
        quoteId: quoteIdFor(request.idempotencyKey),
        providerId: this.providerId,
        catalogItemId: request.catalogItemId,
        canonicalUnit: isOwnership ? 'OWNERSHIP_PURCHASE' : 'CONSUMPTION_RIGHT',
        quantity: request.quantity,
        providerPriceMinorUnits: unitPrice * request.quantity,
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
    const rightKind: ProviderRightKind =
      request.reservationId.includes(OWNERSHIP_ITEM.catalogItemId) ? 'OWNERSHIP_PURCHASE' : 'DELIVERY_RIGHT';
    return ok(
      Object.freeze({
        bookingId: bookingIdFor(request.idempotencyKey),
        providerId: this.providerId,
        reservationId: request.reservationId,
        state: 'CONFIRMED',
        rightKind,
        accessRightRef: rightKind === 'OWNERSHIP_PURCHASE' ? null : `dr_${request.reservationId}`,
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

export function createSimulationAmazonProvider(): SimulationAmazonProvider {
  return new SimulationAmazonProvider();
}
