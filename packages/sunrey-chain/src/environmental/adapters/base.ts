/**
 * Shared environmental adapter infrastructure — fixture-backed simulation only.
 */

import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { AuthorityClass } from '../../../../provider-sdk/src/types.ts';
import type { EnvironmentalLocation } from '../location.ts';
import type {
  AirQualityObservation,
  EnvironmentalFreshness,
  EnvironmentalOracleResult,
  EnvironmentalProvenance,
  ForecastRange,
  ForecastResolution,
  SeismicArea,
  SeismicObservation,
  WaterObservation,
  WeatherForecast,
  WeatherForecastPeriod,
  WeatherObservation,
  WildfireObservation,
} from '../types.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export type AdapterScenario = 'normal' | 'timeout' | 'rate_limited' | 'unavailable' | 'disagreeing' | 'stale_forecast' | 'expired_forecast';

export function loadEnvironmentalFixture(filename: string): unknown {
  const path = join(FIXTURES_DIR, filename);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function ok<T>(value: T, providerId: string, fromCache = false): EnvironmentalOracleResult<T> {
  return Object.freeze({ ok: true, value, fromCache, fallbackProviderId: null });
}

export function fail(code: string, message: string, providerId: string): EnvironmentalOracleResult<never> {
  return Object.freeze({ ok: false, code, message, providerId });
}

export function buildFreshness(retrievedAt: UtcInstant, sourceAgeMs: number): EnvironmentalFreshness {
  let status: EnvironmentalFreshness['status'] = 'fresh';
  if (sourceAgeMs > 3_600_000) status = 'expired';
  else if (sourceAgeMs > 900_000) status = 'stale';
  else if (sourceAgeMs > 300_000) status = 'aging';
  return Object.freeze({
    status,
    ageMs: BigInt(sourceAgeMs),
    assessedAt: retrievedAt,
  });
}

export function buildProvenance(
  providerId: string,
  capability: string,
  authorityClass: AuthorityClass,
  raw: unknown,
): EnvironmentalProvenance {
  const hash = createHash('sha256').update(JSON.stringify(raw)).digest('hex');
  return Object.freeze({
    providerId,
    authorityClass,
    sourceUrl: null,
    rawPayloadHash: hash,
    observationId: randomUUID(),
    capability,
  });
}

export function normalizeWeatherObservation(
  raw: Record<string, unknown>,
  location: EnvironmentalLocation,
  providerId: string,
  authorityClass: AuthorityClass,
  nowUtc: UtcInstant,
  disagreeing = false,
): WeatherObservation {
  let temp = Number(raw.temperature ?? 20);
  if (disagreeing) temp += 2;
  return Object.freeze({
    schema: 'sunrey.weather-observation.v1',
    kind: 'observation',
    location,
    temperature: Object.freeze({ value: temp, unit: 'celsius' as const }),
    feelsLike: raw.feels_like != null ? Object.freeze({ value: Number(raw.feels_like), unit: 'celsius' as const }) : null,
    humidity: raw.relative_humidity != null ? Object.freeze({ value: Number(raw.relative_humidity), unit: 'percent' as const }) : null,
    pressure: raw.pressure != null ? Object.freeze({ value: Number(raw.pressure), unit: 'hPa' as const }) : null,
    windSpeed: raw.wind_speed != null ? Object.freeze({ value: Number(raw.wind_speed), unit: 'm/s' as const }) : null,
    windDirection: raw.wind_direction != null ? Object.freeze({ value: Number(raw.wind_direction), unit: 'degrees' as const }) : null,
    precipitation: raw.precipitation != null ? Object.freeze({ value: Number(raw.precipitation), unit: 'mm' as const }) : null,
    cloudCover: raw.cloud_cover != null ? Object.freeze({ value: Number(raw.cloud_cover), unit: 'percent' as const }) : null,
    visibility: raw.visibility != null ? Object.freeze({ value: Number(raw.visibility), unit: 'km' as const }) : null,
    weatherCondition: typeof raw.weather_code === 'string' ? raw.weather_code : 'clear',
    snow: raw.snowfall != null ? Object.freeze({ value: Number(raw.snowfall), unit: 'cm' as const }) : null,
    uvIndex: raw.uv_index != null ? Number(raw.uv_index) : null,
    observationTime: asUtcInstant(String(raw.time ?? nowUtc)),
    providerId,
    freshness: buildFreshness(nowUtc, Number(raw.age_ms ?? 60_000)),
    provenance: buildProvenance(providerId, 'weather', authorityClass, raw),
    retrievedAt: nowUtc,
  });
}

export function normalizeWeatherForecast(
  raw: Record<string, unknown>,
  location: EnvironmentalLocation,
  providerId: string,
  authorityClass: AuthorityClass,
  nowUtc: UtcInstant,
  resolution: ForecastResolution = 'hourly',
  scenario: AdapterScenario = 'normal',
): WeatherForecast {
  const generatedAt = asUtcInstant(String(raw.generated_at ?? nowUtc));
  const validFrom = asUtcInstant(String(raw.valid_from ?? nowUtc));
  const validTo = asUtcInstant(String(raw.valid_to ?? nowUtc));
  const expired = scenario === 'expired_forecast' || new Date(validTo).getTime() < new Date(nowUtc).getTime();
  const periods: WeatherForecastPeriod[] = [];
  const hourly = (raw.hourly as Record<string, unknown>[] | undefined) ?? [];
  for (const period of hourly) {
    periods.push(
      Object.freeze({
        validFrom: asUtcInstant(String(period.time ?? validFrom)),
        validTo: asUtcInstant(String(period.time_end ?? validTo)),
        resolution,
        variables: Object.freeze([
          Object.freeze({ name: 'temperature', value: Number(period.temperature ?? 20), unit: 'celsius' }),
        ]),
        weatherCondition: typeof period.condition === 'string' ? period.condition : null,
        modelId: typeof period.model === 'string' ? period.model : null,
        modelRun: typeof period.model_run === 'string' ? period.model_run : null,
        confidence: period.confidence != null ? Number(period.confidence) : null,
      }),
    );
  }
  return Object.freeze({
    schema: 'sunrey.weather-forecast.v1',
    kind: 'forecast',
    location,
    generatedAt,
    validFrom,
    validTo,
    horizonHours: Number(raw.horizon_hours ?? 48),
    resolution,
    periods: Object.freeze(periods),
    modelSource: typeof raw.model_source === 'string' ? raw.model_source : providerId,
    providerId,
    freshness: buildFreshness(nowUtc, scenario === 'stale_forecast' ? 1_500_000 : 300_000),
    provenance: buildProvenance(providerId, 'weather.forecast', authorityClass, raw),
    retrievedAt: nowUtc,
    expired,
  });
}

export function normalizeWaterObservation(
  raw: Record<string, unknown>,
  location: EnvironmentalLocation,
  providerId: string,
  authorityClass: AuthorityClass,
  nowUtc: UtcInstant,
): WaterObservation {
  return Object.freeze({
    schema: 'sunrey.water-observation.v1',
    measurementType: (raw.measurement_type as WaterObservation['measurementType']) ?? 'streamflow',
    value: Number(raw.value ?? 0),
    unit: String(raw.unit ?? 'cfs'),
    stationId: typeof raw.station_id === 'string' ? raw.station_id : null,
    waterBody: typeof raw.water_body === 'string' ? raw.water_body : null,
    location,
    effectiveAt: asUtcInstant(String(raw.effective_at ?? nowUtc)),
    providerId,
    freshness: buildFreshness(nowUtc, 900_000),
    provenance: buildProvenance(providerId, 'water_data', authorityClass, raw),
    retrievedAt: nowUtc,
    geographicScopeNote: 'United States gauge network only.',
  });
}

export function normalizeAirQualityObservation(
  raw: Record<string, unknown>,
  location: EnvironmentalLocation,
  providerId: string,
  authorityClass: AuthorityClass,
  nowUtc: UtcInstant,
): AirQualityObservation {
  const metrics = ((raw.metrics as Record<string, unknown>[]) ?? []).map((m) =>
    Object.freeze({
      pollutant: (m.pollutant as AirQualityObservation['metrics'][number]['pollutant']) ?? 'PM2.5',
      value: Number(m.value ?? 0),
      unit: String(m.unit ?? 'µg/m³'),
      aqiStandard: typeof m.aqi_standard === 'string' ? m.aqi_standard : null,
    }),
  );
  return Object.freeze({
    schema: 'sunrey.air-quality-observation.v1',
    location,
    metrics: Object.freeze(metrics),
    stationId: typeof raw.station_id === 'string' ? raw.station_id : null,
    observedAt: asUtcInstant(String(raw.observed_at ?? nowUtc)),
    providerId,
    freshness: buildFreshness(nowUtc, 600_000),
    provenance: buildProvenance(providerId, 'air_quality', authorityClass, raw),
    retrievedAt: nowUtc,
  });
}

export function normalizeSeismicObservation(
  raw: Record<string, unknown>,
  providerId: string,
  authorityClass: AuthorityClass,
  nowUtc: UtcInstant,
): SeismicObservation {
  return Object.freeze({
    schema: 'sunrey.seismic-observation.v1',
    eventId: String(raw.id ?? raw.event_id ?? 'unknown'),
    magnitude: Number(raw.magnitude ?? 0),
    magnitudeType: String(raw.mag_type ?? 'ml'),
    depth: Object.freeze({ value: Number(raw.depth ?? 10), unit: 'km' as const }),
    latitude: Number(raw.latitude ?? 0),
    longitude: Number(raw.longitude ?? 0),
    place: String(raw.place ?? 'unknown'),
    eventTime: asUtcInstant(String(raw.time ?? nowUtc)),
    updatedAt: asUtcInstant(String(raw.updated ?? nowUtc)),
    providerId,
    provenance: buildProvenance(providerId, 'earthquake', authorityClass, raw),
    retrievedAt: nowUtc,
  });
}

export function normalizeWildfireObservation(
  raw: Record<string, unknown>,
  location: EnvironmentalLocation,
  providerId: string,
  authorityClass: AuthorityClass,
  nowUtc: UtcInstant,
): WildfireObservation {
  return Object.freeze({
    schema: 'sunrey.wildfire-observation.v1',
    eventId: String(raw.id ?? 'unknown'),
    location,
    detectionTime: asUtcInstant(String(raw.detection_time ?? nowUtc)),
    status: String(raw.status ?? 'active'),
    confidence: raw.confidence != null ? Number(raw.confidence) : null,
    affectedArea:
      raw.affected_area != null
        ? Object.freeze({ value: Number(raw.affected_area), unit: 'acres' as const })
        : null,
    satelliteSource: typeof raw.satellite === 'string' ? raw.satellite : null,
    providerId,
    provenance: buildProvenance(providerId, 'wildfire', authorityClass, raw),
    retrievedAt: nowUtc,
  });
}

export abstract class BaseEnvironmentalAdapter {
  abstract readonly providerId: string;
  abstract readonly capabilities: readonly string[];
  abstract readonly priority: 'primary' | 'secondary' | 'fallback';
  abstract readonly geographicScope: readonly string[];
  #scenario: AdapterScenario = 'normal';

  setScenario(scenario: AdapterScenario): void {
    this.#scenario = scenario;
  }

  protected get scenario(): AdapterScenario {
    return this.#scenario;
  }

  protected checkAvailability(): EnvironmentalOracleResult<never> | null {
    if (this.#scenario === 'timeout') return fail('PROVIDER_TIMEOUT', 'request timed out', this.providerId);
    if (this.#scenario === 'rate_limited') return fail('RATE_LIMITED', 'HTTP 429 Too Many Requests', this.providerId);
    if (this.#scenario === 'unavailable') return fail('PROVIDER_UNAVAILABLE', 'provider unavailable', this.providerId);
    return null;
  }

  health(nowUtc: UtcInstant) {
    return Object.freeze({
      providerId: this.providerId,
      status: this.#scenario === 'unavailable' || this.#scenario === 'timeout' ? ('unavailable' as const) : ('healthy' as const),
      circuitState: this.#scenario === 'unavailable' ? ('OPEN' as const) : ('CLOSED' as const),
      rateLimited: this.#scenario === 'rate_limited',
      lastSuccessAt: this.#scenario === 'unavailable' ? null : nowUtc,
      message: this.#scenario === 'rate_limited' ? 'HTTP 429' : null,
    });
  }

  supportsCapability(capability: string): boolean {
    return (this.capabilities as readonly string[]).includes(capability);
  }
}

export type ForecastRequest = {
  readonly location: EnvironmentalLocation;
  readonly range: ForecastRange;
  readonly nowUtc: UtcInstant;
};

export type SeismicRequest = {
  readonly area: SeismicArea;
  readonly range: ForecastRange;
  readonly nowUtc: UtcInstant;
};
