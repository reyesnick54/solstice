/**
 * Calibration metrics for earnings forecasts (research diagnostics).
 */

import type { EarningsCalibrationSnapshot } from './types.ts';
import { clampProbability, crpsStudentTApprox } from './distributions.ts';
import type { StudentTDistribution } from './types.ts';

export type CalibrationObservation = {
  readonly predictedProbability: number;
  readonly actualBinary: 0 | 1;
  readonly predictedNumeric: number;
  readonly actualNumeric: number;
  readonly numericDistribution: StudentTDistribution | null;
  readonly intervalHit: boolean | null;
};

export function brierScore(observations: readonly CalibrationObservation[]): number | null {
  if (observations.length === 0) return null;
  const sum = observations.reduce((acc, row) => {
    const p = clampProbability(row.predictedProbability);
    return acc + (p - row.actualBinary) ** 2;
  }, 0);
  return sum / observations.length;
}

export function logLoss(observations: readonly CalibrationObservation[]): number | null {
  if (observations.length === 0) return null;
  const sum = observations.reduce((acc, row) => {
    const p = clampProbability(row.predictedProbability);
    const y = row.actualBinary;
    return acc - (y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }, 0);
  return sum / observations.length;
}

export function meanAbsoluteError(observations: readonly CalibrationObservation[]): number | null {
  if (observations.length === 0) return null;
  const sum = observations.reduce((acc, row) => acc + Math.abs(row.actualNumeric - row.predictedNumeric), 0);
  return sum / observations.length;
}

export function medianAbsoluteError(observations: readonly CalibrationObservation[]): number | null {
  if (observations.length === 0) return null;
  const errors = observations.map((row) => Math.abs(row.actualNumeric - row.predictedNumeric)).sort((a, b) => a - b);
  const mid = Math.floor(errors.length / 2);
  if (errors.length % 2 === 1) return errors[mid] ?? null;
  return ((errors[mid - 1] ?? 0) + (errors[mid] ?? 0)) / 2;
}

export function crpsMean(observations: readonly CalibrationObservation[]): number | null {
  const rows = observations.filter((row) => row.numericDistribution !== null);
  if (rows.length === 0) return null;
  const sum = rows.reduce(
    (acc, row) => acc + crpsStudentTApprox(row.actualNumeric, row.numericDistribution as StudentTDistribution),
    0,
  );
  return sum / rows.length;
}

export function expectedCalibrationError(
  observations: readonly CalibrationObservation[],
  bins = 10,
): number | null {
  if (observations.length === 0) return null;
  const bucketSize = Math.max(1, Math.floor(observations.length / bins));
  const sorted = [...observations].sort((a, b) => a.predictedProbability - b.predictedProbability);
  let ece = 0;
  let counted = 0;
  for (let i = 0; i < sorted.length; i += bucketSize) {
    const slice = sorted.slice(i, i + bucketSize);
    if (slice.length === 0) continue;
    const meanPred = slice.reduce((acc, row) => acc + row.predictedProbability, 0) / slice.length;
    const meanActual = slice.reduce((acc, row) => acc + row.actualBinary, 0) / slice.length;
    ece += Math.abs(meanPred - meanActual) * slice.length;
    counted += slice.length;
  }
  return counted === 0 ? null : ece / counted;
}

export function intervalCoverage(observations: readonly CalibrationObservation[]): number | null {
  const rows = observations.filter((row) => row.intervalHit !== null);
  if (rows.length === 0) return null;
  const hits = rows.filter((row) => row.intervalHit === true).length;
  return hits / rows.length;
}

export function buildCalibrationSnapshot(observations: readonly CalibrationObservation[]): EarningsCalibrationSnapshot {
  return Object.freeze({
    brierScore: brierScore(observations),
    logLoss: logLoss(observations),
    mae: meanAbsoluteError(observations),
    medianAbsoluteError: medianAbsoluteError(observations),
    crps: crpsMean(observations),
    expectedCalibrationError: expectedCalibrationError(observations),
    intervalCoverage: intervalCoverage(observations),
    sampleCount: observations.length,
  });
}
