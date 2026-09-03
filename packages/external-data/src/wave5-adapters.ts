// @ts-nocheck
/**
 * Wave 5 provider adapter registry with simulation fixtures.
 */

import { ProviderDataDeliveryService } from '../../sunrey-chain/src/provider-runtime/data-delivery/service.ts';
import {
  buildExternalObservation,
  canonicalJsonStringify,
  type ExternalObservation,
} from '../../provider-sdk/src/index.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import {
  FIXTURE_AVIATION,
  FIXTURE_COUNTRIES,
  FIXTURE_ELEVATIONS,
  FIXTURE_ENERGY,
  FIXTURE_ENVIRONMENTAL,
  FIXTURE_GEOCODE_RESULTS,
  FIXTURE_IP_GEO,
  FIXTURE_LOGISTICS,
  FIXTURE_MARITIME,
  FIXTURE_RESOURCES,
  FIXTURE_SHIPPING_FLOW,
  FIXTURE_TRANSIT,
  FIXTURE_WEATHER,
  WAVE5_MALFORMED_PROVIDER,
  WAVE5_RATE_LIMIT_PROVIDER,
  WAVE5_TIMEOUT_PROVIDER,
} from './wave5-fixtures.ts';
import type {
  AviationObservation,
  CountryMetadata,
  ElevationResult,
  EnergyObservation,
  EnvironmentalObservation,
  GeocodeResult,
  IpGeolocationResult,
  LogisticsObservation,
  MaritimeObservation,
  ResourceObservation,
  ShippingFlowObservation,
  TransitObservation,
  WeatherObservation,
} from './wave5-models.ts';
import type { ProviderAdapterState } from './adapters.ts';

export const WAVE5_IMPLEMENTED_PROVIDER_IDS = Object.freeze([
  'eia',
  'uk-carbon-intensity',
  'usgs-minerals',
  'openweathermap',
  'open-meteo',
  'usgs-water',
  'openaq',
  'opensky',
  'transitland',
  'nominatim',
  'openstreetmap',
  'geojs',
  'ipapi',
  'ipwhois',
  'rest-countries',
  'open-topo-data',
  'onwater',
  'hormuz-ship-monitor',
  'openvan',
]);

export const WAVE5_BLOCKED_PROVIDER_IDS = Object.freeze(['entsoe', 'aviationstack']);
export const WAVE5_PREVIEW_ONLY_PROVIDER_IDS = Object.freeze([
  'open-meteo',
  'opensky',
  'nominatim',
  'openstreetmap',
  'geojs',
  'ipapi',
  'ipwhois',
  'onwater',
  'hormuz-ship-monitor',
  'openvan',
]);

export type Wave5AdapterContext = {
  readonly nowUtc: string;
  readonly states: Map<string, ProviderAdapterState>;
};

type Wave5Category =
  | 'energy'
  | 'natural_resources'
  | 'weather'
  | 'water'
  | 'environmental'
  | 'aviation'
  | 'transportation'
  | 'geospatial'
  | 'maritime'
  | 'logistics';

function stateFor(ctx: Wave5AdapterContext, providerId: string): ProviderAdapterState {
  return (
    ctx.states.get(providerId) ?? {
      enabled: true,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
      circuitState: 'CLOSED',
    }
  );
}

function guardProvider(ctx: Wave5AdapterContext, providerId: string): string | null {
  const state = stateFor(ctx, providerId);
  if (!state.enabled) {
    return 'PROVIDER_DISABLED';
  }
  if (state.down || providerId === WAVE5_TIMEOUT_PROVIDER) {
    return 'PROVIDER_UNAVAILABLE';
  }
  if (state.rateLimited) {
    return 'RATE_LIMITED';
  }
  if (state.malformed) {
    return 'INVALID_PAYLOAD';
  }
  return null;
}

function observe<T>(
  ctx: Wave5AdapterContext,
  input: {
    readonly providerId: string;
    readonly category: Wave5Category;
    readonly capability: string;
    readonly dataset: string;
    readonly data: T;
    readonly rawPayload: string;
    readonly authorityClass?: 'authoritative_official' | 'reference_data' | 'community_data' | 'derived_data';
  },
): ExternalObservation<T> | null {
  const failure = guardProvider(ctx, input.providerId);
  if (failure) {
    const state = ctx.states.get(input.providerId);
    if (state) {
      ctx.states.set(input.providerId, { ...state, lastError: failure });
    }
    return null;
  }
  const built = buildExternalObservation({
    providerId: input.providerId,
    providerCategory: input.category,
    capability: input.capability,
    data: input.data,
    source: {
      provider: input.providerId,
      dataset: input.dataset,
      sourceUrl: null,
    },
    time: { retrievedAt: asUtcInstant(ctx.nowUtc), sourceTimestamp: asUtcInstant(ctx.nowUtc) },
    authorityClass: input.authorityClass ?? 'reference_data',
    provenance: {
      requestId: `wave5-${input.providerId}`,
      rawPayload: input.rawPayload,
      providerSchemaVersion: 'fixture/1',
    },
  });
  if (!built.ok) {
    return null;
  }
  const state = ctx.states.get(input.providerId);
  if (state) {
    ctx.states.set(input.providerId, { ...state, lastSuccess: ctx.nowUtc, lastError: null });
  }
  return built.value;
}

