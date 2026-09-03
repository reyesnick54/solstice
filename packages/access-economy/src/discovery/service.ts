/**
 * ACCESS Wave 2 Prompt 31 — AccessDiscoveryService.
 *
 * Resolves canonical domain ports; never hard-codes vendor HTTP.
 */

import { AccessDiscoveryCache } from './cache.ts';
import { createAccessDiscoveryCapabilityRegistry } from './capabilities.ts';
import {
  assertDiscoveryOpportunity,
  assertReferencePriceNotBookingPrice,
  DISCOVERY_POSTURE,
} from './invariants.ts';
import { clampPageSize, clampRadiusKm, validateAccessSearchRequest } from './limits.ts';
import { normalizeChargingLocationToOpportunity } from './normalizers/charging.ts';
import { normalizeGbfsStationToOpportunity } from './normalizers/gbfs.ts';
import { normalizeParkToOpportunity } from './normalizers/nps.ts';
import { normalizeRecreationToOpportunity } from './normalizers/ridb.ts';
import { normalizeTransitRouteToOpportunity } from './normalizers/transit.ts';
import {
  assertPrivacySafeSearchRequest,
  generalizeLocationForProvider,
  privacySafeDiscoveryLogFields,
} from './privacy.ts';
import type { AccessDiscoveryPorts } from './ports.ts';
import type {
  AccessCapacityCategory,
  AccessDiscoveryOutcome,
  AccessOpportunity,
  AccessProviderCapabilityId,
  AccessSearchRequest,
  AccessSearchResult,
  DiscoveryGeography,
  DiscoveryFreshness,
} from './types.ts';

export type AccessDiscoveryServiceOptions = {
  readonly ports: AccessDiscoveryPorts;
  readonly cache?: AccessDiscoveryCache;
  readonly nowUtc?: () => string;
};

export class AccessDiscoveryService {
  readonly #ports: AccessDiscoveryPorts;
  readonly #cache: AccessDiscoveryCache;
  readonly #nowUtc: () => string;
  readonly capabilities = createAccessDiscoveryCapabilityRegistry();

  constructor(options: AccessDiscoveryServiceOptions) {
    this.#ports = options.ports;
    this.#cache = options.cache ?? new AccessDiscoveryCache();
    this.#nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  get posture(): typeof DISCOVERY_POSTURE {
    return DISCOVERY_POSTURE;
  }

  getProviderCapabilities(providerId: import('./types.ts').AccessDiscoveryProviderId) {
    return this.capabilities.get(providerId);
  }

  searchOpportunities(request: AccessSearchRequest): AccessDiscoveryOutcome<AccessSearchResult> {
    const validationError = validateAccessSearchRequest(request);
    if (validationError) {
      return Object.freeze({ ok: false, code: validationError.code, message: validationError.message });
    }
    const privacy = assertPrivacySafeSearchRequest(request);
    if (!privacy.ok) {
      return Object.freeze({ ok: false, code: 'PRIVACY_VIOLATION', message: privacy.message });
    }

    const pageSize = clampPageSize(request.pageSize);
    const query = request.query ?? '';
    const cacheKey = `search:${request.category}:${query}:${request.page}:${pageSize}:${request.location?.latitude}:${request.location?.longitude}`;
    const cached = this.#cache.get<AccessOpportunity[]>(cacheKey);
    if (cached) {
      return Object.freeze({
        ok: true,
        value: this.#buildSearchResult(cached.value, request, cached.stale),
      });
    }

    const collected: AccessOpportunity[] = [];
    const retrievedAt = this.#nowUtc();

    if (!request.category || request.category === 'TRANSPORTATION' || request.category === 'TRAVEL') {
      const transit = this.#ports.travel.searchTransit(query, pageSize);
      if (transit.ok) {
        for (const row of transit.value) {
          collected.push(normalizeTransitRouteToOpportunity(row, retrievedAt));
        }
      }
    }

    if (!request.category || request.category === 'TRANSPORTATION' || request.category === 'VEHICLE_HOURS') {
      if (request.location) {
        const generalized = generalizeLocationForProvider({
          ...request.location,
          radiusKm: clampRadiusKm(request.location.radiusKm),
        });
        const geo = {
          ...request.location,
          latitude: generalized.latitude,
          longitude: generalized.longitude,
          radiusKm: generalized.radiusKm,
        };
        const gbfs = this.#ports.mobility.searchGbfsStations(geo, pageSize);
        if (gbfs.ok) {
          for (const row of gbfs.value) {
            collected.push(normalizeGbfsStationToOpportunity(row, retrievedAt));
          }
        }
      }
    }

    if (!request.category || request.category === 'ENERGY' || request.category === 'VEHICLE_HOURS') {
      if (request.location) {
        const generalized = generalizeLocationForProvider({
          ...request.location,
          radiusKm: clampRadiusKm(request.location.radiusKm),
        });
        const geo = {
          ...request.location,
          latitude: generalized.latitude,
          longitude: generalized.longitude,
          radiusKm: generalized.radiusKm,
        };
        const charging = this.#ports.travel.findChargingLocations(geo, pageSize);
        if (charging.ok) {
          for (const row of charging.value) {
            collected.push(normalizeChargingLocationToOpportunity(row, retrievedAt));
          }
        }
      }
    }

    if (!request.category || request.category === 'EXPERIENCES' || request.category === 'TRAVEL') {
      const parks = this.#ports.recreation.searchParks(query, pageSize);
      if (parks.ok) {
        for (const row of parks.value) {
          collected.push(normalizeParkToOpportunity(row, retrievedAt));
        }
      }
      const recreation = this.#ports.recreation.searchRecreationInventory(query, request.location, pageSize);
      if (recreation.ok) {
        for (const row of recreation.value) {
          collected.push(normalizeRecreationToOpportunity(row, retrievedAt));
        }
      }
    }

    if (request.location?.regionCode) {
      privacySafeDiscoveryLogFields({
        providerId: 'access-discovery',
        capability: 'SEARCH',
        category: request.category,
        hasLocation: true,
      });
      const env = this.#ports.environmental.getDestinationContext(request.location.regionCode);
      if (env.ok && env.value.severeWeather) {
        for (const opportunity of collected) {
          if (opportunity.status === 'AVAILABLE') {
            // environmental context may downgrade confidence but must not upgrade UNKNOWN → AVAILABLE
          }
        }
      }
    }

    const pageStart = (request.page - 1) * pageSize;
    const pageItems = collected.slice(pageStart, pageStart + pageSize);
    for (const item of pageItems) {
      assertDiscoveryOpportunity(item);
      assertReferencePriceNotBookingPrice(item.referencePrice);
    }

    this.#cache.set(cacheKey, pageItems, 'search_results');
    return Object.freeze({
      ok: true,
      value: this.#buildSearchResult(pageItems, request, false),
    });
  }

