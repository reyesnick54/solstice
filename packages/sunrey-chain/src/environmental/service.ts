/**
 * EnvironmentalOracleService — canonical environmental observation plane.
 *
 * Reference / evidence only. Does not mutate financial positions, MoonRey
 * issuance, insurance decisions, or asset valuations.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { environmentalCachePolicy, ENVIRONMENTAL_CACHE_CAPABILITIES } from './cache-policies.ts';
import { locationKey, normalizeEnvironmentalLocation, type EnvironmentalLocation, type LocationInput } from './location.ts';
import { derivePhysicalRisks } from './physical-risk.ts';
import type { EnvironmentalOracleProvider } from './provider.ts';
import { createEnvironmentalAdapterFactory } from './registry.ts';
import { environmentalSeparationProof } from './separation.ts';
import type {
  AirQualityObservation,
  EnvironmentalOracleResult,
  EnvironmentalSnapshot,
  ForecastRange,
  ProviderDisagreementEvent,
  SeismicArea,
  SeismicObservation,
  WaterObservation,
  WeatherForecast,
  WeatherObservation,
  WildfireObservation,
} from './types.ts';

export type EnvironmentalOracleServiceOptions = {
  readonly nowUtc?: UtcInstant;
  readonly providers?: readonly EnvironmentalOracleProvider[];
};

type CacheEntry<T> = { readonly value: T; readonly expiresAtMs: number; readonly providerId: string };

const PRIORITY_ORDER = { primary: 0, secondary: 1, fallback: 2 } as const;

export class EnvironmentalOracleService {
  readonly #providers: readonly EnvironmentalOracleProvider[];
  readonly #memory = new Map<string, CacheEntry<unknown>>();
  readonly #disagreements: ProviderDisagreementEvent[] = [];
  readonly #allWeatherObservations = new Map<string, WeatherObservation[]>();

  constructor(options: EnvironmentalOracleServiceOptions = {}) {
    const factory = createEnvironmentalAdapterFactory();
    this.#providers = Object.freeze(options.providers ?? factory.createAll());
  }

  listProviders(): readonly EnvironmentalOracleProvider[] {
    return this.#providers;
  }

  separationProof() {
    return environmentalSeparationProof();
  }

  disagreementEvents(): readonly ProviderDisagreementEvent[] {
    return Object.freeze([...this.#disagreements]);
  }

  allWeatherObservationsForLocation(locationKeyStr: string): readonly WeatherObservation[] {
    return Object.freeze(this.#allWeatherObservations.get(locationKeyStr) ?? []);
  }

  async getCurrentWeather(
    input: LocationInput,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<EnvironmentalOracleResult<readonly WeatherObservation[]>> {
    const location = normalizeEnvironmentalLocation(input);
    const key = locationKey(location);
    const cacheKey = `weather:current:${key}`;
    const cached = this.#getCache<readonly WeatherObservation[]>(cacheKey);
    if (cached) return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };

    const observations: WeatherObservation[] = [];
    const warnings: string[] = [];
    let usedProviderId: string | null = null;

    for (const provider of this.#sortedWeatherProviders()) {
      const result = await provider.getCurrentWeather(location, nowUtc);
      if (result.ok) {
        observations.push(result.value);
        if (!usedProviderId) usedProviderId = provider.providerId;
      } else {
        warnings.push(`${provider.providerId}: ${result.message}`);
      }
    }

    if (observations.length === 0) {
      return { ok: false, code: 'NO_PROVIDER', message: warnings.join('; ') || 'no weather providers available', providerId: null };
    }

    this.#allWeatherObservations.set(key, observations);
    await this.#detectWeatherDisagreement(key, observations, nowUtc);
    this.#setCache(cacheKey, observations, ENVIRONMENTAL_CACHE_CAPABILITIES.currentWeather, usedProviderId!);
    return { ok: true, value: Object.freeze(observations), fromCache: false, fallbackProviderId: null };
  }

  async getForecast(
    input: LocationInput,
    range: ForecastRange,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<EnvironmentalOracleResult<readonly WeatherForecast[]>> {
    const location = normalizeEnvironmentalLocation(input);
    const key = locationKey(location);
    const cacheKey = `weather:forecast:${key}:${range.resolution ?? 'hourly'}`;
    const cached = this.#getCache<readonly WeatherForecast[]>(cacheKey);
    if (cached) return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };

    const forecasts: WeatherForecast[] = [];
    const warnings: string[] = [];
    let usedProviderId: string | null = null;

    for (const provider of this.#sortedWeatherProviders()) {
      if (!provider.getForecast) continue;
      const result = await provider.getForecast(location, range, nowUtc);
      if (result.ok) {
        if (!result.value.expired) {
          forecasts.push(result.value);
          if (!usedProviderId) usedProviderId = provider.providerId;
        } else {
          warnings.push(`${provider.providerId}: forecast expired`);
        }
      } else if (result.code !== 'UNSUPPORTED') {
        warnings.push(`${provider.providerId}: ${result.message}`);
      }
    }

    if (forecasts.length === 0) {
      return { ok: false, code: 'NO_FORECAST', message: warnings.join('; ') || 'no forecasts available', providerId: null };
    }

    const capability = range.resolution === 'daily'
      ? ENVIRONMENTAL_CACHE_CAPABILITIES.dailyForecast
      : ENVIRONMENTAL_CACHE_CAPABILITIES.hourlyForecast;
    this.#setCache(cacheKey, forecasts, capability, usedProviderId!);
    return { ok: true, value: Object.freeze(forecasts), fromCache: false, fallbackProviderId: null };
  }

  async getWaterState(
    input: LocationInput,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<EnvironmentalOracleResult<readonly WaterObservation[]>> {
    const location = normalizeEnvironmentalLocation(input);
    const key = locationKey(location);
    const cacheKey = `water:${key}`;
    const cached = this.#getCache<readonly WaterObservation[]>(cacheKey);
    if (cached) return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };

    for (const provider of this.#sortedProviders('water_data')) {
      if (!provider.getWaterState) continue;
      const result = await provider.getWaterState(location, nowUtc);
      if (result.ok) {
        this.#setCache(cacheKey, result.value, ENVIRONMENTAL_CACHE_CAPABILITIES.waterGauge, provider.providerId);
        return { ok: true, value: result.value, fromCache: false, fallbackProviderId: null };
      }
    }
    return { ok: false, code: 'NO_WATER_DATA', message: 'no water providers available for location', providerId: null };
  }

  async getAirQuality(
    input: LocationInput,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<EnvironmentalOracleResult<readonly AirQualityObservation[]>> {
    const location = normalizeEnvironmentalLocation(input);
    const key = locationKey(location);
    const cacheKey = `air:${key}`;
    const cached = this.#getCache<readonly AirQualityObservation[]>(cacheKey);
    if (cached) return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };

    const observations: AirQualityObservation[] = [];
    for (const provider of this.#sortedProviders('air_quality')) {
      if (!provider.getAirQuality) continue;
      const result = await provider.getAirQuality(location, nowUtc);
      if (result.ok) observations.push(result.value);
    }

    if (observations.length === 0) {
      return { ok: false, code: 'NO_AIR_QUALITY', message: 'no air quality providers available', providerId: null };
    }

    this.#setCache(cacheKey, observations, ENVIRONMENTAL_CACHE_CAPABILITIES.airQuality, observations[0]!.providerId);
    return { ok: true, value: Object.freeze(observations), fromCache: false, fallbackProviderId: null };
  }

  async getSeismicEvents(
    area: SeismicArea,
    range: ForecastRange,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<EnvironmentalOracleResult<readonly SeismicObservation[]>> {
    const cacheKey = `seismic:${area.latitude},${area.longitude}:${area.radiusKm}`;
    const cached = this.#getCache<readonly SeismicObservation[]>(cacheKey);
    if (cached) return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };

    for (const provider of this.#sortedProviders('earthquake')) {
      if (!provider.getSeismicEvents) continue;
      const result = await provider.getSeismicEvents(area, range, nowUtc);
      if (result.ok) {
        this.#setCache(cacheKey, result.value, ENVIRONMENTAL_CACHE_CAPABILITIES.seismicEvent, provider.providerId);
        return { ok: true, value: result.value, fromCache: false, fallbackProviderId: null };
      }
    }
    return { ok: false, code: 'NO_SEISMIC', message: 'no seismic providers available', providerId: null };
  }

  async getWildfireEvents(
    input: LocationInput,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<EnvironmentalOracleResult<readonly WildfireObservation[]>> {
    const location = normalizeEnvironmentalLocation(input);
    const key = locationKey(location);
    const cacheKey = `wildfire:${key}`;
    const cached = this.#getCache<readonly WildfireObservation[]>(cacheKey);
    if (cached) return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };

    const events: WildfireObservation[] = [];
    for (const provider of this.#sortedProviders('wildfire')) {
      if (!provider.getWildfireEvents) continue;
      const result = await provider.getWildfireEvents(location, nowUtc);
      if (result.ok) events.push(...result.value);
    }

    if (events.length === 0) {
      return { ok: true, value: Object.freeze([]), fromCache: false, fallbackProviderId: null };
    }

    this.#setCache(cacheKey, events, ENVIRONMENTAL_CACHE_CAPABILITIES.wildfireEvent, events[0]!.providerId);
    return { ok: true, value: Object.freeze(events), fromCache: false, fallbackProviderId: null };
  }

  async getEnvironmentalSnapshot(
    input: LocationInput,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<EnvironmentalOracleResult<EnvironmentalSnapshot>> {
    const location = normalizeEnvironmentalLocation(input);
    const range: ForecastRange = Object.freeze({
      from: nowUtc,
      to: asUtcInstant(new Date(Date.now() + 48 * 3_600_000).toISOString()),
      resolution: 'hourly',
    });
    const area: SeismicArea = Object.freeze({
      latitude: location.latitude,
      longitude: location.longitude,
      radiusKm: 500,
    });

    const [weather, forecasts, water, airQuality, seismic, wildfires] = await Promise.all([
      this.getCurrentWeather(input, nowUtc),
      this.getForecast(input, range, nowUtc),
      this.getWaterState(input, nowUtc),
      this.getAirQuality(input, nowUtc),
      this.getSeismicEvents(area, range, nowUtc),
      this.getWildfireEvents(input, nowUtc),
    ]);

    const weatherObs = weather.ok ? weather.value : [];
    const forecastObs = forecasts.ok ? forecasts.value : [];
    const waterObs = water.ok ? water.value : [];
    const airObs = airQuality.ok ? airQuality.value : [];
    const seismicObs = seismic.ok ? seismic.value : [];
    const wildfireObs = wildfires.ok ? wildfires.value : [];

    const physicalRisks = derivePhysicalRisks({
      location,
      weather: weatherObs,
      water: waterObs,
      airQuality: airObs,
      seismic: seismicObs,
      wildfires: wildfireObs,
      nowUtc,
    });

    return {
      ok: true,
      value: Object.freeze({
        schema: 'sunrey.environmental-snapshot.v1',
        location,
        generatedAt: nowUtc,
        weather: weatherObs,
        forecasts: forecastObs,
        water: waterObs,
        airQuality: airObs,
        seismic: seismicObs,
        wildfires: wildfireObs,
        physicalRisks,
        providerDisagreements: Object.freeze([...this.#disagreements]),
      }),
      fromCache: false,
      fallbackProviderId: null,
    };
  }

  #sortedWeatherProviders(): readonly EnvironmentalOracleProvider[] {
    return this.#sortedProviders('weather');
  }

  #sortedProviders(capability: string): readonly EnvironmentalOracleProvider[] {
    return Object.freeze(
      [...this.#providers]
        .filter((p) => p.supportsCapability(capability as Parameters<EnvironmentalOracleProvider['supportsCapability']>[0]))
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    );
  }

  async #detectWeatherDisagreement(
    locKey: string,
    observations: readonly WeatherObservation[],
    nowUtc: UtcInstant,
  ): Promise<void> {
    if (observations.length < 2) return;
    const temps = observations
      .filter((o) => o.temperature != null)
      .map((o) => ({ providerId: o.providerId, temp: o.temperature!.value }));
    if (temps.length < 2) return;
    const maxDiff = Math.max(...temps.map((t) => t.temp)) - Math.min(...temps.map((t) => t.temp));
    if (maxDiff > 1.5) {
      const event: ProviderDisagreementEvent = Object.freeze({
        capability: 'weather',
        locationKey: locKey,
        providers: Object.freeze(
          temps.map((t) => Object.freeze({ providerId: t.providerId, summary: `temperature ${t.temp}°C` })),
        ),
        detectedAt: nowUtc,
      });
      this.#disagreements.push(event);
    }
  }

  #getCache<T>(key: string): CacheEntry<T> | null {
    const entry = this.#memory.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAtMs) {
      this.#memory.delete(key);
      return null;
    }
    return entry;
  }

  #setCache<T>(key: string, value: T, capability: string, providerId: string): void {
    const policy = environmentalCachePolicy(capability);
    this.#memory.set(key, Object.freeze({
      value,
      expiresAtMs: Date.now() + policy.freshTtlMs,
      providerId,
    }));
  }
}

export function createEnvironmentalOracleService(
  options?: EnvironmentalOracleServiceOptions,
): EnvironmentalOracleService {
  return new EnvironmentalOracleService(options);
}

export function defaultEnvironmentalNow(): UtcInstant {
  return asUtcInstant('2026-08-31T12:00:00.000Z');
}
