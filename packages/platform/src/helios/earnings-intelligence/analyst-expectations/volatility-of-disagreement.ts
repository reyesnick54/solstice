/**
 * Volatility of disagreement (VoD) — instability of dispersion over time.
 */

import type { ConsensusSnapshot } from './types.ts';
import { mean, sampleStandardDeviation, volatilityOfSeries } from './statistics.ts';

export type DispersionThresholds = {
  readonly highCurrentDispersion: number;
  readonly unstableVoD: number;
};

export const DEFAULT_DISPERSION_THRESHOLDS: DispersionThresholds = Object.freeze({
  highCurrentDispersion: 0.35,
  unstableVoD: 0.15,
});

export function buildForecastDispersionState(input: {
  readonly currentConsensus: ConsensusSnapshot;
  readonly historicalConsensusSnapshots: readonly ConsensusSnapshot[];
  readonly thresholds?: DispersionThresholds;
}): import('./types.ts').ForecastDispersionState {
  const thresholds = input.thresholds ?? DEFAULT_DISPERSION_THRESHOLDS;
  const historicalDispersionSeries = input.historicalConsensusSnapshots.map((s) => s.dispersion);
  const series =
    historicalDispersionSeries.length > 0
      ? historicalDispersionSeries
      : [input.currentConsensus.dispersion];

  const volatilityOfDisagreement = volatilityOfSeries(series);
  const currentDispersion = input.currentConsensus.dispersion;
  const avgHistorical = mean(series);

  return Object.freeze({
    currentDispersion,
    historicalDispersionSeries: Object.freeze(series),
    volatilityOfDisagreement,
    highCurrentDispersion: currentDispersion >= thresholds.highCurrentDispersion,
    unstableDispersionOverTime:
      volatilityOfDisagreement >= thresholds.unstableVoD
      && volatilityOfDisagreement > currentDispersion * 0.5,
  });
}

/** Rolling VoD from ordered consensus snapshots (one row per period). */
export function rollingVolatilityOfDisagreement(
  snapshots: readonly ConsensusSnapshot[],
  windowSize = 4,
): number {
  if (snapshots.length < 2) return 0;
  const dispersions = snapshots.map((s) => s.dispersion);
  if (dispersions.length <= windowSize) {
    return volatilityOfSeries(dispersions);
  }
  const window = dispersions.slice(-windowSize);
  return sampleStandardDeviation(window);
}