  getOpportunity(opportunityId: string): AccessDiscoveryOutcome<AccessOpportunity | null> {
    const search = this.searchOpportunities({
      category: null,
      location: null,
      startDate: null,
      endDate: null,
      units: null,
      unit: null,
      radiusKm: null,
      filters: Object.freeze({}),
      sort: 'relevance',
      page: 1,
      pageSize: 50,
      query: opportunityId.replace(/^opp_[a-z0-9]+_/, ''),
    });
    if (!search.ok) return search;
    const match = search.value.opportunities.find((row) => row.opportunityId === opportunityId) ?? null;
    return Object.freeze({ ok: true, value: match });
  }

  searchByCategory(category: AccessCapacityCategory, request: Omit<AccessSearchRequest, 'category'>) {
    return this.searchOpportunities(Object.freeze({ ...request, category }));
  }

  searchByLocation(location: DiscoveryGeography, request: Omit<AccessSearchRequest, 'location'>) {
    return this.searchOpportunities(Object.freeze({ ...request, location }));
  }

  getAvailability(opportunityId: string): AccessDiscoveryOutcome<{ readonly status: AccessOpportunity['status'] }> {
    const opportunity = this.getOpportunity(opportunityId);
    if (!opportunity.ok) return opportunity;
    if (!opportunity.value) {
      return Object.freeze({ ok: false, code: 'INVALID_PARAMETER', message: 'opportunity not found' });
    }
    return Object.freeze({ ok: true, value: Object.freeze({ status: opportunity.value.status }) });
  }

  getReferencePrice(opportunityId: string): AccessDiscoveryOutcome<AccessOpportunity['referencePrice']> {
    const opportunity = this.getOpportunity(opportunityId);
    if (!opportunity.ok) return opportunity;
    if (!opportunity.value) {
      return Object.freeze({ ok: false, code: 'INVALID_PARAMETER', message: 'opportunity not found' });
    }
    assertReferencePriceNotBookingPrice(opportunity.value.referencePrice);
    return Object.freeze({ ok: true, value: opportunity.value.referencePrice });
  }

  #buildSearchResult(
    opportunities: readonly AccessOpportunity[],
    request: AccessSearchRequest,
    stale: boolean,
  ): AccessSearchResult {
    const retrievedAt = this.#nowUtc();
    const freshness: DiscoveryFreshness = Object.freeze({
      retrievedAt,
      sourceTimestamp: null,
      freshnessStatus: stale ? 'stale' : 'fresh',
      stale,
    });
    const hasNext = opportunities.length >= clampPageSize(request.pageSize);
    return Object.freeze({
      opportunities,
      resultCount: opportunities.length,
      nextPage: hasNext ? request.page + 1 : null,
      status: stale ? 'DEGRADED' : 'OK',
      freshness,
      searchContext: Object.freeze({
        category: request.category,
        bounded: true,
        privacySafe: true,
      }),
    });
  }
}

export function createAccessDiscoveryService(options: AccessDiscoveryServiceOptions): AccessDiscoveryService {
  return new AccessDiscoveryService(options);
}