export function createDefaultWave5AdapterStates(): Map<string, ProviderAdapterState> {
  const states = new Map<string, ProviderAdapterState>();
  for (const providerId of WAVE5_IMPLEMENTED_PROVIDER_IDS) {
    states.set(providerId, {
      enabled: true,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
      circuitState: 'CLOSED',
    });
  }
  for (const providerId of WAVE5_BLOCKED_PROVIDER_IDS) {
    states.set(providerId, {
      enabled: false,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: 'BLOCKED',
      circuitState: 'OPEN',
    });
  }
  return states;
}

export function fetchEnergyObservations(ctx: Wave5AdapterContext): readonly ExternalObservation<EnergyObservation>[] {
  return Object.freeze(
    FIXTURE_ENERGY.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'energy',
        capability: 'energy_prices',
        dataset: item.metricId,
        data: item,
        rawPayload: canonicalJsonStringify(item),
        authorityClass: 'authoritative_official',
      }),
    ).filter((obs): obs is ExternalObservation<EnergyObservation> => obs !== null),
  );
}

export function fetchResourceObservations(ctx: Wave5AdapterContext): readonly ExternalObservation<ResourceObservation>[] {
  return Object.freeze(
    FIXTURE_RESOURCES.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'natural_resources',
        capability: 'mineral_production',
        dataset: item.resourceId,
        data: item,
        rawPayload: canonicalJsonStringify(item),
        authorityClass: 'authoritative_official',
      }),
    ).filter((obs): obs is ExternalObservation<ResourceObservation> => obs !== null),
  );
}

export function fetchWeatherObservations(ctx: Wave5AdapterContext): readonly ExternalObservation<WeatherObservation>[] {
  return Object.freeze(
    FIXTURE_WEATHER.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'weather',
        capability: 'current_weather',
        dataset: item.locationId,
        data: item,
        rawPayload: canonicalJsonStringify(item),
      }),
    ).filter((obs): obs is ExternalObservation<WeatherObservation> => obs !== null),
  );
}

export function fetchEnvironmentalObservations(
  ctx: Wave5AdapterContext,
): readonly ExternalObservation<EnvironmentalObservation>[] {
  return Object.freeze(
    FIXTURE_ENVIRONMENTAL.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: item.sourceProvider === 'usgs-water' ? 'water' : 'environmental',
        capability: item.sourceProvider === 'usgs-water' ? 'streamflow' : 'air_quality',
        dataset: item.metricId,
        data: item,
        rawPayload: canonicalJsonStringify(item),
        authorityClass: 'authoritative_official',
      }),
    ).filter((obs): obs is ExternalObservation<EnvironmentalObservation> => obs !== null),
  );
}

export function fetchAviationObservations(ctx: Wave5AdapterContext): readonly ExternalObservation<AviationObservation>[] {
  return Object.freeze(
    FIXTURE_AVIATION.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'aviation',
        capability: 'flight_positions',
        dataset: item.flightId,
        data: item,
        rawPayload: canonicalJsonStringify(item),
        authorityClass: 'community_data',
      }),
    ).filter((obs): obs is ExternalObservation<AviationObservation> => obs !== null),
  );
}

export function fetchTransitObservations(ctx: Wave5AdapterContext): readonly ExternalObservation<TransitObservation>[] {
  return Object.freeze(
    FIXTURE_TRANSIT.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'transportation',
        capability: 'transit_routes',
        dataset: item.routeId,
        data: item,
        rawPayload: canonicalJsonStringify(item),
        authorityClass: 'community_data',
      }),
    ).filter((obs): obs is ExternalObservation<TransitObservation> => obs !== null),
  );
}

export function fetchGeocodeResults(
  ctx: Wave5AdapterContext,
  query?: string,
): readonly ExternalObservation<GeocodeResult>[] {
  const results = query
    ? FIXTURE_GEOCODE_RESULTS.filter(
        (g) =>
          g.displayName.toLowerCase().includes(query.toLowerCase()) ||
          g.geography.city?.toLowerCase().includes(query.toLowerCase()),
      )
    : FIXTURE_GEOCODE_RESULTS;
  return Object.freeze(
    results
      .map((item) =>
        observe(ctx, {
          providerId: item.sourceProvider,
          category: 'geospatial',
          capability: 'geocoding',
          dataset: item.locationId,
          data: item,
          rawPayload: canonicalJsonStringify(item),
          authorityClass: 'community_data',
        }),
      )
      .filter((obs): obs is ExternalObservation<GeocodeResult> => obs !== null),
  );
}

export function fetchCountryMetadata(ctx: Wave5AdapterContext): readonly ExternalObservation<CountryMetadata>[] {
  return Object.freeze(
    FIXTURE_COUNTRIES.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'geospatial',
        capability: 'country_metadata',
        dataset: item.countryCode,
        data: item,
        rawPayload: canonicalJsonStringify(item),
        authorityClass: 'reference_data',
      }),
    ).filter((obs): obs is ExternalObservation<CountryMetadata> => obs !== null),
  );
}

