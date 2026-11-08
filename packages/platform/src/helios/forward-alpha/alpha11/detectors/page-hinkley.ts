import type { AlphaMonitoredMetric } from '../taxonomy.ts';
import type { DetectorAlarm } from '../types.ts';

export type PageHinkleyConfig = {
  readonly deltaMilli: number;
  readonly lambdaMilli: number;
};

export const DEFAULT_PAGE_HINKLEY_CONFIG: PageHinkleyConfig = Object.freeze({
  deltaMilli: 0,
  lambdaMilli: 5_000,
});

/**
 * Page–Hinkley style cumulative level-shift test (mean shift toward worse outcomes).
 */
export function runPageHinkleyDetector(input: {
  readonly metric: AlphaMonitoredMetric;
  readonly series: readonly number[];
  readonly worseIsLower: boolean;
  readonly config?: PageHinkleyConfig;
}): DetectorAlarm {
  const config = input.config ?? DEFAULT_PAGE_HINKLEY_CONFIG;
  const delta = config.deltaMilli / 1000;
  const lambda = config.lambdaMilli / 1000;
  if (input.series.length < 3) {
    return Object.freeze({
      detector: 'PAGE_HINKLEY',
      metric: input.metric,
      alarmed: false,
      score: 0,
      threshold: config.lambdaMilli,
      observationsUsed: input.series.length,
    });
  }
  const mu = input.series.reduce((a, b) => a + b, 0) / input.series.length;
  let cum = 0;
  let minCum = 0;
  let maxPh = 0;
  for (const x of input.series) {
    const signed = input.worseIsLower ? mu - x - delta : x - mu - delta;
    cum += signed;
    minCum = Math.min(minCum, cum);
    maxPh = Math.max(maxPh, cum - minCum);
  }
  const scoreMilli = Math.round(maxPh * 1000);
  return Object.freeze({
    detector: 'PAGE_HINKLEY',
    metric: input.metric,
    alarmed: maxPh >= lambda,
    score: scoreMilli,
    threshold: config.lambdaMilli,
    observationsUsed: input.series.length,
  });
}
