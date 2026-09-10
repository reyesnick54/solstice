/**
 * Live Provider Capability Registry — extends ACCESS-14 registry pattern.
 */

import type { LiveAccessProviderAdapter, LiveAccessProviderId, LiveProviderRegistration } from './types.ts';
import {
  createEbayLiveAdapter,
  createEiaLiveAdapter,
  createFrankfurterLiveAdapter,
  createGooglePlacesLiveAdapter,
  createOpenChargeMapLiveAdapter,
  createTicketmasterLiveAdapter,
  createVastAiLiveAdapter,
  createWorldBankLiveAdapter,
  createYelpLiveAdapter,
} from './adapters/index.ts';
import type { BaseLiveAdapterDeps } from './adapters/base.ts';
import type { AccessCapacityCategory } from './taxonomy.ts';

export type PartnerGatedProviderStatus = {
  readonly providerId: string;
  readonly displayName: string;
  readonly integrationState: string;
  readonly categories: readonly string[];
};

/** Partner-gated commercial providers preserved for directory visibility. */
export const PARTNER_GATED_PROVIDER_STATUS: readonly PartnerGatedProviderStatus[] = Object.freeze([
  Object.freeze({
    providerId: 'expedia',
    displayName: 'Expedia Rapid',
    integrationState: 'SANDBOX_AVAILABLE',
    categories: Object.freeze(['HOUSING_ROOM_NIGHTS', 'TRAVEL']),
  }),
  Object.freeze({
    providerId: 'turo',
    displayName: 'Turo',
    integrationState: 'PARTNER_APPROVAL_REQUIRED',
    categories: Object.freeze(['VEHICLE_HOURS']),
  }),
  Object.freeze({
    providerId: 'doordash',
    displayName: 'DoorDash',
    integrationState: 'PARTNER_APPROVAL_REQUIRED',
    categories: Object.freeze(['FOOD']),
  }),
  Object.freeze({
    providerId: 'amazon',
    displayName: 'Amazon',
    integrationState: 'PARTNER_APPROVAL_REQUIRED',
    categories: Object.freeze(['GOODS']),
  }),
  Object.freeze({
    providerId: 'airbnb',
    displayName: 'Airbnb',
    integrationState: 'PARTNER_APPROVAL_REQUIRED',
    categories: Object.freeze(['HOUSING_ROOM_NIGHTS', 'EXPERIENCES']),
  }),
]);

export class LiveProviderCapabilityRegistry {
  private readonly adapters = new Map<LiveAccessProviderId, LiveAccessProviderAdapter>();

  constructor(deps: BaseLiveAdapterDeps = {}) {
    this.register(createVastAiLiveAdapter(deps));
    this.register(createTicketmasterLiveAdapter(deps));
    this.register(createEiaLiveAdapter(deps));
    this.register(createOpenChargeMapLiveAdapter(deps));
    this.register(createEbayLiveAdapter(deps));
    this.register(createGooglePlacesLiveAdapter(deps));
    this.register(createYelpLiveAdapter(deps));
    this.register(createFrankfurterLiveAdapter(deps));
    this.register(createWorldBankLiveAdapter(deps));
  }

  register(adapter: LiveAccessProviderAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  get(providerId: LiveAccessProviderId): LiveAccessProviderAdapter | null {
    return this.adapters.get(providerId) ?? null;
  }

  list(): readonly LiveAccessProviderAdapter[] {
    return Object.freeze([...this.adapters.values()]);
  }

  listRegistrations(): readonly LiveProviderRegistration[] {
    return Object.freeze(this.list().map((adapter) => adapter.registration()));
  }

  listByCategory(category: AccessCapacityCategory): readonly LiveAccessProviderAdapter[] {
    return Object.freeze(
      this.list().filter((adapter) => adapter.registration().categories.includes(category)),
    );
  }
}

export function createLiveProviderCapabilityRegistry(deps?: BaseLiveAdapterDeps): LiveProviderCapabilityRegistry {
  return new LiveProviderCapabilityRegistry(deps);
}