export function fetchIpGeolocation(
  ctx: Wave5AdapterContext,
  ip?: string,
): readonly ExternalObservation<IpGeolocationResult>[] {
  const results = ip ? FIXTURE_IP_GEO.filter((g) => g.ip === ip) : FIXTURE_IP_GEO;
  return Object.freeze(
    results
      .map((item) =>
        observe(ctx, {
          providerId: item.sourceProvider,
          category: 'geospatial',
          capability: 'ip_geolocation',
          dataset: item.ip,
          data: item,
          rawPayload: canonicalJsonStringify(item),
          authorityClass: 'derived_data',
        }),
      )
      .filter((obs): obs is ExternalObservation<IpGeolocationResult> => obs !== null),
  );
}

export function fetchElevationResults(
  ctx: Wave5AdapterContext,
  lat?: number,
  lon?: number,
): readonly ExternalObservation<ElevationResult>[] {
  const results =
    lat !== undefined && lon !== undefined
      ? FIXTURE_ELEVATIONS.filter((e) => e.latitude === lat && e.longitude === lon)
      : FIXTURE_ELEVATIONS;
  return Object.freeze(
    results
      .map((item) =>
        observe(ctx, {
          providerId: item.sourceProvider,
          category: 'geospatial',
          capability: 'elevation',
          dataset: `${item.latitude},${item.longitude}`,
          data: item,
          rawPayload: canonicalJsonStringify(item),
          authorityClass: 'reference_data',
        }),
      )
      .filter((obs): obs is ExternalObservation<ElevationResult> => obs !== null),
  );
}

export function fetchMaritimeObservations(
  ctx: Wave5AdapterContext,
): readonly ExternalObservation<MaritimeObservation>[] {
  return Object.freeze(
    FIXTURE_MARITIME.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'maritime',
        capability: 'vessel_tracking',
        dataset: item.vesselId ?? item.imo ?? 'unknown',
        data: item,
        rawPayload: canonicalJsonStringify(item),
      }),
    ).filter((obs): obs is ExternalObservation<MaritimeObservation> => obs !== null),
  );
}

export function fetchShippingFlowObservations(
  ctx: Wave5AdapterContext,
): readonly ExternalObservation<ShippingFlowObservation>[] {
  return Object.freeze(
    FIXTURE_SHIPPING_FLOW.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'maritime',
        capability: 'shipping_flow',
        dataset: item.corridor,
        data: item,
        rawPayload: canonicalJsonStringify(item),
        authorityClass: 'derived_data',
      }),
    ).filter((obs): obs is ExternalObservation<ShippingFlowObservation> => obs !== null),
  );
}

export function fetchLogisticsObservations(
  ctx: Wave5AdapterContext,
): readonly ExternalObservation<LogisticsObservation>[] {
  return Object.freeze(
    FIXTURE_LOGISTICS.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'logistics',
        capability: item.observationType.toLowerCase(),
        dataset: item.trackingId ?? item.fuelType ?? item.region ?? 'unknown',
        data: item,
        rawPayload: canonicalJsonStringify(item),
      }),
    ).filter((obs): obs is ExternalObservation<LogisticsObservation> => obs !== null),
  );
}

export function createWave5DataDelivery(clockMs: number) {
  const clock = {
    nowMs: () => clockMs,
    nowUtc: () => new Date(clockMs).toISOString(),
  };
  return new ProviderDataDeliveryService({
    clock,
    fetchFn: async ({ providerId, capability, resourceId }) => {
      const nowUtc = clock.nowUtc();
      return {
        ok: true,
        observation: {
          schema: 'sunrey.external-data.observation.v1',
          observationId: `obs-${providerId}-${resourceId}`,
          providerId,
          capability,
          resourceId,
          schemaVersion: '1.0.0',
          normalizedValue: Object.freeze({ cached: true }),
          provenance: {
            sourceId: providerId,
            collectedAtUtc: nowUtc,
            providerTimestampUtc: nowUtc,
            deduplicationKey: `${providerId}:${capability}:${resourceId}`,
            contentHash: 'fixture',
          },
          simulation: true,
        },
      };
    },
  });
}

export function normalizeGeocodeCacheKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 128);
}

export function enforceQueryLimits(input: {
  readonly limit?: number;
  readonly bbox?: readonly [number, number, number, number];
  readonly dateRangeDays?: number;
}): { readonly limit: number; readonly allowed: boolean; readonly reason: string | null } {
  const limit = Math.min(input.limit ?? 10, 50);
  if (input.bbox) {
    const [minLat, minLon, maxLat, maxLon] = input.bbox;
    const area = Math.abs(maxLat - minLat) * Math.abs(maxLon - minLon);
    if (area > 100) {
      return { limit, allowed: false, reason: 'BOUNDING_BOX_TOO_LARGE' };
    }
  }
  if (input.dateRangeDays !== undefined && input.dateRangeDays > 365) {
    return { limit, allowed: false, reason: 'DATE_RANGE_TOO_LARGE' };
  }
  return { limit, allowed: true, reason: null };
}
