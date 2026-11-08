import type { AlphaMonitoredMetric } from './taxonomy.ts';
import type { AlphaMetricBaseline, AlphaMetricObservation, PerformanceDrift } from './types.ts';

const HIGHER_IS_WORSE: ReadonlySet<AlphaMonitoredMetric> = new Set([
  'DRAWDOWN_BPS',
  'EXECUTION_COST_BPS',
  'SLIPPAGE_BPS',
  'FEATURE_DISTRIBUTION_SHIFT',
  'REGIME_MIX_SHIFT',
]);

const LOWER_IS_WORSE: ReadonlySet<AlphaMonitoredMetric> = new Set([
  'ACTIVE_RETURN_BPS',
  'HIT_RATE_BPS',
  'SIGNAL_FREQUENCY',
  'FORECAST_CALIBRATION_BPS',
]);

function recentMean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const tail = values.slice(-Math.min(5, values.length));
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

export function metricWorseIsLower(metric: AlphaMonitoredMetric): boolean {
  return LOWER_IS_WORSE.has(metric);
}

export function buildPerformanceDrift(input: {
  readonly metric: AlphaMonitoredMetric;
  readonly baseline: AlphaMetricBaseline | undefined;
  readonly series: readonly number[];
  readonly materialZScoreMilli?: number;
}): PerformanceDrift | null {
  if (!input.baseline || input.series.length === 0) {
    return null;
  }
  const recent = recentMean(input.series);
  const driftBps = Math.round(recent - input.baseline.mean);
  const sigma = input.baseline.stdDev || 1;
  const zScoreMilli = Math.round(((recent - input.baseline.mean) / sigma) * 1000);
  const threshold = input.materialZScoreMilli ?? 1_500;
  let materiallyWorse = false;
  if (HIGHER_IS_WORSE.has(input.metric)) {
    materiallyWorse = zScoreMilli >= threshold;
  } else if (LOWER_IS_WORSE.has(input.metric)) {
    materiallyWorse = zScoreMilli <= -threshold;
  }
  return Object.freeze({
    metric: input.metric,
    baseline: input.baseline,
    recentMean: recent,
    driftBps,
    zScoreMilli,
    materiallyWorse,
  });
}

export function groupObservationsByMetric(
  observations: readonly AlphaMetricObservation[],
): Map<AlphaMonitoredMetric, number[]> {
  const map = new Map<AlphaMonitoredMetric, number[]>();
  for (const obs of observations) {
    const list = map.get(obs.metric) ?? [];
    list.push(obs.value);
    map.set(obs.metric, list);
  }
  return map;
}

export function baselineMap(
  baselines: readonly AlphaMetricBaseline[],
): Map<AlphaMonitoredMetric, AlphaMetricBaseline> {
  return new Map(baselines.map((b) => [b.metric, b]));
}
