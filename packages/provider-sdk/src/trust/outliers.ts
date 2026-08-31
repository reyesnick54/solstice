/**
 * Deterministic outlier detection for numeric observations.
 */

import type { OutlierStatus } from './types.ts';

export type OutlierDetectionResult = {
  readonly observationId: string;
  readonly status: OutlierStatus;
  readonly deviationPercent: number | null;
};

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function detectNumericOutliers(
  entries: readonly { readonly observationId: string; readonly value: number }[],
  tolerancePercent: number,
): readonly OutlierDetectionResult[] {
  if (entries.length < 3) {
    return Object.freeze(
      entries.map((e) =>
        Object.freeze({ observationId: e.observationId, status: 'NONE' as OutlierStatus, deviationPercent: null }),
      ),
    );
  }
  const values = entries.map((e) => e.value);
  const med = median(values);
  if (med === null || med === 0) {
    return Object.freeze(
      entries.map((e) =>
        Object.freeze({ observationId: e.observationId, status: 'NONE' as OutlierStatus, deviationPercent: null }),
      ),
    );
  }
  const deviations = values.map((v) => Math.abs((v - med) / med) * 100);
  const iqr = interquartileRange(values);
  const iqrThreshold = med + 1.5 * iqr;
  const iqrLower = med - 1.5 * iqr;

  return Object.freeze(
    entries.map((e, i) => {
      const deviationPercent = deviations[i]!;
      const beyondPercent = deviationPercent > tolerancePercent;
      const beyondIqr = e.value > iqrThreshold || e.value < iqrLower;
      if (beyondPercent && beyondIqr) {
        return Object.freeze({
          observationId: e.observationId,
          status: 'OUTLIER' as OutlierStatus,
          deviationPercent: Math.round(deviationPercent * 10) / 10,
        });
      }
      if (beyondPercent) {
        return Object.freeze({
          observationId: e.observationId,
          status: 'SUSPECTED_OUTLIER' as OutlierStatus,
          deviationPercent: Math.round(deviationPercent * 10) / 10,
        });
      }
      return Object.freeze({
        observationId: e.observationId,
        status: 'NONE' as OutlierStatus,
        deviationPercent: Math.round(deviationPercent * 10) / 10,
      });
    }),
  );
}

function interquartileRange(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length / 4)] ?? 0;
  const q3 = sorted[Math.floor((3 * sorted.length) / 4)] ?? 0;
  return q3 - q1;
}

export function valuesDisagreeBeyondTolerance(
  values: readonly number[],
  tolerancePercent: number,
): boolean {
  if (values.length < 2) return false;
  const med = median(values);
  if (med === null || med === 0) return false;
  for (const v of values) {
    const pct = Math.abs((v - med) / med) * 100;
    if (pct > tolerancePercent) {
      return true;
    }
  }
  return false;
}
