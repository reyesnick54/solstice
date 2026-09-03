// @ts-nocheck
/**
 * Travel integration — environmental context for origin/destination.
 */

import type { EnvironmentalOracleService } from '../service.ts';
import type { LocationInput } from '../location.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export type TravelEnvironmentalContext = {
  readonly schema: 'sunrey.travel.environmental-context.v1';
  readonly referenceOnly: true;
  readonly bookingAuthorized: false;
  readonly origin: {
    readonly weather: string | null;
    readonly airQuality: string | null;
    readonly severeConditions: boolean;
  } | null;
  readonly destination: {
    readonly weather: string | null;
    readonly airQuality: string | null;
    readonly severeConditions: boolean;
    readonly aviationWeatherAvailable: boolean;
  } | null;
  readonly generatedAt: UtcInstant;
};

async function locationContext(
  service: EnvironmentalOracleService,
  location: LocationInput,
  nowUtc: UtcInstant,
) {
  const weather = await service.getCurrentWeather(location, nowUtc);
  const air = await service.getAirQuality(location, nowUtc);
  const weatherSummary = weather.ok && weather.value[0]
    ? `${weather.value[0].weatherCondition ?? 'unknown'}, ${weather.value[0].temperature?.value ?? 'N/A'}°C`
    : null;
  const airSummary = air.ok && air.value[0]
    ? `PM2.5: ${air.value[0].metrics.find((m) => m.pollutant === 'PM2.5')?.value ?? 'N/A'}`
    : null;
  const severe = weather.ok && weather.value.some(
    (w) => w.windSpeed && w.windSpeed.value > 20 && w.windSpeed.unit === 'm/s',
  );
  return Object.freeze({ weather: weatherSummary, airQuality: airSummary, severeConditions: severe ?? false });
}

export async function buildTravelEnvironmentalContext(
  service: EnvironmentalOracleService,
  origin: LocationInput | null,
  destination: LocationInput | null,
  nowUtc: UtcInstant,
): Promise<TravelEnvironmentalContext> {
  const originCtx = origin ? await locationContext(service, origin, nowUtc) : null;
  const destCtx = destination ? await locationContext(service, destination, nowUtc) : null;

  return Object.freeze({
    schema: 'sunrey.travel.environmental-context.v1',
    referenceOnly: true,
    bookingAuthorized: false,
    origin: originCtx,
    destination: destCtx
      ? Object.freeze({ ...destCtx, aviationWeatherAvailable: true })
      : null,
    generatedAt: nowUtc,
  });
}
