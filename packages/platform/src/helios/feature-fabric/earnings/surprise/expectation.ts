/**
 * Pre-release expectation snapshots — sources are never merged silently.
 */

import type { UtcInstant } from '@solstice/domain';
import type { EarningsExpectationSource } from './taxonomy.ts';
import type {
  ExpectationDispersionInput,
  ExpectationPointInput,
  PreReleaseExpectationSnapshot,
} from './types.ts';

export type ExpectationSnapshotBuildInput = {
  readonly snapshotId: string;
  readonly canonicalEntityId: string;
  readonly fiscalPeriod: string;
  readonly cutoffUtc: UtcInstant;
  readonly points: readonly ExpectationPointInput[];
  readonly dispersions: readonly ExpectationDispersionInput[];
};

export function buildPreReleaseExpectationSnapshot(
  input: ExpectationSnapshotBuildInput,
): PreReleaseExpectationSnapshot {
  assertSingleSourcePerPoint(input.points);
  assertSingleSourcePerDispersion(input.dispersions);
  rejectFutureExpectations(input.cutoffUtc, input.points, input.dispersions);

  const knowableAt = latestKnowableAt(input.cutoffUtc, [
    ...input.points.map((row) => row.knowableAt),
    ...input.dispersions.map((row) => row.knowableAt),
  ]);

  return Object.freeze({
    snapshotId: input.snapshotId,
    canonicalEntityId: input.canonicalEntityId,
    fiscalPeriod: input.fiscalPeriod,
    cutoffUtc: input.cutoffUtc,
    knowableAt,
    points: Object.freeze([...input.points]),
    dispersions: Object.freeze([...input.dispersions]),
    grantsExecutionAuthority: false as const,
  });
}

export function filterExpectationsAtCutoff<T extends { readonly knowableAt: UtcInstant }>(
  cutoffUtc: UtcInstant,
  rows: readonly T[],
): readonly T[] {
  const cutoffMs = Date.parse(cutoffUtc);
  return Object.freeze(rows.filter((row) => Date.parse(row.knowableAt) <= cutoffMs));
}

export function pointsForSource(
  snapshot: PreReleaseExpectationSnapshot,
  source: EarningsExpectationSource,
): readonly ExpectationPointInput[] {
  return Object.freeze(snapshot.points.filter((row) => row.source === source));
}

export function dispersionForSource(
  snapshot: PreReleaseExpectationSnapshot,
  source: EarningsExpectationSource,
): readonly ExpectationDispersionInput[] {
  return Object.freeze(snapshot.dispersions.filter((row) => row.source === source));
}

export function assertExpectationSnapshotPreEvent(input: {
  readonly snapshot: PreReleaseExpectationSnapshot;
  readonly actualKnowableAt: UtcInstant;
}): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
  const snapMs = Date.parse(input.snapshot.knowableAt);
  const actualMs = Date.parse(input.actualKnowableAt);
  if (!Number.isFinite(snapMs) || !Number.isFinite(actualMs)) {
    return { ok: false, code: 'INVALID_TIME', message: 'invalid utc instant' };
  }
  if (snapMs > actualMs) {
    return {
      ok: false,
      code: 'EXPECTATION_AFTER_ACTUAL',
      message: 'expectation snapshot must be knowable before reported actual',
    };
  }
  if (Date.parse(input.snapshot.cutoffUtc) > actualMs) {
    return {
      ok: false,
      code: 'CUTOFF_AFTER_ACTUAL',
      message: 'expectation cutoff must not exceed actual knowability',
    };
  }
  return { ok: true };
}

function assertSingleSourcePerPoint(points: readonly ExpectationPointInput[]): void {
  const seen = new Map<string, EarningsExpectationSource>();
  for (const point of points) {
    const key = dimensionKey(point.dimension, point.segmentId, point.fiscalPeriod);
    const prior = seen.get(key);
    if (prior !== undefined && prior !== point.source) {
      throw new Error(`conflicting expectation sources for ${key}: ${prior} vs ${point.source}`);
    }
    seen.set(key, point.source);
  }
}

function assertSingleSourcePerDispersion(rows: readonly ExpectationDispersionInput[]): void {
  const seen = new Map<string, EarningsExpectationSource>();
  for (const row of rows) {
    const key = dimensionKey(row.dimension, row.segmentId, row.fiscalPeriod);
    const prior = seen.get(key);
    if (prior !== undefined && prior !== row.source) {
      throw new Error(`conflicting dispersion sources for ${key}: ${prior} vs ${row.source}`);
    }
    seen.set(key, row.source);
  }
}

function rejectFutureExpectations(
  cutoffUtc: UtcInstant,
  points: readonly ExpectationPointInput[],
  dispersions: readonly ExpectationDispersionInput[],
): void {
  const cutoffMs = Date.parse(cutoffUtc);
  for (const point of points) {
    if (Date.parse(point.knowableAt) > cutoffMs) {
      throw new Error(`expectation ${point.observationRef} not knowable at cutoff`);
    }
  }
  for (const row of dispersions) {
    if (Date.parse(row.knowableAt) > cutoffMs) {
      throw new Error(`dispersion for ${row.dimension} not knowable at cutoff`);
    }
  }
}

function latestKnowableAt(fallback: UtcInstant, instants: readonly UtcInstant[]): UtcInstant {
  let latest = fallback;
  for (const instant of instants) {
    if (Date.parse(instant) > Date.parse(latest)) {
      latest = instant;
    }
  }
  return latest;
}

export function dimensionKey(
  dimension: string,
  segmentId: string | null,
  fiscalPeriod: string,
): string {
  return `${dimension}|${segmentId ?? 'consolidated'}|${fiscalPeriod}`;
}
