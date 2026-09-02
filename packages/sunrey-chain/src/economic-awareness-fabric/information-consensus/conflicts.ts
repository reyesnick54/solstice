/**
 * Material conflict and outlier detection.
 *
 * Does not average conflicting observations blindly.
 */

import type { NormalizedEconomicObservation } from '../types.ts';
import type { ConflictAssessment } from './types.ts';
import type { ConflictTolerancePolicy } from './methodology.ts';

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function stdDev(values: readonly number[], avg: number): number {
  if (values.length <= 1) {
    return 0;
  }
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function isOutlierValue(
  value: number,
  values: readonly number[],
  policy: ConflictTolerancePolicy,
): boolean {
  const med = median(values);
  const avg = mean(values);
  const deviation = stdDev(values, avg);
  const zScore = deviation > 0 ? Math.abs(value - avg) / deviation : 0;
  const medianRelativeDelta = Math.abs(value - med) / Math.max(Math.abs(med), 1e-9);
  return (
    zScore >= policy.outlierZScoreThreshold ||
    medianRelativeDelta > policy.relativeTolerance * 5
  );
}

function relativeDelta(left: number, right: number): number {
  const denominator = Math.max(Math.abs(left), Math.abs(right), 1e-9);
  return Math.abs(left - right) / denominator;
}

export function assessNumericConflicts(
  observations: readonly NormalizedEconomicObservation[],
  policy: ConflictTolerancePolicy,
): ConflictAssessment {
  const numeric = observations.filter(
    (row) => row.numericValue !== null && Number.isFinite(row.numericValue),
  );
  if (numeric.length < 2) {
    return Object.freeze({
      hasMaterialConflict: false,
      hasOutlier: false,
      withinTolerance: true,
      conflicts: Object.freeze([]),
    });
  }

  const values = numeric.map((row) => row.numericValue!);
  const avg = mean(values);
  const deviation = stdDev(values, avg);
  const conflicts: ConflictAssessment['conflicts'][number][] = [];

  for (let index = 0; index < numeric.length; index += 1) {
    for (let other = index + 1; other < numeric.length; other += 1) {
      const left = numeric[index]!;
      const right = numeric[other]!;
      const leftValue = left.numericValue!;
      const rightValue = right.numericValue!;
      const delta = relativeDelta(leftValue, rightValue);
      const absoluteDelta = Math.abs(leftValue - rightValue);
      const outlier =
        isOutlierValue(leftValue, values, policy) || isOutlierValue(rightValue, values, policy);
      const material =
        delta > policy.relativeTolerance && absoluteDelta > policy.absoluteTolerance;
      conflicts.push(
        Object.freeze({
          leftObservationId: left.observationId,
          rightObservationId: right.observationId,
          leftValue,
          rightValue,
          relativeDelta: delta,
          material,
          outlier,
        }),
      );
    }
  }

  const hasMaterialConflict = conflicts.some((row) => row.material);
  const hasOutlier = conflicts.some((row) => row.outlier);
  const withinTolerance = !hasMaterialConflict;

  return Object.freeze({
    hasMaterialConflict,
    hasOutlier,
    withinTolerance,
    conflicts: Object.freeze(conflicts),
  });
}

export function highReputationContradictedByDirectMeasurement(
  reputationScore: number,
  conflicts: ConflictAssessment,
  directMeasurementObservationIds: readonly string[],
): boolean {
  if (reputationScore < 0.7) {
    return false;
  }
  return conflicts.conflicts.some(
    (row) =>
      row.material &&
      (directMeasurementObservationIds.includes(row.leftObservationId) ||
        directMeasurementObservationIds.includes(row.rightObservationId)),
  );
}
