/**
 * Seasonal decomposition, robust z-score, and change-point heuristics.
 */

import type { UtcInstant } from '@solstice/domain';
import type { DigitalDemandAnomalyAssessment } from '../types.ts';
import { mad, mean, median, robustZ } from './numeric.ts';

const SEASON_LENGTH = 7;

function seasonalBaseline(series: readonly number[]): readonly number[] {
  if (series.length < SEASON_LENGTH * 2) {
    return Object.freeze(series.map(() => mean(series)));
  }
  const seasonal: number[] = new Array(SEASON_LENGTH).fill(0);
  const counts: number[] = new Array(SEASON_LENGTH).fill(0);
  for (let i = 0; i < series.length; i++) {
    const slot = i % SEASON_LENGTH;
    seasonal[slot]! += series[i]!;
    counts[slot]! += 1;
  }
  for (let s = 0; s < SEASON_LENGTH; s++) {
    seasonal[s] = counts[s]! > 0 ? seasonal[s]! / counts[s]! : mean(series);
  }
  return Object.freeze(series.map((_, i) => seasonal[i % SEASON_LENGTH]!));
}

function detectChangePoint(series: readonly number[]): { readonly detected: boolean; readonly index: number | null } {
  if (series.length < 8) return Object.freeze({ detected: false, index: null });
  const scale = mad(series);
  let bestIdx: number | null = null;
  let bestJump = 0;
  for (let i = 3; i < series.length - 3; i++) {
    const left = mean(series.slice(i - 3, i));
    const right = mean(series.slice(i, i + 3));
    const jump = Math.abs(right - left);
    if (jump > bestJump) {
      bestJump = jump;
      bestIdx = i;
    }
  }
  const detected = bestIdx !== null && bestJump > Math.max(scale * 2.5, 0.15);
  return Object.freeze({ detected, index: detected ? bestIdx : null });
}

export function assessDigitalDemandAnomaly(input: {
  readonly demandSeries: readonly number[];
  readonly latestLevel: number;
  readonly periodEnds: readonly UtcInstant[];
}): DigitalDemandAnomalyAssessment {
  const baseline = seasonalBaseline(input.demandSeries);
  const residuals = input.demandSeries.map((v, i) => v - baseline[i]!);
  const center = median(input.demandSeries);
  const scale = Math.max(mad(input.demandSeries), 1e-6);
  const rz = robustZ(input.latestLevel, center, scale);
  const seasonalResidual = residuals.length === 0 ? 0 : residuals[residuals.length - 1]!;
  const cp = detectChangePoint(input.demandSeries);
  const changePointAt = cp.index === null ? null : (input.periodEnds[cp.index] ?? null);

  let anomalyClass: DigitalDemandAnomalyAssessment['anomalyClass'] = 'NONE';
  if (Math.abs(rz) >= 3.5 && Math.abs(seasonalResidual) >= scale * 2) {
    anomalyClass = 'SHORT_LIVED_ATTENTION_SPIKE';
  } else if (cp.detected) {
    anomalyClass = 'CHANGE_POINT';
  } else if (Math.abs(seasonalResidual) >= scale * 1.5) {
    anomalyClass = 'SEASONAL_RESIDUAL';
  } else if (Math.abs(rz) >= 2 && Math.sign(rz) === Math.sign(mean(residuals.slice(-4)))) {
    anomalyClass = 'PERSISTENT_TREND';
  }

  const spikeNotTreatedAsSales = anomalyClass !== 'PERSISTENT_TREND';
  const attentionToSales =
    anomalyClass === 'SHORT_LIVED_ATTENTION_SPIKE'
      ? 'NOT_INFERRED'
      : anomalyClass === 'PERSISTENT_TREND'
        ? 'REQUIRES_CORROBORATION'
        : 'QUALIFIED_ATTENTION_ONLY';

  return Object.freeze({
    anomalyClass,
    robustZ: rz,
    seasonalResidual,
    changePointDetected: cp.detected,
    changePointAt,
    attentionToSales,
    spikeNotTreatedAsSales,
  });
}
