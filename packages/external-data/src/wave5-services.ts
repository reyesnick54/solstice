/**
 * Wave 5 canonical domain services.
 */

import type { ExternalObservation } from '../../provider-sdk/src/index.ts';
import {
  enforceQueryLimits,
  fetchAviationObservations,
  fetchCountryMetadata,
  fetchElevationResults,
  fetchEnergyObservations,
  fetchEnvironmentalObservations,
  fetchGeocodeResults,
  fetchIpGeolocation,
  fetchLogisticsObservations,
  fetchMaritimeObservations,
  fetchResourceObservations,
  fetchShippingFlowObservations,
  fetchTransitObservations,
  fetchWeatherObservations,
  normalizeGeocodeCacheKey,
  type Wave5AdapterContext,
} from './wave5-adapters.ts';
import type {
  AviationObservation,
  CanonicalGeography,
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
  Wave5ServiceResult,
  WeatherObservation,
} from './wave5-models.ts';

function summarize<T>(
  observations: readonly ExternalObservation<T>[],
  conflicts: Wave5ServiceResult<T>['conflicts'] = [],
): Wave5ServiceResult<T> {
  return Object.freeze({
    observations,
    degraded: observations.length === 0,
    stale: false,
    providersUsed: Object.freeze([...new Set(observations.map((o) => o.providerId))]),
    conflicts,
  });
}

function detectWeatherConflicts(
  observations: readonly ExternalObservation<WeatherObservation>[],
): Wave5ServiceResult<WeatherObservation>['conflicts'] {
  const byLocation = new Map<string, ExternalObservation<WeatherObservation>[]>();
  for (const obs of observations) {
    const key = obs.data.locationId;
    const existing = byLocation.get(key) ?? [];
    existing.push(obs);
    byLocation.set(key, existing);
  }
  const conflicts: Wave5ServiceResult<WeatherObservation>['conflicts'] = [];
  for (const [locationId, group] of byLocation) {
    if (group.length < 2) continue;
    const temps = group.map((o) => o.data.temperatureCelsius);
    const maxDiff = Math.max(...temps.map((t) => t ?? 0)) - Math.min(...temps.map((t) => t ?? 0));
    if (maxDiff > 5) {
      conflicts.push({
        providerId: group.map((o) => o.providerId).join(','),
        field: `temperatureCelsius@${locationId}`,
        message: `Material disagreement: ${maxDiff.toFixed(1)}°C spread across providers`,
      });
    }
  }
  return Object.freeze(conflicts);
}

export class EnergyDataService {
  readonly #ctx: Wave5AdapterContext;

  constructor(ctx: Wave5AdapterContext) {
    this.#ctx = ctx;
  }

