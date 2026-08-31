/**
 * World integration — environmental observations for display.
 */

import type { EnvironmentalOracleService } from '../service.ts';
import type { LocationInput } from '../location.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export type WorldEnvironmentalSnapshot = {
  readonly schema: 'sunrey.world.environmental.v1';
  readonly referenceOnly: true;
  readonly officialEconomicStatistic: false;
  readonly issuanceAuthority: false;
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly city: string | null;
    readonly country: string | null;
  };
  readonly weather: readonly {
    readonly condition: string | null;
    readonly temperature: string | null;
    readonly humidity: string | null;
    readonly providerId: string;
    readonly freshness: string;
  }[];
  readonly airQuality: readonly {
    readonly pm25: string | null;
    readonly aqi: string | null;
    readonly providerId: string;
  }[];
  readonly physicalRisks: readonly {
    readonly riskType: string;
    readonly severity: string;
    readonly signal: string;
  }[];
  readonly waterAvailable: boolean;
  readonly seismicEventCount: number;
  readonly wildfireEventCount: number;
  readonly providerDisagreementCount: number;
  readonly generatedAt: UtcInstant;
};

export async function buildWorldEnvironmentalSnapshot(
  service: EnvironmentalOracleService,
  location: LocationInput,
  nowUtc: UtcInstant,
): Promise<WorldEnvironmentalSnapshot> {
  const snapshot = await service.getEnvironmentalSnapshot(location, nowUtc);
  if (!snapshot.ok) {
    return Object.freeze({
      schema: 'sunrey.world.environmental.v1',
      referenceOnly: true,
      officialEconomicStatistic: false,
      issuanceAuthority: false,
      location: Object.freeze({
        latitude: location.latitude,
        longitude: location.longitude,
        city: location.city ?? null,
        country: location.country ?? null,
      }),
      weather: Object.freeze([]),
      airQuality: Object.freeze([]),
      physicalRisks: Object.freeze([]),
      waterAvailable: false,
      seismicEventCount: 0,
      wildfireEventCount: 0,
      providerDisagreementCount: 0,
      generatedAt: nowUtc,
    });
  }

  const data = snapshot.value;
  return Object.freeze({
    schema: 'sunrey.world.environmental.v1',
    referenceOnly: true,
    officialEconomicStatistic: false,
    issuanceAuthority: false,
    location: Object.freeze({
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      city: data.location.city,
      country: data.location.country,
    }),
    weather: Object.freeze(
      data.weather.map((w) =>
        Object.freeze({
          condition: w.weatherCondition,
          temperature: w.temperature ? `${w.temperature.value} ${w.temperature.unit}` : null,
          humidity: w.humidity ? `${w.humidity.value}%` : null,
          providerId: w.providerId,
          freshness: w.freshness.status,
        }),
      ),
    ),
    airQuality: Object.freeze(
      data.airQuality.map((a) => {
        const pm25 = a.metrics.find((m) => m.pollutant === 'PM2.5');
        const aqi = a.metrics.find((m) => m.pollutant === 'AQI');
        return Object.freeze({
          pm25: pm25 ? `${pm25.value} ${pm25.unit}` : null,
          aqi: aqi ? `${aqi.value}` : null,
          providerId: a.providerId,
        });
      }),
    ),
    physicalRisks: Object.freeze(
      data.physicalRisks.map((r) =>
        Object.freeze({
          riskType: r.riskType,
          severity: r.severity,
          signal: r.observedSignal,
        }),
      ),
    ),
    waterAvailable: data.water.length > 0,
    seismicEventCount: data.seismic.length,
    wildfireEventCount: data.wildfires.length,
    providerDisagreementCount: data.providerDisagreements.length,
    generatedAt: data.generatedAt,
  });
}
