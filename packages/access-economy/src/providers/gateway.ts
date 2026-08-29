/**
 * ACCESS-14 — Access Provider Gateway.
 *
 * Provider-neutral facade over registered adapters. External provider models
 * stop at adapter boundaries.
 */

import { createSimulationAirbnbProvider } from './adapters/airbnb/simulation.ts';
import { createSimulationAmazonProvider } from './adapters/amazon/simulation.ts';
import { createSimulationDoorDashProvider } from './adapters/doordash/simulation.ts';
import { createSimulationExpediaProvider } from './adapters/expedia/simulation.ts';
import { createSimulationTuroProvider } from './adapters/turo/simulation.ts';
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

export class AccessProviderGateway {
  private readonly providers: Readonly<Record<AccessProviderId, AccessProvider>>;
  readonly registry: ProviderCapabilityRegistry;

  constructor(input?: { readonly providers?: Partial<Record<AccessProviderId, AccessProvider>> }) {
    this.registry = createProviderCapabilityRegistry();
    this.providers = Object.freeze({
      expedia: input?.providers?.expedia ?? createSimulationExpediaProvider(),
      turo: input?.providers?.turo ?? createSimulationTuroProvider(),
      doordash: input?.providers?.doordash ?? createSimulationDoorDashProvider(),
      amazon: input?.providers?.amazon ?? createSimulationAmazonProvider(),
      airbnb: input?.providers?.airbnb ?? createSimulationAirbnbProvider(),
    });
  }

  listProviders() {
    return this.registry.list();
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
    if (health.integrationState === 'SIMULATED') {
      const registration = this.registry.get(providerId);
      const row = registration?.capabilities.find((candidate) => candidate.capabilityId === capabilityId);
      if (!row?.supported) {
        return Object.freeze({
          ok: false,
          code: 'CAPABILITY_UNAVAILABLE',
          message: `${providerId} does not support ${capabilityId} in simulation`,
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
      value: Object.freeze({ requestId: request.requestId, items: Object.freeze(merged), simulationOnly: true }),
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
