/**
 * Environmental provider adapters — fixture-backed simulation only.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EnvironmentalLocation } from '../location.ts';
import type { EnvironmentalOracleProvider, EnvironmentalCapability } from '../provider.ts';
import type { ForecastRange, SeismicArea } from '../types.ts';
import {
  BaseEnvironmentalAdapter,
  fail,
  loadEnvironmentalFixture,
  normalizeAirQualityObservation,
  normalizeSeismicObservation,
  normalizeWaterObservation,
  normalizeWeatherForecast,
  normalizeWeatherObservation,
  normalizeWildfireObservation,
  ok,
  type AdapterScenario,
} from './base.ts';

abstract class WeatherProviderAdapter extends BaseEnvironmentalAdapter implements EnvironmentalOracleProvider {
  abstract override readonly providerId: string;
  abstract override readonly capabilities: readonly EnvironmentalCapability[];
  abstract override readonly priority: 'primary' | 'secondary' | 'fallback';
  abstract override readonly geographicScope: readonly string[];
  abstract readonly currentFixture: string;
  abstract readonly forecastFixture: string | null;
  abstract readonly authorityClass: 'reference_data' | 'authoritative_official';
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async getCurrentWeather(location: EnvironmentalLocation, nowUtc: UtcInstant) {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadEnvironmentalFixture(this.currentFixture) as Record<string, unknown>;
    return ok(
      normalizeWeatherObservation(raw, location, this.providerId, this.authorityClass, nowUtc, this.scenario === 'disagreeing'),
      this.providerId,
    );
  }

  async getForecast(location: EnvironmentalLocation, range: ForecastRange, nowUtc: UtcInstant) {
    if (!this.forecastFixture) return fail('UNSUPPORTED', 'forecast not supported', this.providerId);
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadEnvironmentalFixture(this.forecastFixture) as Record<string, unknown>;
    return ok(
      normalizeWeatherForecast(raw, location, this.providerId, this.authorityClass, nowUtc, range.resolution ?? 'hourly', this.scenario),
      this.providerId,
    );
  }
}

export class OpenMeteoAdapter extends WeatherProviderAdapter {
  readonly providerId = 'open-meteo';
  readonly capabilities = ['weather', 'precipitation', 'environmental'] as const;
  readonly priority = 'primary' as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly currentFixture = 'open-meteo-current.json';
  readonly forecastFixture = 'open-meteo-forecast.json';
  readonly authorityClass = 'reference_data' as const;
}

export class OpenMeteoEnsembleAdapter extends WeatherProviderAdapter {
  readonly providerId = 'open-meteo-ensemble';
  readonly capabilities = ['weather', 'precipitation', 'environmental', 'climate'] as const;
  readonly priority = 'secondary' as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly currentFixture = 'open-meteo-current.json';
  readonly forecastFixture = 'open-meteo-ensemble-forecast.json';
  readonly authorityClass = 'reference_data' as const;
}

export class NwsAdapter extends BaseEnvironmentalAdapter implements EnvironmentalOracleProvider {
  readonly providerId = 'nws';
  readonly capabilities = ['weather', 'environmental', 'environmental_risk', 'wildfire'] as const;
  readonly priority = 'primary' as const;
  readonly geographicScope = ['US'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async getCurrentWeather(location: EnvironmentalLocation, nowUtc: UtcInstant) {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadEnvironmentalFixture('nws-current.json') as Record<string, unknown>;
    return ok(normalizeWeatherObservation(raw, location, this.providerId, 'authoritative_official', nowUtc, this.scenario === 'disagreeing'), this.providerId);
  }

  async getWildfireEvents(location: EnvironmentalLocation, nowUtc: UtcInstant) {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadEnvironmentalFixture('nws-wildfire.json') as Record<string, unknown>;
    return ok([normalizeWildfireObservation(raw, location, this.providerId, 'authoritative_official', nowUtc)], this.providerId);
  }
}

export class AviationWeatherAdapter extends WeatherProviderAdapter {
  readonly providerId = 'aviationweather-noaa';
  readonly capabilities = ['weather', 'environmental', 'environmental_risk'] as const;
  readonly priority = 'secondary' as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly currentFixture = 'aviationweather-current.json';
  readonly forecastFixture = null;
  readonly authorityClass = 'authoritative_official' as const;
}

export class PirateWeatherAdapter extends WeatherProviderAdapter {
  readonly providerId = 'pirate-weather';
  readonly capabilities = ['weather', 'precipitation'] as const;
  readonly priority = 'fallback' as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly currentFixture = 'pirate-weather-current.json';
  readonly forecastFixture = null;
  readonly authorityClass = 'reference_data' as const;
}

export class MetNorwayAdapter extends WeatherProviderAdapter {
  readonly providerId = 'met-norway';
  readonly capabilities = ['weather', 'precipitation', 'environmental'] as const;
  readonly priority = 'secondary' as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly currentFixture = 'met-norway-current.json';
  readonly forecastFixture = null;
  readonly authorityClass = 'authoritative_official' as const;
}

export class MeltemaAdapter extends WeatherProviderAdapter {
  readonly providerId = 'meltema';
  readonly capabilities = ['weather', 'precipitation'] as const;
  readonly priority = 'fallback' as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly currentFixture = 'meltema-current.json';
  readonly forecastFixture = null;
  readonly authorityClass = 'reference_data' as const;
}

export class UsgsWaterAdapter extends BaseEnvironmentalAdapter implements EnvironmentalOracleProvider {
  readonly providerId = 'usgs-water';
  readonly capabilities = ['water_data', 'environmental'] as const;
  readonly priority = 'primary' as const;
  readonly geographicScope = ['US'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async getCurrentWeather() {
    return fail('UNSUPPORTED', 'weather not supported by USGS Water', this.providerId);
  }

  async getWaterState(location: EnvironmentalLocation, nowUtc: UtcInstant) {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadEnvironmentalFixture('usgs-water.json') as Record<string, unknown>;
    return ok([normalizeWaterObservation(raw, location, this.providerId, 'authoritative_official', nowUtc)], this.providerId);
  }
}

abstract class AirQualityProviderAdapter extends BaseEnvironmentalAdapter implements EnvironmentalOracleProvider {
  abstract override readonly providerId: string;
  abstract override readonly priority: 'primary' | 'secondary' | 'fallback';
  abstract override readonly geographicScope: readonly string[];
  abstract readonly fixtureFile: string;
  abstract readonly authorityClass: 'authoritative_official' | 'reference_data' | 'community_data';
  override readonly capabilities = ['air_quality', 'environmental'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async getCurrentWeather() {
    return fail('UNSUPPORTED', 'weather not supported', this.providerId);
  }

  async getAirQuality(location: EnvironmentalLocation, nowUtc: UtcInstant) {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadEnvironmentalFixture(this.fixtureFile) as Record<string, unknown>;
    return ok(normalizeAirQualityObservation(raw, location, this.providerId, this.authorityClass, nowUtc), this.providerId);
  }
}

export class EpaAdapter extends AirQualityProviderAdapter {
  readonly providerId = 'epa';
  readonly priority = 'primary' as const;
  readonly geographicScope = ['US'] as const;
  readonly fixtureFile = 'epa-air-quality.json';
  readonly authorityClass = 'authoritative_official' as const;
}

export class KanariAdapter extends AirQualityProviderAdapter {
  readonly providerId = 'kanari';
  readonly priority = 'secondary' as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly fixtureFile = 'kanari-air-quality.json';
  readonly authorityClass = 'reference_data' as const;
}

export class OpenAqAdapter extends AirQualityProviderAdapter {
  readonly providerId = 'openaq';
  readonly priority = 'primary' as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly fixtureFile = 'openaq-air-quality.json';
  readonly authorityClass = 'reference_data' as const;
}

export class PurpleAirAdapter extends AirQualityProviderAdapter {
  readonly providerId = 'purpleair';
  readonly priority = 'secondary' as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly fixtureFile = 'purpleair-air-quality.json';
  readonly authorityClass = 'community_data' as const;
}

export class UsgsEarthquakeAdapter extends BaseEnvironmentalAdapter implements EnvironmentalOracleProvider {
  readonly providerId = 'usgs-earthquake';
  readonly capabilities = ['earthquake', 'environmental', 'environmental_risk'] as const;
  readonly priority = 'primary' as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async getCurrentWeather() {
    return fail('UNSUPPORTED', 'weather not supported', this.providerId);
  }

  async getSeismicEvents(_area: SeismicArea, _range: ForecastRange, nowUtc: UtcInstant) {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadEnvironmentalFixture('usgs-earthquake.json') as Record<string, unknown>;
    return ok([normalizeSeismicObservation(raw, this.providerId, 'authoritative_official', nowUtc)], this.providerId);
  }
}

export const ENVIRONMENTAL_ADAPTER_IDS = [
  'open-meteo',
  'open-meteo-ensemble',
  'nws',
  'aviationweather-noaa',
  'pirate-weather',
  'met-norway',
  'meltema',
  'usgs-water',
  'epa',
  'kanari',
  'usgs-earthquake',
  'openaq',
  'purpleair',
] as const;

export type EnvironmentalAdapterId = (typeof ENVIRONMENTAL_ADAPTER_IDS)[number];

export function createEnvironmentalAdapter(id: EnvironmentalAdapterId): EnvironmentalOracleProvider {
  switch (id) {
    case 'open-meteo':
      return new OpenMeteoAdapter();
    case 'open-meteo-ensemble':
      return new OpenMeteoEnsembleAdapter();
    case 'nws':
      return new NwsAdapter();
    case 'aviationweather-noaa':
      return new AviationWeatherAdapter();
    case 'pirate-weather':
      return new PirateWeatherAdapter();
    case 'met-norway':
      return new MetNorwayAdapter();
    case 'meltema':
      return new MeltemaAdapter();
    case 'usgs-water':
      return new UsgsWaterAdapter();
    case 'epa':
      return new EpaAdapter();
    case 'kanari':
      return new KanariAdapter();
    case 'usgs-earthquake':
      return new UsgsEarthquakeAdapter();
    case 'openaq':
      return new OpenAqAdapter();
    case 'purpleair':
      return new PurpleAirAdapter();
    default: {
      const _exhaustive: never = id;
      throw new Error(`unknown environmental adapter: ${_exhaustive}`);
    }
  }
}

export function createAllEnvironmentalAdapters(): readonly EnvironmentalOracleProvider[] {
  return Object.freeze(ENVIRONMENTAL_ADAPTER_IDS.map((id) => createEnvironmentalAdapter(id)));
}

export function setAdapterScenario(adapter: EnvironmentalOracleProvider, scenario: AdapterScenario): void {
  if (adapter instanceof BaseEnvironmentalAdapter) {
    adapter.setScenario(scenario);
  }
}
