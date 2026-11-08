import type { AlphaDecayAttributionClass, AlphaMonitoredMetric } from './taxonomy.ts';
import type { ChangePointEvidence, PerformanceDrift } from './types.ts';

const SIGNAL_METRICS: ReadonlySet<AlphaMonitoredMetric> = new Set([
  'ACTIVE_RETURN_BPS',
  'HIT_RATE_BPS',
  'SIGNAL_FREQUENCY',
  'FORECAST_CALIBRATION_BPS',
]);

const EXECUTION_METRICS: ReadonlySet<AlphaMonitoredMetric> = new Set([
  'EXECUTION_COST_BPS',
  'SLIPPAGE_BPS',
]);

const REGIME_METRICS: ReadonlySet<AlphaMonitoredMetric> = new Set(['REGIME_MIX_SHIFT']);

const DATA_METRICS: ReadonlySet<AlphaMonitoredMetric> = new Set([
  'FEATURE_DISTRIBUTION_SHIFT',
  'DRAWDOWN_BPS',
]);

function scoreBucket(metrics: ReadonlySet<AlphaMonitoredMetric>, drifts: readonly PerformanceDrift[], cps: readonly ChangePointEvidence[]): number {
  let score = 0;
  for (const d of drifts) {
    if (metrics.has(d.metric) && d.materiallyWorse) score += 2;
  }
  for (const c of cps) {
    if (metrics.has(c.metric) && c.changeDetected) score += 1;
  }
  return score;
}

/**
 * Separates signal decay from execution, regime, and data/provider failure modes.
 */
export function attributeAlphaDecay(input: {
  readonly drifts: readonly PerformanceDrift[];
  readonly changePoints: readonly ChangePointEvidence[];
}): AlphaDecayAttributionClass {
  const scores: Record<AlphaDecayAttributionClass, number> = {
    SIGNAL_DECAY: scoreBucket(SIGNAL_METRICS, input.drifts, input.changePoints),
    EXECUTION_DETERIORATION: scoreBucket(EXECUTION_METRICS, input.drifts, input.changePoints),
    MARKET_REGIME_SHIFT: scoreBucket(REGIME_METRICS, input.drifts, input.changePoints),
    DATA_PROVIDER_DEGRADATION: scoreBucket(DATA_METRICS, input.drifts, input.changePoints),
    MIXED_OR_UNRESOLVED: 0,
  };
  const ranked = (Object.entries(scores) as [AlphaDecayAttributionClass, number][])
    .filter(([k]) => k !== 'MIXED_OR_UNRESOLVED')
    .sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top[1] === 0) {
    return 'MIXED_OR_UNRESOLVED';
  }
  if (second && second[1] > 0 && top[1] === second[1]) {
    return 'MIXED_OR_UNRESOLVED';
  }
  return top[0];
}
