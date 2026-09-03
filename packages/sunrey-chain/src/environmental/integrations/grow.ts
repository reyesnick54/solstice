// @ts-nocheck
/**
 * Productive Economic Graph / Grow integration — environmental context.
 */

import type { EnvironmentalOracleService } from '../service.ts';
import type { LocationInput } from '../location.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export type GrowEnvironmentalContext = {
  readonly schema: 'sunrey.grow.environmental-context.v1';
  readonly referenceOnly: true;
  readonly mintsMoonRey: false;
  readonly setsMarketPrice: false;
  readonly agriculturalImpact: readonly {
    readonly signal: string;
    readonly providerId: string;
  }[];
  readonly energyImpact: readonly {
    readonly signal: string;
    readonly providerId: string;
  }[];
  readonly resourceAvailability: readonly {
    readonly signal: string;
    readonly providerId: string;
  }[];
  readonly generatedAt: UtcInstant;
};

export async function buildGrowEnvironmentalContext(
  service: EnvironmentalOracleService,
  location: LocationInput,
  nowUtc: UtcInstant,
): Promise<GrowEnvironmentalContext> {
  const snapshot = await service.getEnvironmentalSnapshot(location, nowUtc);
  const agricultural: GrowEnvironmentalContext['agriculturalImpact'][number][] = [];
  const energy: GrowEnvironmentalContext['energyImpact'][number][] = [];
  const resources: GrowEnvironmentalContext['resourceAvailability'][number][] = [];

  if (snapshot.ok) {
    for (const w of snapshot.value.weather) {
      if (w.precipitation && w.precipitation.value > 0) {
        agricultural.push(Object.freeze({ signal: `Precipitation ${w.precipitation.value} ${w.precipitation.unit}`, providerId: w.providerId }));
      }
      if (w.temperature) {
        energy.push(Object.freeze({ signal: `Temperature ${w.temperature.value} ${w.temperature.unit}`, providerId: w.providerId }));
      }
    }
    for (const w of snapshot.value.water) {
      resources.push(Object.freeze({ signal: `${w.measurementType}: ${w.value} ${w.unit}`, providerId: w.providerId }));
    }
  }

  return Object.freeze({
    schema: 'sunrey.grow.environmental-context.v1',
    referenceOnly: true,
    mintsMoonRey: false,
    setsMarketPrice: false,
    agriculturalImpact: Object.freeze(agricultural),
    energyImpact: Object.freeze(energy),
    resourceAvailability: Object.freeze(resources),
    generatedAt: nowUtc,
  });
}
