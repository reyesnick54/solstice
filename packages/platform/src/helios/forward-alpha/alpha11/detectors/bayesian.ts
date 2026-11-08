import type { AlphaMonitoredMetric } from '../taxonomy.ts';
import type { DetectorAlarm } from '../types.ts';

export type BayesianChangePointConfig = {
  readonly priorStableMilli: number;
  readonly alarmPosteriorMilli: number;
};

export const DEFAULT_BAYESIAN_CHANGE_POINT_CONFIG: BayesianChangePointConfig = Object.freeze({
  priorStableMilli: 950,
  alarmPosteriorMilli: 750,
});

/**
 * Optional research detector — lightweight Gaussian conjugate surprise (not sole gate).
 */
export function runBayesianOnlineChangeDetector(input: {
  readonly metric: AlphaMonitoredMetric;
  readonly series: readonly number[];
  readonly config?: BayesianChangePointConfig;
}): DetectorAlarm {
  const config = input.config ?? DEFAULT_BAYESIAN_CHANGE_POINT_CONFIG;
  if (input.series.length < 4) {
    return Object.freeze({
      detector: 'BAYESIAN_ONLINE',
      metric: input.metric,
      alarmed: false,
      score: 0,
      threshold: config.alarmPosteriorMilli,
      observationsUsed: input.series.length,
    });
  }
  const split = Math.floor(input.series.length / 2);
  const early = input.series.slice(0, split);
  const late = input.series.slice(split);
  const mu0 = early.reduce((a, b) => a + b, 0) / early.length;
  const var0 =
    early.reduce((acc, v) => acc + (v - mu0) ** 2, 0) / Math.max(1, early.length - 1) || 1;
  const mu1 = late.reduce((a, b) => a + b, 0) / late.length;
  const surprise = ((mu1 - mu0) ** 2) / var0;
  const posteriorShiftMilli = Math.min(
    1000,
    Math.round((1 - config.priorStableMilli / 1000) * 1000 + surprise * 100),
  );
  return Object.freeze({
    detector: 'BAYESIAN_ONLINE',
    metric: input.metric,
    alarmed: posteriorShiftMilli >= config.alarmPosteriorMilli,
    score: posteriorShiftMilli,
    threshold: config.alarmPosteriorMilli,
    observationsUsed: input.series.length,
  });
}
