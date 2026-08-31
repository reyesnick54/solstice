/**
 * Wave 5 Environmental Oracle — weather and environmental travel context.
 * Consumed by TravelIntelligenceService; Travel does not duplicate weather calls.
 */

import { TravelIntelligenceCache } from '../travel-intelligence/cache.ts';

export type EnvironmentalObservation = {
  readonly locationId: string;
  readonly locationName: string;
  readonly temperatureCelsius: number | null;
  readonly conditions: string | null;
  readonly severeWeatherAlert: string | null;
  readonly aviationWeatherNote: string | null;
  readonly retrievedAt: string;
  readonly providerId: string;
  readonly simulation: true;
  readonly referenceOnly: true;
};

const FIXTURE_WEATHER: Readonly<Record<string, EnvironmentalObservation>> = Object.freeze({
  RUH: Object.freeze({
    locationId: 'RUH',
    locationName: 'Riyadh',
    temperatureCelsius: 42,
    conditions: 'clear',
    severeWeatherAlert: null,
    aviationWeatherNote: 'High temperature; density altitude considerations for departures.',
    retrievedAt: '2026-08-31T12:00:00.000Z',
    providerId: 'environmental-oracle',
    simulation: true,
    referenceOnly: true,
  }),
  SA: Object.freeze({
    locationId: 'SA',
    locationName: 'Saudi Arabia',
    temperatureCelsius: 40,
    conditions: 'hot and dry',
    severeWeatherAlert: null,
    aviationWeatherNote: null,
    retrievedAt: '2026-08-31T12:00:00.000Z',
    providerId: 'environmental-oracle',
    simulation: true,
    referenceOnly: true,
  }),
  JFK: Object.freeze({
    locationId: 'JFK',
    locationName: 'New York',
    temperatureCelsius: 24,
    conditions: 'partly cloudy',
    severeWeatherAlert: null,
    aviationWeatherNote: null,
    retrievedAt: '2026-08-31T12:00:00.000Z',
    providerId: 'environmental-oracle',
    simulation: true,
    referenceOnly: true,
  }),
});

export type EnvironmentalOracleServiceOptions = {
  readonly cache?: TravelIntelligenceCache;
  readonly nowUtc?: () => string;
};

export class EnvironmentalOracleService {
  readonly #cache: TravelIntelligenceCache;
  readonly #nowUtc: () => string;

  constructor(options: EnvironmentalOracleServiceOptions = {}) {
    this.#cache = options.cache ?? new TravelIntelligenceCache();
    this.#nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  getDestinationWeather(locationId: string): EnvironmentalObservation | null {
    const key = `weather:${locationId.toUpperCase()}`;
    const cached = this.#cache.get<EnvironmentalObservation>(key);
    if (cached) return cached.value;

    const observation = FIXTURE_WEATHER[locationId.toUpperCase()] ?? null;
    if (observation) {
      this.#cache.set(key, observation, 'aviation_weather');
    }
    return observation;
  }

  getSevereWeatherContext(locationId: string): Record<string, unknown> {
    const weather = this.getDestinationWeather(locationId);
    return Object.freeze({
      locationId: locationId.toUpperCase(),
      severeWeatherAlert: weather?.severeWeatherAlert ?? null,
      aviationWeatherNote: weather?.aviationWeatherNote ?? null,
      retrievedAt: this.#nowUtc(),
      referenceOnly: true,
      simulation: true,
    });
  }

  getAviationWeather(airportId: string): EnvironmentalObservation | null {
    return this.getDestinationWeather(airportId);
  }
}

export function createEnvironmentalOracleSandbox(): EnvironmentalOracleService {
  return new EnvironmentalOracleService();
}
