/**
 * Consumer BFF adapter for environmental oracle observations.
 *
 * Vendor-independent. No credentials. No raw provider APIs exposed.
 */

import {
  buildEnvironmentalAgentEvidence,
  buildGrowEnvironmentalContext,
  buildMoonReyEnvironmentalContext,
  buildRealEstateEnvironmentalContext,
  buildTravelEnvironmentalContext,
  buildWorldEnvironmentalSnapshot,
  createEnvironmentalOracleService,
  defaultEnvironmentalNow,
  environmentalSeparationProof,
  type EnvironmentalOracleService,
} from '../../../../packages/sunrey-chain/src/environmental/index.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';

export type EnvironmentalOracleBff = {
  readonly snapshot: (lat: number, lon: number) => ReturnType<typeof buildWorldEnvironmentalSnapshot>;
  readonly weather: (lat: number, lon: number) => ReturnType<EnvironmentalOracleService['getCurrentWeather']>;
  readonly forecast: (lat: number, lon: number) => ReturnType<EnvironmentalOracleService['getForecast']>;
  readonly water: (lat: number, lon: number) => ReturnType<EnvironmentalOracleService['getWaterState']>;
  readonly airQuality: (lat: number, lon: number) => ReturnType<EnvironmentalOracleService['getAirQuality']>;
  readonly seismic: (lat: number, lon: number) => ReturnType<EnvironmentalOracleService['getSeismicEvents']>;
  readonly wildfires: (lat: number, lon: number) => ReturnType<EnvironmentalOracleService['getWildfireEvents']>;
  readonly agentEvidence: (lat: number, lon: number) => ReturnType<typeof buildEnvironmentalAgentEvidence>;
  readonly growContext: (lat: number, lon: number) => ReturnType<typeof buildGrowEnvironmentalContext>;
  readonly moonreyContext: (lat: number, lon: number) => ReturnType<typeof buildMoonReyEnvironmentalContext>;
  readonly travelContext: (
    originLat: number | null,
    originLon: number | null,
    destLat: number | null,
    destLon: number | null,
  ) => ReturnType<typeof buildTravelEnvironmentalContext>;
  readonly realEstateContext: (lat: number, lon: number) => ReturnType<typeof buildRealEstateEnvironmentalContext>;
  readonly separationProof: () => ReturnType<typeof environmentalSeparationProof>;
};

const DEFAULT_LOCATION = Object.freeze({ latitude: 37.7749, longitude: -122.4194, city: 'San Francisco', country: 'US' });

export function createEnvironmentalOracleBff(
  service: EnvironmentalOracleService = createEnvironmentalOracleService(),
  nowUtc = defaultEnvironmentalNow(),
): EnvironmentalOracleBff {
  const loc = (lat: number, lon: number) =>
    Object.freeze({ latitude: lat, longitude: lon, city: DEFAULT_LOCATION.city, country: DEFAULT_LOCATION.country });

  const range = Object.freeze({
    from: nowUtc,
    to: asUtcInstant('2026-09-02T12:00:00.000Z'),
    resolution: 'hourly' as const,
  });

  const area = (lat: number, lon: number) =>
    Object.freeze({ latitude: lat, longitude: lon, radiusKm: 500 });

  return Object.freeze({
    snapshot: (lat, lon) => buildWorldEnvironmentalSnapshot(service, loc(lat, lon), nowUtc),
    weather: (lat, lon) => service.getCurrentWeather(loc(lat, lon), nowUtc),
    forecast: (lat, lon) => service.getForecast(loc(lat, lon), range, nowUtc),
    water: (lat, lon) => service.getWaterState(loc(lat, lon), nowUtc),
    airQuality: (lat, lon) => service.getAirQuality(loc(lat, lon), nowUtc),
    seismic: (lat, lon) => service.getSeismicEvents(area(lat, lon), range, nowUtc),
    wildfires: (lat, lon) => service.getWildfireEvents(loc(lat, lon), nowUtc),
    agentEvidence: (lat, lon) => buildEnvironmentalAgentEvidence(service, loc(lat, lon), nowUtc),
    growContext: (lat, lon) => buildGrowEnvironmentalContext(service, loc(lat, lon), nowUtc),
    moonreyContext: (lat, lon) => buildMoonReyEnvironmentalContext(service, loc(lat, lon), nowUtc),
    travelContext: (originLat, originLon, destLat, destLon) =>
      buildTravelEnvironmentalContext(
        service,
        originLat != null && originLon != null ? loc(originLat, originLon) : null,
        destLat != null && destLon != null ? loc(destLat, destLon) : null,
        nowUtc,
      ),
    realEstateContext: (lat, lon) => buildRealEstateEnvironmentalContext(service, loc(lat, lon), nowUtc),
    separationProof: () => environmentalSeparationProof(),
  });
}
