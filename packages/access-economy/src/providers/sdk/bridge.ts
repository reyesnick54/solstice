/**
 * ACCESS Wave 2 — Bridge from legacy ACCESS-14 AccessProvider to SDK contracts.
 */

import type { AccessCapacityCategory } from '../../taxonomy.ts';
import type {
  AccessProvider as LegacyAccessProvider,
  AccessProviderId,
  AccessProviderOutcome,
  ProviderCapabilityId,
} from '../types.ts';
import type { AccessProvider, AccessProviderRuntimeContext } from './contract.ts';
import type { AccessProviderDescriptor } from './descriptor.ts';
import { ACCESS_PROVIDER_DESCRIPTORS } from './descriptors.ts';
import { createDefaultHealthFromDescriptor } from './registry.ts';
import { createHealthSnapshot } from './health.ts';
import type { AccessProviderHealthSnapshot } from './health.ts';
import type {
  AccessAvailabilityRequest,
  AccessAvailabilityResult,
  AccessBooking,
  AccessBookingRequest,
  AccessCancellation,
  AccessCancellationRequest,
  AccessFulfillmentProvider,
  AccessInventoryProvider,
  AccessInventorySearchRequest,
  AccessInventorySearchResult,
  AccessProviderQuote,
  AccessQuoteRequest,
  AccessReservation,
  AccessReservationRequest,
} from './interfaces.ts';
import type { AccessOpportunity, AccessProduct } from './domain-types.ts';
import { buildProviderCostMetadata } from './cost-model.ts';

const SIMULATION_NOW = '2026-08-31T09:00:00.000Z';

function ok<T>(value: T): AccessProviderOutcome<T> {
  return Object.freeze({ ok: true, value });
}

function fail(code: string, message: string): AccessProviderOutcome<never> {
  return Object.freeze({ ok: false, code, message });
}

function catalogItemToProduct(
  item: import('../types.ts').ProviderCatalogItem,
): AccessProduct {
  return Object.freeze({
    productId: item.catalogItemId,
    providerId: item.providerId,
    category: item.category,
    canonicalUnit: item.canonicalUnit,
    title: item.title,
    description: item.description,
    location: item.location,
    serviceClass: item.serviceClass,
    rightKind: item.rightKind,
    geography: item.location,
    metadata: Object.freeze({}),
  });
}

