/**
 * ACCESS-14 — Access Provider Gateway.
 *
 * Provider-neutral facade over registered adapters. External provider models
 * stop at adapter boundaries.
 */

import { createSimulationAirbnbProvider } from './adapters/airbnb/simulation.ts';
import { createSimulationAmazonProvider } from './adapters/amazon/simulation.ts';
import { createSimulationDoorDashProvider } from './adapters/doordash/simulation.ts';
import { createExpediaProvider } from './adapters/expedia/factory.ts';
import { createSimulationTuroProvider } from './adapters/turo/simulation.ts';
import { DISCOVERY_PROVIDER_IDS } from './types.ts';
import { fail as providerFail } from './adapters/shared.ts';
import { ProviderCapabilityRegistry, createProviderCapabilityRegistry } from './capabilities.ts';
import type {
  AccessProvider,
  AccessProviderId,
  AccessProviderOutcome,
  ProviderAvailabilityRequest,
  ProviderAvailabilityResult,
  ProviderBooking,
  ProviderBookingRequest,
  ProviderCancellation,
  ProviderCancellationRequest,
  ProviderCapabilityId,
  ProviderHealth,
  ProviderQuote,
  ProviderQuoteRequest,
  ProviderReservation,
  ProviderReservationRequest,
  ProviderSearchRequest,
  ProviderSearchResult,
} from './types.ts';

function createDiscoveryOnlyProvider(providerId: (typeof DISCOVERY_PROVIDER_IDS)[number]): AccessProvider {
  const unsupported = () => providerFail('DISCOVERY_ONLY', `${providerId} is discovery-only`);
  return Object.freeze({
    providerId,
    displayName: `${providerId} (discovery)`,
    integrationState: 'DOCUMENTED_NOT_CONNECTED',
    capabilities: Object.freeze([]),
    health: () =>
      Object.freeze({
        providerId,
        integrationState: 'DOCUMENTED_NOT_CONNECTED',
        healthy: true,
        lastCheckedAt: '2026-08-31T09:00:00.000Z',
        message: 'discovery-only provider',
      }),
    search: unsupported,
    availability: unsupported,
    quote: unsupported,
    reserve: unsupported,
    book: unsupported,
    cancel: unsupported,
  });
}

export class AccessProviderGateway {
  private readonly providers: Readonly<Record<AccessProviderId, AccessProvider>>;
  readonly registry: ProviderCapabilityRegistry;

  constructor(input?: { readonly providers?: Partial<Record<AccessProviderId, AccessProvider>> }) {
    this.registry = createProviderCapabilityRegistry();
    this.providers = Object.freeze({
      expedia: input?.providers?.expedia ?? createExpediaProvider(),
      turo: input?.providers?.turo ?? createSimulationTuroProvider(),
      doordash: input?.providers?.doordash ?? createSimulationDoorDashProvider(),
      amazon: input?.providers?.amazon ?? createSimulationAmazonProvider(),
      airbnb: input?.providers?.airbnb ?? createSimulationAirbnbProvider(),
      gbfs_mobility: input?.providers?.gbfs_mobility ?? createDiscoveryOnlyProvider('gbfs_mobility'),
      travel_discovery: input?.providers?.travel_discovery ?? createDiscoveryOnlyProvider('travel_discovery'),
      experiences_discovery:
        input?.providers?.experiences_discovery ?? createDiscoveryOnlyProvider('experiences_discovery'),
      hotels_discovery: input?.providers?.hotels_discovery ?? createDiscoveryOnlyProvider('hotels_discovery'),
      transportation_discovery:
        input?.providers?.transportation_discovery ?? createDiscoveryOnlyProvider('transportation_discovery'),
      compute_discovery: input?.providers?.compute_discovery ?? createDiscoveryOnlyProvider('compute_discovery'),
    });
  }

  listProviders() {
    return this.registry.list();
  }

  getProvider(providerId: AccessProviderId): AccessProvider | null {
    return this.providers[providerId] ?? null;
  }

  health(providerId: AccessProviderId): ProviderHealth {
    return this.providers[providerId].health();
  }

  private ensureCapability<T>(
    providerId: AccessProviderId,
    capabilityId: ProviderCapabilityId,
    execute: () => AccessProviderOutcome<T>,
  ): AccessProviderOutcome<T> {
    const provider = this.providers[providerId];
    const health = provider.health();
    if (health.integrationState === 'LIVE_ENABLED') {
      return execute();
    }
    if (health.integrationState === 'SIMULATED' || health.integrationState === 'SANDBOX_AVAILABLE') {
      const registration = this.registry.get(providerId);
      const row = registration?.capabilities.find((candidate) => candidate.capabilityId === capabilityId);
      if (!row?.supported) {
        return Object.freeze({
          ok: false,
          code: 'CAPABILITY_UNAVAILABLE',
          message: `${providerId} does not support ${capabilityId}`,
        });
      }
      return execute();
    }
    if (!this.registry.canPerform(providerId, capabilityId)) {
      return Object.freeze({
        ok: false,
        code: 'CAPABILITY_UNAVAILABLE',
        message: `${providerId} does not support ${capabilityId}`,
      });
    }
    return execute();
  }

  search(request: ProviderSearchRequest & { readonly providerId?: AccessProviderId }): AccessProviderOutcome<ProviderSearchResult> {
    if (request.providerId) {
      return this.ensureCapability(request.providerId, 'CATALOG_SEARCH', () => this.providers[request.providerId!].search(request));
    }
    const merged: ProviderSearchResult['items'][number][] = [];
    for (const providerId of Object.keys(this.providers) as AccessProviderId[]) {
      const outcome = this.ensureCapability(providerId, 'CATALOG_SEARCH', () => this.providers[providerId].search(request));
      if (outcome.ok) {
        merged.push(...outcome.value.items);
      }
    }
    if (merged.length === 0) {
      return Object.freeze({ ok: false, code: 'NO_MATCH', message: 'no provider catalog items matched search' });
    }
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        requestId: request.requestId,
        items: Object.freeze(merged),
        simulationOnly: merged.every((item) => item.providerId !== 'expedia'),
        ...(merged.some((item) => item.providerId === 'expedia') ? { sandboxOnly: true as const } : {}),
      }),
    });
  }

  availability(request: ProviderAvailabilityRequest): AccessProviderOutcome<ProviderAvailabilityResult> {
    return this.ensureCapability(request.providerId, 'AVAILABILITY', () => this.providers[request.providerId].availability(request));
  }

  quote(request: ProviderQuoteRequest): AccessProviderOutcome<ProviderQuote> {
    return this.ensureCapability(request.providerId, 'QUOTE', () => this.providers[request.providerId].quote(request));
  }

  reserve(request: ProviderReservationRequest): AccessProviderOutcome<ProviderReservation> {
    return this.ensureCapability(request.providerId, 'RESERVE', () => this.providers[request.providerId].reserve(request));
  }

  book(request: ProviderBookingRequest): AccessProviderOutcome<ProviderBooking> {
    return this.ensureCapability(request.providerId, 'BOOK', () => this.providers[request.providerId].book(request));
  }

  cancel(request: ProviderCancellationRequest): AccessProviderOutcome<ProviderCancellation> {
    return this.ensureCapability(request.providerId, 'CANCEL', () => this.providers[request.providerId].cancel(request));
  }
}

export function createAccessProviderGateway(): AccessProviderGateway {
  return new AccessProviderGateway();
}
