import type { AlphaMonitoredMetric } from '../taxonomy.ts';
import type { DetectorAlarm } from '../types.ts';

export type CusumDetectorConfig = {
  readonly slackMilli: number;
  readonly decisionIntervalMilli: number;
};

export const DEFAULT_CUSUM_CONFIG: CusumDetectorConfig = Object.freeze({
  slackMilli: 500,
  decisionIntervalMilli: 5_000,
});

/**
 * Two-sided CUSUM on standardized residuals (transparent mu/sigma from the window).
 */
export function runCusumDetector(input: {
  readonly metric: AlphaMonitoredMetric;
  readonly series: readonly number[];
  readonly config?: CusumDetectorConfig;
}): DetectorAlarm {
  const config = input.config ?? DEFAULT_CUSUM_CONFIG;
  const k = config.slackMilli / 1000;
  const h = config.decisionIntervalMilli / 1000;
  if (input.series.length < 3) {
    return Object.freeze({
      detector: 'CUSUM',
      metric: input.metric,
      alarmed: false,
      score: 0,
      threshold: config.decisionIntervalMilli,
      observationsUsed: input.series.length,
    });
  }
  const mu = input.series.reduce((a, b) => a + b, 0) / input.series.length;
  const variance =
    input.series.reduce((acc, v) => acc + (v - mu) ** 2, 0) / Math.max(1, input.series.length - 1);
  const sigma = Math.sqrt(variance) || 1;
  let sPos = 0;
  let sNeg = 0;
  let maxStat = 0;
  for (const raw of input.series) {
    const x = (raw - mu) / sigma;
    sPos = Math.max(0, sPos + x - k);
    sNeg = Math.max(0, sNeg - x - k);
    maxStat = Math.max(maxStat, sPos, sNeg);
  }
  const scoreMilli = Math.round(maxStat * 1000);
  return Object.freeze({
    detector: 'CUSUM',
    metric: input.metric,
    alarmed: maxStat >= h,
    score: scoreMilli,
    threshold: config.decisionIntervalMilli,
    observationsUsed: input.series.length,
  });
}
