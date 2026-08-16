import { err, ok, type Result } from '../../../domain/src/result.ts';
import type {
  AggregationPolicy,
  FixedQuantity,
  ObservationWindow,
  OracleFeedDefinition,
  OracleObservation,
  OracleRejection,
  QualityStatus,
} from './types.ts';
import { sameUnitAndScale } from './units.ts';

export type AggregationOutcome = {
  readonly quality: Extract<QualityStatus, 'VERIFIED' | 'CONFLICTED'>;
  readonly value: FixedQuantity | null;
  readonly sourceObservationIds: readonly string[];
  readonly window: ObservationWindow;
  readonly reason: string | null;
};

function sortedByValue(rows: readonly OracleObservation[]): OracleObservation[] {
  return [...rows].sort((left, right) => {
    if (left.value.mantissa === right.value.mantissa) {
      return left.observationId < right.observationId ? -1 : 1;
    }
    return left.value.mantissa < right.value.mantissa ? -1 : 1;
  });
}

function integerMedian(values: readonly bigint[]): bigint {
  const n = values.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return values[mid]!;
  }
  return (values[mid - 1]! + values[mid]!) / 2n;
}

function weightedMedian(rows: readonly OracleObservation[]): bigint {
  const ordered = sortedByValue(rows);
  const total = ordered.reduce((sum, row) => sum + row.weight, 0n);
  const threshold = (total + 1n) / 2n;
  let acc = 0n;
  for (const row of ordered) {
    acc += row.weight;
    if (acc >= threshold) {
      return row.value.mantissa;
    }
  }
  return ordered[ordered.length - 1]!.value.mantissa;
}

function categoricalQuorum(rows: readonly OracleObservation[], quorum: number): bigint | null {
  const counts = new Map<string, { readonly value: bigint; count: number }>();
  for (const row of rows) {
    const key = row.value.mantissa.toString();
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { value: row.value.mantissa, count: 1 });
    }
  }
  let best: { readonly value: bigint; count: number } | null = null;
  let tied = false;
  for (const entry of [...counts.values()].sort((a, b) => (a.value < b.value ? -1 : 1))) {
    if (!best || entry.count > best.count) {
      best = entry;
      tied = false;
    } else if (entry.count === best.count) {
      tied = true;
    }
  }
  if (!best || tied || best.count < quorum) {
    return null;
  }
  return best.value;
}

export function spreadOf(rows: readonly OracleObservation[]): bigint {
  const values = rows.map((row) => row.value.mantissa);
  const min = values.reduce((a, b) => (a < b ? a : b));
  const max = values.reduce((a, b) => (a > b ? a : b));
  return max - min;
}

export function aggregateObservations(
  feed: OracleFeedDefinition,
  rows: readonly OracleObservation[],
): Result<AggregationOutcome, OracleRejection> {
  if (rows.length === 0) {
    return err({ code: 'ORACLE_INSUFFICIENT_QUORUM', detail: 'no observations in window' });
  }
  const unit = rows[0]!.value;
  for (const row of rows) {
    if (!sameUnitAndScale(unit, row.value) || row.value.unit !== feed.measurementUnit) {
      return err({ code: 'ORACLE_INCOMPATIBLE_UNITS', detail: 'window contains mixed units or scales' });
    }
  }
  const ids = [...rows].map((row) => row.observationId).sort();
  const window: ObservationWindow = Object.freeze({
    startUnix: rows.reduce(
      (min, row) => (row.measurementStartUnix < min ? row.measurementStartUnix : min),
      rows[0]!.measurementStartUnix,
    ),
    endUnix: rows.reduce(
      (max, row) => (row.measurementEndUnix > max ? row.measurementEndUnix : max),
      rows[0]!.measurementEndUnix,
    ),
  });
  const conflict = (
    reason: string,
  ): AggregationOutcome =>
    Object.freeze({
      quality: 'CONFLICTED',
      value: null,
      sourceObservationIds: ids,
      window,
      reason,
    });

  if (spreadOf(rows) > feed.maxObservationSpread) {
    return ok(conflict('observation spread exceeds feed maximum'));
  }

  const policy: AggregationPolicy = feed.aggregationPolicy;
  if (policy === 'QUORUM_MATCH') {
    const first = rows[0]!.value.mantissa;
    if (rows.every((row) => row.value.mantissa === first)) {
      return ok(
        Object.freeze({
          quality: 'VERIFIED',
          value: unit,
          sourceObservationIds: ids,
          window,
          reason: null,
        }),
      );
    }
    return ok(conflict('quorum match failed; values disagree'));
  }

  if (policy === 'CATEGORICAL_QUORUM') {
    const winner = categoricalQuorum(rows, feed.minimumQuorum);
    if (winner === null) {
      return ok(conflict('categorical quorum not reached or tied'));
    }
    return ok(
      Object.freeze({
        quality: 'VERIFIED',
        value: Object.freeze({ ...unit, mantissa: winner }),
        sourceObservationIds: ids,
        window,
        reason: null,
      }),
    );
  }

  let working = [...rows];
  if (policy === 'TRIMMED_MEDIAN') {
    if (feed.trimCount < 0 || !Number.isInteger(feed.trimCount)) {
      return err({ code: 'ORACLE_SCHEMA_INVALID', detail: 'trimCount must be a non-negative integer' });
    }
    if (working.length <= feed.trimCount * 2) {
      return ok(conflict('trimmed median removed the entire window'));
    }
    working = sortedByValue(working).slice(feed.trimCount, working.length - feed.trimCount);
  }

  const mantissa =
    policy === 'WEIGHTED_MEDIAN'
      ? weightedMedian(working)
      : integerMedian(sortedByValue(working).map((row) => row.value.mantissa));

  return ok(
    Object.freeze({
      quality: 'VERIFIED',
      value: Object.freeze({ ...unit, mantissa }),
      sourceObservationIds: ids,
      window,
      reason: null,
    }),
  );
}

export function medianOf(values: readonly bigint[]): bigint {
  return integerMedian([...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function weightedMedianOf(pairs: readonly { readonly value: bigint; readonly weight: bigint }[]): bigint {
  const rows = pairs.map((pair, index) => ({
    value: { schemaVersion: 1 as const, mantissa: pair.value, scale: 0, unit: 'units_produced' as const },
    weight: pair.weight,
    observationId: `w${index}`,
  })) as unknown as OracleObservation[];
  return weightedMedian(rows);
}