export function bridgeLegacyProvider(
  legacy: LegacyAccessProvider,
  descriptorOverride?: Partial<AccessProviderDescriptor>,
): AccessInventoryProvider & AccessFulfillmentProvider & AccessProvider {
  const baseDescriptor = ACCESS_PROVIDER_DESCRIPTORS[legacy.providerId];
  const descriptor = Object.freeze({
  ...(baseDescriptor ?? {
      providerId: legacy.providerId,
      name: legacy.displayName,
      providerTypes: Object.freeze(['HYBRID']),
      categories: Object.freeze([] as AccessCapacityCategory[]),
      capabilities: Object.freeze(legacy.capabilities.filter((c) => c.supported).map((c) => c.capabilityId)),
      geographies: Object.freeze(['GLOBAL']),
      environment: 'SIMULATION',
      activationState: 'PREVIEW',
      commercialStatus: 'NONE',
      credentialStatus: 'UNKNOWN',
      fulfillmentModel: 'DIRECT',
      settlementModel: 'OTHER',
      supportsIdempotency: true,
      supportsWebhooks: false,
      supportsReconciliation: false,
      contractRef: null,
      metadata: Object.freeze({}),
    }),
    ...(descriptorOverride ?? {}),
  }) as AccessProviderDescriptor;

  let lastSuccessAt: string | null = SIMULATION_NOW;
  let lastFailureAt: string | null = null;

  const bridged: AccessInventoryProvider & AccessFulfillmentProvider & AccessProvider = {
    id: legacy.providerId,
    descriptor,

    async initialize(_context: AccessProviderRuntimeContext): Promise<void> {
      // Legacy providers are stateless on main.
    },

    async healthCheck(): Promise<AccessProviderHealthSnapshot> {
      const health = legacy.health();
      const snapshot = createHealthSnapshot({
        providerId: legacy.providerId,
        capabilities: descriptor.capabilities,
        health: health.healthy ? 'HEALTHY' : 'UNHEALTHY',
        lastSuccessAt,
        lastFailureAt,
        latencyMs: 12,
        activationState: descriptor.activationState,
        credentialStatus: descriptor.credentialStatus,
        contractStatus: descriptor.commercialStatus,
        message: health.message,
        checkedAt: health.lastCheckedAt,
      });
      return snapshot;
    },

    getCapabilities(): readonly ProviderCapabilityId[] {
      return descriptor.capabilities;
    },

    async shutdown(): Promise<void> {
      // no-op
    },

    search(request: AccessInventorySearchRequest): AccessProviderOutcome<AccessInventorySearchResult> {
      const outcome = legacy.search({
        requestId: request.requestId,
        category: request.category,
        query: request.query,
        location: request.geography,
        limit: request.limit,
      });
      if (!outcome.ok) {
        lastFailureAt = SIMULATION_NOW;
        return outcome;
      }
      lastSuccessAt = SIMULATION_NOW;
      const opportunities: AccessOpportunity[] = outcome.value.items.map((item) =>
        Object.freeze({
          opportunityId: `opp_${item.catalogItemId}`,
          providerId: item.providerId,
          product: catalogItemToProduct(item),
          availableQuantity: 4n,
          earliestStart: null,
          latestEnd: null,
          cost: buildProviderCostMetadata({ currency: 'USD' }),
          simulationOnly: outcome.value.simulationOnly,
          ...(outcome.value.sandboxOnly ? { sandboxOnly: true as const } : {}),
          discoveredAt: SIMULATION_NOW,
        }),
      );
      return ok(
        Object.freeze({
          requestId: request.requestId,
          opportunities: Object.freeze(opportunities),
          simulationOnly: outcome.value.simulationOnly,
          ...(outcome.value.sandboxOnly ? { sandboxOnly: true as const } : {}),
        }),
      );
    },

    getAvailability(request: AccessAvailabilityRequest): AccessProviderOutcome<AccessAvailabilityResult> {
      const outcome = legacy.availability({
        requestId: request.requestId,
        providerId: legacy.providerId,
        catalogItemId: request.productId,
        quantity: request.quantity,
        startsAt: request.startsAt,
        endsAt: request.endsAt,
        location: request.geography,
      });
      if (!outcome.ok) {
        lastFailureAt = SIMULATION_NOW;
        return outcome;
      }
      lastSuccessAt = SIMULATION_NOW;
      return ok(
        Object.freeze({
          requestId: request.requestId,
          providerId: legacy.providerId,
          available: outcome.value.available,
          availableQuantity: outcome.value.availableQuantity,
          reason: outcome.value.reason,
          simulationOnly: outcome.value.simulationOnly,
          ...(outcome.value.sandboxOnly ? { sandboxOnly: true as const } : {}),
        }),
      );
    },

    getInventory(productId: string): AccessProviderOutcome<AccessProduct> {
      const search = legacy.search({
        requestId: `inv_${productId}`,
        category: descriptor.categories[0] ?? 'TRAVEL',
        query: productId,
        location: null,
        limit: 1,
      });
      if (!search.ok) {
        return search;
      }
      const item = search.value.items.find((row) => row.catalogItemId === productId);
      if (!item) {
        return fail('NOT_FOUND', 'product not found');
      }
      return ok(catalogItemToProduct(item));
    },

    reserve(request: AccessReservationRequest): AccessProviderOutcome<AccessReservation> {
      const outcome = legacy.reserve({
        requestId: request.requestId,
        providerId: legacy.providerId,
        quoteId: request.quoteId,
        subjectRef: request.subjectRef,
        idempotencyKey: request.idempotencyKey,
      });
      if (!outcome.ok) {
        lastFailureAt = SIMULATION_NOW;
        return outcome;
      }
      lastSuccessAt = SIMULATION_NOW;
      return ok(
        Object.freeze({
          reservationId: outcome.value.reservationId,
          providerId: legacy.providerId,
          quoteId: outcome.value.quoteId,
          state: outcome.value.state,
          expiresAt: outcome.value.expiresAt,
          simulationOnly: outcome.value.simulationOnly,
          ...(outcome.value.sandboxOnly ? { sandboxOnly: true as const } : {}),
        }),
      );
    },

    book(request: AccessBookingRequest): AccessProviderOutcome<AccessBooking> {
      const outcome = legacy.book({
        requestId: request.requestId,
        providerId: legacy.providerId,
        reservationId: request.reservationId,
        subjectRef: request.subjectRef,
        idempotencyKey: request.idempotencyKey,
      });
      if (!outcome.ok) {
        lastFailureAt = SIMULATION_NOW;
        return outcome;
      }
      lastSuccessAt = SIMULATION_NOW;
      return ok(
        Object.freeze({
          bookingId: outcome.value.bookingId,
          providerId: legacy.providerId,
          reservationId: outcome.value.reservationId,
          state: outcome.value.state,
          simulationOnly: outcome.value.simulationOnly,
          ...(outcome.value.sandboxOnly ? { sandboxOnly: true as const } : {}),
        }),
      );
    },

    cancel(request: AccessCancellationRequest): AccessProviderOutcome<AccessCancellation> {
      const outcome = legacy.cancel({
        requestId: request.requestId,
        providerId: legacy.providerId,
        bookingId: request.bookingId,
        reason: request.reason,
        idempotencyKey: request.idempotencyKey,
      });
      if (!outcome.ok) {
        lastFailureAt = SIMULATION_NOW;
        return outcome;
      }
      lastSuccessAt = SIMULATION_NOW;
      return ok(
        Object.freeze({
          cancellationId: outcome.value.cancellationId,
          providerId: legacy.providerId,
          bookingId: outcome.value.bookingId,
          state: outcome.value.state,
          simulationOnly: outcome.value.simulationOnly,
        }),
      );
    },
  };

  // Add quote if legacy supports it
  const quoteProvider = bridged as AccessInventoryProvider & AccessFulfillmentProvider & AccessProvider & {
    getQuote(request: AccessQuoteRequest): AccessProviderOutcome<AccessProviderQuote>;
  };
  quoteProvider.getQuote = (request: AccessQuoteRequest): AccessProviderOutcome<AccessProviderQuote> => {
    const outcome = legacy.quote({
      requestId: request.requestId,
      providerId: legacy.providerId,
      catalogItemId: request.productId,
      quantity: request.quantity,
      startsAt: request.startsAt,
      endsAt: request.endsAt,
      location: request.geography,
      idempotencyKey: request.idempotencyKey,
    });
    if (!outcome.ok) {
      lastFailureAt = SIMULATION_NOW;
      return outcome;
    }
    lastSuccessAt = SIMULATION_NOW;
    return ok(
      Object.freeze({
        quoteId: outcome.value.quoteId,
        providerId: legacy.providerId,
        productId: request.productId,
        quantity: outcome.value.quantity,
        priceMinorUnits: outcome.value.providerPriceMinorUnits,
        currency: outcome.value.currency,
        expiresAt: outcome.value.expiresAt,
        simulationOnly: outcome.value.simulationOnly,
        ...(outcome.value.sandboxOnly ? { sandboxOnly: true as const } : {}),
        providerRateToken: outcome.value.providerRateToken ?? null,
      }),
    );
  };

  return quoteProvider;
}

export function createBridgedHealth(descriptor: AccessProviderDescriptor): AccessProviderHealthSnapshot {
  return createDefaultHealthFromDescriptor(descriptor);
}
