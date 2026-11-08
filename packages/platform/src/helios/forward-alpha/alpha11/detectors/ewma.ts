import type { AlphaMonitoredMetric } from '../taxonomy.ts';
import type { DetectorAlarm } from '../types.ts';

export type EwmaDetectorConfig = {
  readonly alphaMilli: number;
  readonly alarmZScoreMilli: number;
};

export const DEFAULT_EWMA_CONFIG: EwmaDetectorConfig = Object.freeze({
  alphaMilli: 200,
  alarmZScoreMilli: 2_500,
});

function stdDev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * EWMA control chart — transparent baseline; flags sustained deviation from in-sample mean.
 */
export function runEwmaDetector(input: {
  readonly metric: AlphaMonitoredMetric;
  readonly series: readonly number[];
  readonly config?: EwmaDetectorConfig;
}): DetectorAlarm {
  const config = input.config ?? DEFAULT_EWMA_CONFIG;
  const alpha = config.alphaMilli / 1000;
  if (input.series.length < 3) {
    return Object.freeze({
      detector: 'EWMA',
      metric: input.metric,
      alarmed: false,
      score: 0,
      threshold: config.alarmZScoreMilli,
      observationsUsed: input.series.length,
    });
  }
  const mu = input.series.reduce((a, b) => a + b, 0) / input.series.length;
  const sigma = stdDev(input.series) || 1;
  let ewma = input.series[0] ?? mu;
  for (const x of input.series) {
    ewma = alpha * x + (1 - alpha) * ewma;
  }
  const zMilli = Math.round(((ewma - mu) / sigma) * 1000);
  const score = Math.abs(zMilli);
  return Object.freeze({
    detector: 'EWMA',
    metric: input.metric,
    alarmed: score >= config.alarmZScoreMilli,
    score,
    threshold: config.alarmZScoreMilli,
    observationsUsed: input.series.length,
  });
}