  getObservations(): Wave5ServiceResult<EnergyObservation> {
    return summarize(fetchEnergyObservations(this.#ctx));
  }
}

export class ResourceDataService {
  readonly #ctx: Wave5AdapterContext;

  constructor(ctx: Wave5AdapterContext) {
    this.#ctx = ctx;
  }

  getObservations(): Wave5ServiceResult<ResourceObservation> {
    return summarize(fetchResourceObservations(this.#ctx));
  }
}

export class WeatherDataService {
  readonly #ctx: Wave5AdapterContext;

  constructor(ctx: Wave5AdapterContext) {
    this.#ctx = ctx;
  }

  getCurrentWeather(): Wave5ServiceResult<WeatherObservation> {
    const observations = fetchWeatherObservations(this.#ctx);
    const conflicts = detectWeatherConflicts(observations);
    return summarize(observations, conflicts);
  }
}

export class EnvironmentalOracleService {
  readonly #ctx: Wave5AdapterContext;

  constructor(ctx: Wave5AdapterContext) {
    this.#ctx = ctx;
  }

  getObservations(): Wave5ServiceResult<EnvironmentalObservation> {
    return summarize(fetchEnvironmentalObservations(this.#ctx));
  }
}

export class TravelIntelligenceService {
  readonly #ctx: Wave5AdapterContext;

  constructor(ctx: Wave5AdapterContext) {
    this.#ctx = ctx;
  }

  getAviationPositions(): Wave5ServiceResult<AviationObservation> {
    return summarize(fetchAviationObservations(this.#ctx));
  }

  getTransitRoutes(): Wave5ServiceResult<TransitObservation> {
    return summarize(fetchTransitObservations(this.#ctx));
  }
}

export class GeospatialService {
  readonly #ctx: Wave5AdapterContext;
  readonly #geocodeCache = new Map<string, readonly ExternalObservation<GeocodeResult>[]>();

  constructor(ctx: Wave5AdapterContext) {
    this.#ctx = ctx;
  }

  geocode(address: string): Wave5ServiceResult<GeocodeResult> {
    const limits = enforceQueryLimits({ limit: 5 });
    if (!limits.allowed) {
      return summarize([], [{ providerId: 'geospatial', field: 'query', message: limits.reason ?? 'LIMIT' }]);
    }
    const cacheKey = normalizeGeocodeCacheKey(address);
    const cached = this.#geocodeCache.get(cacheKey);
    if (cached) {
      return Object.freeze({ ...summarize(cached), stale: true });
    }
    const observations = fetchGeocodeResults(this.#ctx, address).slice(0, limits.limit);
    if (observations.length > 0) {
      this.#geocodeCache.set(cacheKey, observations);
    }
    return summarize(observations);
  }

  reverseGeocode(location: { readonly latitude: number; readonly longitude: number }): Wave5ServiceResult<GeocodeResult> {
    const query = `${location.latitude},${location.longitude}`;
    return this.geocode(query);
  }

  lookupCountry(countryCode: string): CountryMetadata | null {
    const results = fetchCountryMetadata(this.#ctx).filter((o) => o.data.countryCode === countryCode);
    return results[0]?.data ?? null;
  }

  lookupRegion(countryCode: string, region: string): CanonicalGeography | null {
    const geocoded = this.geocode(`${region}, ${countryCode}`);
    return geocoded.observations[0]?.data.geography ?? null;
  }

  lookupTimezone(locationId: string): string | null {
    const geocoded = fetchGeocodeResults(this.#ctx).find((o) => o.data.locationId === locationId);
    return geocoded?.data.geography.timezone ?? null;
  }

  getElevation(latitude: number, longitude: number): Wave5ServiceResult<ElevationResult> {
    return summarize(fetchElevationResults(this.#ctx, latitude, longitude));
  }

  isLandOrWater(latitude: number, longitude: number): 'LAND' | 'WATER' | 'UNKNOWN' {
    const result = fetchElevationResults(this.#ctx, latitude, longitude);
    return result[0]?.data.classification ?? 'UNKNOWN';
  }

  lookupIpGeolocation(ip: string): Wave5ServiceResult<IpGeolocationResult> {
    return summarize(fetchIpGeolocation(this.#ctx, ip));
  }

  getCountries(): Wave5ServiceResult<CountryMetadata> {
    return summarize(fetchCountryMetadata(this.#ctx));
  }

  geocodeCacheSize(): number {
    return this.#geocodeCache.size;
  }
}

export class MaritimeDataService {
  readonly #ctx: Wave5AdapterContext;

  constructor(ctx: Wave5AdapterContext) {
    this.#ctx = ctx;
  }

  getVesselObservations(): Wave5ServiceResult<MaritimeObservation> {
    return summarize(fetchMaritimeObservations(this.#ctx));
  }

  getShippingFlow(): Wave5ServiceResult<ShippingFlowObservation> {
    return summarize(fetchShippingFlowObservations(this.#ctx));
  }
}

export class LogisticsDataService {
  readonly #ctx: Wave5AdapterContext;

  constructor(ctx: Wave5AdapterContext) {
    this.#ctx = ctx;
  }

  getObservations(): Wave5ServiceResult<LogisticsObservation> {
    return summarize(fetchLogisticsObservations(this.#ctx));
  }

  getFuelPrices(region?: string): Wave5ServiceResult<LogisticsObservation> {
    const all = fetchLogisticsObservations(this.#ctx).filter((o) => o.data.observationType === 'FUEL_PRICE');
    const filtered = region ? all.filter((o) => o.data.region === region) : all;
    return summarize(filtered);
  }
}

export function createWave5Services(ctx: Wave5AdapterContext) {
  return Object.freeze({
    energy: new EnergyDataService(ctx),
    resources: new ResourceDataService(ctx),
    weather: new WeatherDataService(ctx),
    environment: new EnvironmentalOracleService(ctx),
    travel: new TravelIntelligenceService(ctx),
    geospatial: new GeospatialService(ctx),
    maritime: new MaritimeDataService(ctx),
    logistics: new LogisticsDataService(ctx),
  });
}

export type Wave5Services = ReturnType<typeof createWave5Services>;
