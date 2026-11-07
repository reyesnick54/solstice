/**
 * MD14 — invoke canonical MD06/09/10/13 qualification harnesses (in-platform owners).
 */

import type { UtcInstant } from '@solstice/domain';

import { evaluateMd13LiveDataResilienceQualification } from '../market-data-live/md13/qualification.ts';
import { runMd06QualificationHarness } from './md06-instrument-master/qualification.ts';
import { runMd09CryptoMarketQualification } from './md09/qualification.ts';
import { evaluateMd10Qualification } from './md10/qualification.ts';

export type Md14CanonicalProbeResult = {
  readonly packageId: string;
  readonly qualified: boolean;
  readonly marker: string;
  readonly blockers: readonly string[];
};

export function runMd14CanonicalQualificationProbes(input: {
  readonly evaluatedAt: UtcInstant;
}): readonly Md14CanonicalProbeResult[] {
  const rows: Md14CanonicalProbeResult[] = [];

  const md06 = runMd06QualificationHarness();
  rows.push(
    Object.freeze({
      packageId: 'MD06',
      qualified: md06.qualified,
      marker: md06.marker,
      blockers: md06.blockers,
    }),
  );

  const md09 = runMd09CryptoMarketQualification({ nowUtc: input.evaluatedAt });
  rows.push(
    Object.freeze({
      packageId: 'MD09',
      qualified: md09.qualified,
      marker: md09.marker,
      blockers: md09.blockers,
    }),
  );

  const md10 = evaluateMd10Qualification();
  rows.push(
    Object.freeze({
      packageId: 'MD10',
      qualified: md10.qualified,
      marker: md10.marker,
      blockers: md10.blockers,
    }),
  );

  const md13 = evaluateMd13LiveDataResilienceQualification();
  rows.push(
    Object.freeze({
      packageId: 'MD13',
      qualified: md13.qualified,
      marker: md13.marker,
      blockers: md13.blockers,
    }),
  );

  return Object.freeze(rows);
}

export function blockersFromMd14CanonicalProbes(
  probes: readonly Md14CanonicalProbeResult[],
): readonly string[] {
  const blockers: string[] = [];
  for (const row of probes) {
    if (!row.qualified) {
      for (const detail of row.blockers) {
        blockers.push(`${row.packageId}:${detail}`);
      }
      if (row.blockers.length === 0) {
        blockers.push(`${row.packageId}:${row.marker}`);
      }
    }
  }
  return Object.freeze(blockers);
}
