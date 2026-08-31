/**
 * ACCESS Wave 2 Prompt 31 — discovery provider capability registry.
 */

import type { AccessDiscoveryProviderId, AccessProviderCapability, AccessProviderCapabilityId } from './types.ts';
import { ACCESS_DISCOVERY_PROVIDER_IDS, ACCESS_PROVIDER_CAPABILITY_IDS } from './types.ts';

function cap(
  capabilityId: AccessProviderCapabilityId,
  supported: boolean,
  notes: string | null = null,
): AccessProviderCapability {
  return Object.freeze({ capabilityId, supported, notes });
}

function discoveryOnly(capabilityIds: readonly AccessProviderCapabilityId[], notes: string): readonly AccessProviderCapability[] {
  return Object.freeze(
    ACCESS_PROVIDER_CAPABILITY_IDS.map((capabilityId) =>
      cap(capabilityId, capabilityIds.includes(capabilityId), capabilityIds.includes(capabilityId) ? notes : 'not supported by this open-data provider'),
    ),
  );
}

export type AccessDiscoveryProviderRegistration = {
  readonly providerId: AccessDiscoveryProviderId;
  readonly displayName: string;
  readonly categories: readonly string[];
  readonly capabilities: readonly AccessProviderCapability[];
  readonly geographicCoverage: readonly string[];
  readonly simulationOnly: true;
};

export const ACCESS_DISCOVERY_PROVIDER_REGISTRY: Readonly<Record<AccessDiscoveryProviderId, AccessDiscoveryProviderRegistration>> =
  Object.freeze({
    gbfs: Object.freeze({
      providerId: 'gbfs',
      displayName: 'GBFS Shared Mobility Feeds',
      categories: Object.freeze(['TRANSPORTATION', 'VEHICLE_HOURS']),
      capabilities: discoveryOnly(
        ['DISCOVER', 'SEARCH', 'AVAILABILITY', 'LOCATION', 'STATUS', 'REFERENCE_PRICE', 'INVENTORY_METADATA'],
        'fixture GBFS feed — discovery/availability only',
      ),
      geographicCoverage: Object.freeze(['city_feeds']),
      simulationOnly: true,
    }),
    transitland: Object.freeze({
      providerId: 'transitland',
      displayName: 'Transitland',
      categories: Object.freeze(['TRANSPORTATION', 'TRAVEL']),
      capabilities: discoveryOnly(
        ['DISCOVER', 'SEARCH', 'AVAILABILITY', 'LOCATION', 'STATUS', 'SCHEDULE', 'INVENTORY_METADATA'],
        'reuses canonical TravelIntelligenceService transit adapter',
      ),
      geographicCoverage: Object.freeze(['global_transit_feeds']),
      simulationOnly: true,
    }),
    'transport-rest': Object.freeze({
      providerId: 'transport-rest',
      displayName: 'Transport REST (OpenAPI)',
      categories: Object.freeze(['TRANSPORTATION']),
      capabilities: discoveryOnly(
        ['DISCOVER', 'SEARCH', 'SCHEDULE', 'LOCATION', 'INVENTORY_METADATA'],
        'reuses canonical TravelIntelligenceService transit adapter',
      ),
      geographicCoverage: Object.freeze(['regional_feeds']),
      simulationOnly: true,
    }),
    'open-charge-map': Object.freeze({
      providerId: 'open-charge-map',
      displayName: 'Open Charge Map',
      categories: Object.freeze(['ENERGY', 'VEHICLE_HOURS']),
      capabilities: discoveryOnly(
        ['DISCOVER', 'SEARCH', 'LOCATION', 'STATUS', 'REFERENCE_PRICE', 'INVENTORY_METADATA'],
        'reuses canonical TravelIntelligenceService EV charging adapter',
      ),
      geographicCoverage: Object.freeze(['global']),
      simulationOnly: true,
    }),
    'national-park-service': Object.freeze({
      providerId: 'national-park-service',
      displayName: 'U.S. National Park Service',
      categories: Object.freeze(['EXPERIENCES', 'TRAVEL']),
      capabilities: discoveryOnly(
        ['DISCOVER', 'SEARCH', 'LOCATION', 'STATUS', 'SCHEDULE', 'INVENTORY_METADATA'],
        'public park/event/campground metadata — no ticket purchase',
      ),
      geographicCoverage: Object.freeze(['US_national_parks']),
      simulationOnly: true,
    }),
    'recreation-gov-ridb': Object.freeze({
      providerId: 'recreation-gov-ridb',
      displayName: 'Recreation.gov RIDB',
      categories: Object.freeze(['EXPERIENCES', 'TRAVEL']),
      capabilities: discoveryOnly(
        ['DISCOVER', 'SEARCH', 'LOCATION', 'STATUS', 'REFERENCE_PRICE', 'INVENTORY_METADATA'],
        'recreation inventory/reference data — no booking execution',
      ),
      geographicCoverage: Object.freeze(['US_federal_recreation']),
      simulationOnly: true,
    }),
  });

export class AccessDiscoveryCapabilityRegistry {
  list(): readonly AccessDiscoveryProviderRegistration[] {
    return Object.freeze(ACCESS_DISCOVERY_PROVIDER_IDS.map((id) => ACCESS_DISCOVERY_PROVIDER_REGISTRY[id]));
  }

  get(providerId: AccessDiscoveryProviderId): AccessDiscoveryProviderRegistration | null {
    return ACCESS_DISCOVERY_PROVIDER_REGISTRY[providerId] ?? null;
  }

  canPerform(providerId: AccessDiscoveryProviderId, capabilityId: AccessProviderCapabilityId): boolean {
    const registration = this.get(providerId);
    if (!registration) return false;
    const row = registration.capabilities.find((candidate) => candidate.capabilityId === capabilityId);
    return row?.supported === true;
  }
}

export function createAccessDiscoveryCapabilityRegistry(): AccessDiscoveryCapabilityRegistry {
  return new AccessDiscoveryCapabilityRegistry();
}
