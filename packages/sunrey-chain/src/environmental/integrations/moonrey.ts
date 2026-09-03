// @ts-nocheck
/**
 * MoonRey integration — environmental observations as economic input context only.
 */

import type { EnvironmentalOracleService } from '../service.ts';
import type { LocationInput } from '../location.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export type MoonReyEnvironmentalContext = {
  readonly schema: 'sunrey.moonrey.environmental-context.v1';
  readonly issuanceAuthority: false;
  readonly minted: false;
  readonly observationCount: number;
  readonly gpuvInputSummary: string;
  readonly categories: readonly string[];
};

export async function buildMoonReyEnvironmentalContext(
  service: EnvironmentalOracleService,
  location: LocationInput,
  nowUtc: UtcInstant,
): Promise<MoonReyEnvironmentalContext> {
  const snapshot = await service.getEnvironmentalSnapshot(location, nowUtc);
  const count = snapshot.ok
    ? snapshot.value.weather.length +
      snapshot.value.water.length +
      snapshot.value.airQuality.length +
      snapshot.value.seismic.length
    : 0;

  const categories: string[] = [];
  if (snapshot.ok) {
    if (snapshot.value.weather.length > 0) categories.push('WEATHER');
    if (snapshot.value.water.length > 0) categories.push('WATER');
    if (snapshot.value.airQuality.length > 0) categories.push('AIR_QUALITY');
    if (snapshot.value.seismic.length > 0) categories.push('SEISMIC');
    if (snapshot.value.physicalRisks.length > 0) categories.push('PHYSICAL_RISK');
  }

  return Object.freeze({
    schema: 'sunrey.moonrey.environmental-context.v1',
    issuanceAuthority: false,
    minted: false,
    observationCount: count,
    gpuvInputSummary: `${count} verified environmental observations available as economic input context`,
    categories: Object.freeze(categories),
  });
}
