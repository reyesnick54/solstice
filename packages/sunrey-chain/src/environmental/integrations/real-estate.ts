/**
 * Real Estate integration — optional contextual environmental evidence.
 */

import type { EnvironmentalOracleService } from '../service.ts';
import type { LocationInput } from '../location.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';

export type RealEstateEnvironmentalContext = {
  readonly schema: 'sunrey.real-estate.environmental-context.v1';
  readonly referenceOnly: true;
  readonly automatedValuation: false;
  readonly climateContext: string | null;
  readonly waterAvailability: string | null;
  readonly airQuality: string | null;
  readonly earthquakeExposure: boolean;
  readonly wildfireEvents: number;
  readonly physicalRisks: readonly string[];
  readonly generatedAt: UtcInstant;
};

export async function buildRealEstateEnvironmentalContext(
  service: EnvironmentalOracleService,
  location: LocationInput,
  nowUtc: UtcInstant,
): Promise<RealEstateEnvironmentalContext> {
  const snapshot = await service.getEnvironmentalSnapshot(location, nowUtc);
  if (!snapshot.ok) {
    return Object.freeze({
      schema: 'sunrey.real-estate.environmental-context.v1',
      referenceOnly: true,
      automatedValuation: false,
      climateContext: null,
      waterAvailability: null,
      airQuality: null,
      earthquakeExposure: false,
      wildfireEvents: 0,
      physicalRisks: Object.freeze([]),
      generatedAt: nowUtc,
    });
  }

  const data = snapshot.value;
  const avgTemp = data.weather.length > 0 && data.weather[0]?.temperature
    ? `${data.weather[0].temperature.value} ${data.weather[0].temperature.unit}`
    : null;
  const water = data.water[0]
    ? `${data.water[0].measurementType}: ${data.water[0].value} ${data.water[0].unit}`
    : null;
  const air = data.airQuality[0]
    ? `PM2.5: ${data.airQuality[0].metrics.find((m) => m.pollutant === 'PM2.5')?.value ?? 'N/A'}`
    : null;

  return Object.freeze({
    schema: 'sunrey.real-estate.environmental-context.v1',
    referenceOnly: true,
    automatedValuation: false,
    climateContext: avgTemp,
    waterAvailability: water,
    airQuality: air,
    earthquakeExposure: data.seismic.some((s) => s.magnitude >= 4),
    wildfireEvents: data.wildfires.length,
    physicalRisks: Object.freeze(data.physicalRisks.map((r) => r.riskType)),
    generatedAt: nowUtc,
  });
}
