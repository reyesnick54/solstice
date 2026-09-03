// @ts-nocheck
/**
 * ACCESS Wave 2 Prompt 31 — canonical access discovery data service.
 *
 * Composes GBFS/NPS/RIDB fixture providers. Transit and EV charging remain
 * owned by TravelIntelligenceService — Access consumes that service via ports.
 */

import { TravelIntelligenceService } from '../travel-intelligence/service.ts';
import type { AccessDiscoveryFixtureProviders } from './adapters/fixture-adapters.ts';
import { createAccessDiscoveryFixtureProviders } from './adapters/fixture-adapters.ts';
import { AccessDiscoveryDataCache } from './cache.ts';
import { clampDiscoveryLimit, clampDiscoveryRadius } from './limits.ts';
import type {
  AccessDiscoveryServiceResult,
  GbfsStationObservation,
  NpsParkRecord,
  RidbFacilityRecord,
} from './types.ts';

export type AccessDiscoveryDataServiceOptions = {
  readonly providers?: AccessDiscoveryFixtureProviders;
  readonly cache?: AccessDiscoveryDataCache;
  readonly travel?: TravelIntelligenceService;
};

export class AccessDiscoveryDataService {
  readonly #providers: AccessDiscoveryFixtureProviders;
  readonly #cache: AccessDiscoveryDataCache;
  readonly #travel: TravelIntelligenceService;

  constructor(options: AccessDiscoveryDataServiceOptions = {}) {
    this.#providers = options.providers ?? createAccessDiscoveryFixtureProviders();
    this.#cache = options.cache ?? new AccessDiscoveryDataCache();
    this.#travel = options.travel ?? new TravelIntelligenceService();
  }

  travelIntelligence(): TravelIntelligenceService {
    return this.#travel;
  }

  searchGbfsStations(
    latitude: number,
    longitude: number,
    radiusKm = 10,
    limit?: number,
  ): AccessDiscoveryServiceResult<readonly GbfsStationObservation[]> {
    const clamped = clampDiscoveryLimit(limit, 50);
    const radius = clampDiscoveryRadius(radiusKm);
    const key = `gbfs:${latitude}:${longitude}:${radius}:${clamped}`;
    const cached = this.#cache.get<readonly GbfsStationObservation[]>(key);
    if (cached) {
      return Object.freeze({
        data: cached.value,
        providerId: 'gbfs',
        stale: cached.stale,
        degraded: false,
        warnings: Object.freeze([]),
      });
    }
    const result = this.#providers.gbfs.searchStations(latitude, longitude, radius, clamped);
    this.#cache.set(key, result.data, 'gbfs_vehicle_availability');
    return Object.freeze({
      data: result.data,
      providerId: result.providerId,
      stale: result.stale,
      degraded: !this.#providers.gbfs.health().healthy,
      warnings: Object.freeze([]),
    });
  }

  searchParks(query: string, limit?: number): AccessDiscoveryServiceResult<readonly NpsParkRecord[]> {
    const clamped = clampDiscoveryLimit(limit, 50);
    const key = `nps:${query}:${clamped}`;
    const cached = this.#cache.get<readonly NpsParkRecord[]>(key);
    if (cached) {
      return Object.freeze({
        data: cached.value,
        providerId: 'national-park-service',
        stale: cached.stale,
        degraded: false,
        warnings: Object.freeze([]),
      });
    }
    const result = this.#providers['national-park-service'].searchParks(query, clamped);
    this.#cache.set(key, result.data, 'nps_parks');
    return Object.freeze({
      data: result.data,
      providerId: result.providerId,
      stale: result.stale,
      degraded: !this.#providers['national-park-service'].health().healthy,
      warnings: Object.freeze([]),
    });
  }

  searchRecreationFacilities(
    query: string,
    limit?: number,
  ): AccessDiscoveryServiceResult<readonly RidbFacilityRecord[]> {
    const clamped = clampDiscoveryLimit(limit, 50);
    const key = `ridb:${query}:${clamped}`;
    const cached = this.#cache.get<readonly RidbFacilityRecord[]>(key);
    if (cached) {
      return Object.freeze({
        data: cached.value,
        providerId: 'recreation-gov-ridb',
        stale: cached.stale,
        degraded: false,
        warnings: Object.freeze([]),
      });
    }
    const result = this.#providers['recreation-gov-ridb'].searchFacilities(query, clamped);
    this.#cache.set(key, result.data, 'ridb_inventory');
    return Object.freeze({
      data: result.data,
      providerId: result.providerId,
      stale: result.stale,
      degraded: !this.#providers['recreation-gov-ridb'].health().healthy,
      warnings: Object.freeze([]),
    });
  }

  listProviderHealth() {
    return Object.freeze([
      this.#providers.gbfs.health(),
      this.#providers['national-park-service'].health(),
      this.#providers['recreation-gov-ridb'].health(),
    ]);
  }
}

export function createAccessDiscoveryDataSandbox(): AccessDiscoveryDataService {
  return new AccessDiscoveryDataService();
}
