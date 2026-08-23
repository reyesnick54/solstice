/**
 * Productive-economy aggregates with observation traceability.
 * Region rollups stay at safe precision. Totals are verified input,
 * not MoonRey supply and not Exchange price.
 */

import { verificationEligibleForValuation } from './verification.ts';
import type { EconomicObservation, ProductiveEconomyCategory } from './types.ts';

export type ProductiveAggregate = {
  readonly dimension: 'CATEGORY' | 'REGION' | 'PERIOD' | 'SOURCE' | 'QUALITY' | 'TOTAL_VERIFIED_INPUT';
  readonly key: string;
  readonly category: ProductiveEconomyCategory | 'ALL';
  readonly canonicalUnit: string;
  readonly value: bigint;
  readonly observationIds: readonly string[];
  readonly quality: string;
  readonly setsMarketPrice: false;
  readonly mintsMoonRey: false;
};

export function aggregateObservations(
  observations: readonly EconomicObservation[],
  nowUtc: string,
): readonly ProductiveAggregate[] {
  void nowUtc;
  const verified = observations.filter(
    (row) =>
      row.status === 'VERIFIED' &&
      verificationEligibleForValuation(row.verification) &&
      row.freshness.usableForTimeSensitiveValuation,
  );
  const byCategory = new Map<string, EconomicObservation[]>();
  const byRegion = new Map<string, EconomicObservation[]>();
  const byPeriod = new Map<string, EconomicObservation[]>();
  const bySource = new Map<string, EconomicObservation[]>();
  const byQuality = new Map<string, EconomicObservation[]>();
  for (const row of verified) {
    push(byCategory, row.category, row);
    push(byRegion, row.provenance.sourceClass, row);
    push(byPeriod, row.timestampUtc.slice(0, 10), row);
    push(bySource, row.source, row);
    push(byQuality, row.verification, row);
  }
  return Object.freeze([
    ...project('CATEGORY', byCategory),
    ...project('SOURCE', bySource),
    ...project('PERIOD', byPeriod),
    ...project('QUALITY', byQuality),
    ...project('REGION', byRegion),
    totalVerified(verified),
  ]);
}

function project(
  dimension: ProductiveAggregate['dimension'],
  groups: Map<string, EconomicObservation[]>,
): readonly ProductiveAggregate[] {
  return [...groups.entries()].map(([key, rows]) =>
    Object.freeze({
      dimension,
      key,
      category: rows[0]?.category ?? 'ALL',
      canonicalUnit: rows[0]?.canonicalUnit ?? 'NONE',
      value: rows.reduce((sum, row) => sum + row.canonicalValue, 0n),
      observationIds: Object.freeze(rows.map((row) => row.observationId)),
      quality: rows[0]?.verification ?? 'INVALID',
      setsMarketPrice: false,
      mintsMoonRey: false,
    }),
  );
}

function totalVerified(rows: readonly EconomicObservation[]): ProductiveAggregate {
  return Object.freeze({
    dimension: 'TOTAL_VERIFIED_INPUT',
    key: 'ALL',
    category: 'ALL',
    canonicalUnit: 'MIXED_TRACEABLE',
    value: rows.reduce((sum, row) => sum + row.canonicalValue, 0n),
    observationIds: Object.freeze(rows.map((row) => row.observationId)),
    quality: 'VERIFIED_ONLY',
    setsMarketPrice: false,
    mintsMoonRey: false,
  });
}

function push(map: Map<string, EconomicObservation[]>, key: string, row: EconomicObservation): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(row);
    return;
  }
  map.set(key, [row]);
}
