import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import type { AlphaMonitoredMetric } from '../packages/platform/src/helios/forward-alpha/alpha11/taxonomy.ts';
import type { AlphaMetricBaseline, AlphaMetricObservation } from '../packages/platform/src/helios/forward-alpha/alpha11/types.ts';
import {
  ALPHA_MONITORED_METRICS,
  AlphaDecayMonitor,
  HELIOS_ALPHA11_ALPHA_DECAY_BLOCKED,
  HELIOS_ALPHA11_ALPHA_DECAY_QUALIFIED,
  alpha11AutomaticDegradationEligible,
  evaluateAlpha11Qualification,
  runBayesianOnlineChangeDetector,
  runCusumDetector,
  runEwmaDetector,
  runPageHinkleyDetector,
} from '../packages/platform/src/helios/forward-alpha/alpha11/index.ts';

const EVAL = asUtcInstant('2026-06-15T12:00:00.000Z');
const T0 = asUtcInstant('2026-06-01T12:00:00.000Z');

function stepInstant(base: UtcInstant, hours: number): UtcInstant {
  const ms = Date.parse(base) + hours * 3_600_000;
  return asUtcInstant(new Date(ms).toISOString());
}

function seriesObservations(
  metric: AlphaMonitoredMetric,
  values: readonly number[],
  start: UtcInstant = T0,
): AlphaMetricObservation[] {
  return values.map((value, index) =>
    Object.freeze({
      observedAt: stepInstant(start, index),
      metric,
      value,
    }),
  );
}

function defaultAlphaBaselines(): AlphaMetricBaseline[] {
  return [
    Object.freeze({ metric: 'ACTIVE_RETURN_BPS', mean: 110, stdDev: 12, sampleCount: 200 }),
    Object.freeze({ metric: 'HIT_RATE_BPS', mean: 5_200, stdDev: 150, sampleCount: 200 }),
    Object.freeze({ metric: 'DRAWDOWN_BPS', mean: 800, stdDev: 100, sampleCount: 200 }),
    Object.freeze({ metric: 'EXECUTION_COST_BPS', mean: 25, stdDev: 5, sampleCount: 200 }),
    Object.freeze({ metric: 'SLIPPAGE_BPS', mean: 15, stdDev: 4, sampleCount: 200 }),
    Object.freeze({ metric: 'SIGNAL_FREQUENCY', mean: 12, stdDev: 2, sampleCount: 200 }),
    Object.freeze({ metric: 'FEATURE_DISTRIBUTION_SHIFT', mean: 100, stdDev: 10, sampleCount: 200 }),
    Object.freeze({ metric: 'REGIME_MIX_SHIFT', mean: 50, stdDev: 8, sampleCount: 200 }),
    Object.freeze({ metric: 'FORECAST_CALIBRATION_BPS', mean: 9_500, stdDev: 200, sampleCount: 200 }),
  ];
}

describe('HELIOS Forward Alpha ALPHA11 — decay, drift, break detection', () => {
  it('exports qualification marker HELIOS_ALPHA11_ALPHA_DECAY_QUALIFIED', () => {
    assert.equal(HELIOS_ALPHA11_ALPHA_DECAY_QUALIFIED, 'HELIOS_ALPHA11_ALPHA_DECAY_QUALIFIED');
    const q = evaluateAlpha11Qualification();
    assert.equal(q.marker, HELIOS_ALPHA11_ALPHA_DECAY_QUALIFIED);
    assert.equal(q.grantsFinancialAuthority, false);
    assert.equal(q.permitsRiskIncrease, false);
    assert.notEqual(q.marker, HELIOS_ALPHA11_ALPHA_DECAY_BLOCKED);
  });

  it('monitors every required metric kind', () => {
    assert.equal(ALPHA_MONITORED_METRICS.length, 9);
  });

  it('uses EWMA, CUSUM, and Page–Hinkley without relying on a single detector', () => {
    const series = [100, 102, 101, 99, 98, 40, 38, 35, 33, 30];
    const metric = 'ACTIVE_RETURN_BPS' as const;
    const ewma = runEwmaDetector({ metric, series });
    const cusum = runCusumDetector({ metric, series });
    const ph = runPageHinkleyDetector({ metric, series, worseIsLower: true });
    const bayes = runBayesianOnlineChangeDetector({ metric, series });
    const alarmCount = [ewma, cusum, ph, bayes].filter((d) => d.alarmed).length;
    assert.ok(alarmCount >= 2, 'expected multi-detector consensus on break series');
  });

  it('reports HEALTHY for stable forward-alpha metrics', () => {
    const monitor = new AlphaDecayMonitor();
    const observations = [
      ...seriesObservations('ACTIVE_RETURN_BPS', [108, 112, 109, 111, 110, 113, 107, 110]),
      ...seriesObservations('HIT_RATE_BPS', [5_150, 5_220, 5_180, 5_210, 5_190, 5_230, 5_200, 5_210]),
    ];
    const state = monitor.evaluate({
      strategyId: 's_alpha11_stable',
      evaluatedAt: EVAL,
      observations,
      baselines: defaultAlphaBaselines(),
      minimumObservationsPerMetric: 8,
    });
    assert.equal(state.health, 'HEALTHY');
    assert.equal(state.grantsFinancialAuthority, false);
    assert.equal(state.demotion.permitsRiskIncrease, false);
    assert.equal(state.demotion.action, 'NONE');
  });

  it('attributes signal decay separately from execution deterioration', () => {
    const monitor = new AlphaDecayMonitor();
    const signal = monitor.evaluate({
      strategyId: 's_signal_decay',
      evaluatedAt: EVAL,
      observations: [
        ...seriesObservations('ACTIVE_RETURN_BPS', [115, 118, 112, 116, 40, 35, 32, 30]),
        ...seriesObservations('HIT_RATE_BPS', [5_250, 5_230, 5_200, 5_180, 4_800, 4_700, 4_650, 4_600]),
        ...seriesObservations('SLIPPAGE_BPS', [14, 16, 15, 14, 15, 16, 14, 15]),
        ...seriesObservations('EXECUTION_COST_BPS', [24, 26, 25, 24, 25, 26, 25, 24]),
      ],
      baselines: defaultAlphaBaselines(),
      minimumObservationsPerMetric: 8,
    });
    assert.equal(signal.attribution, 'SIGNAL_DECAY');
    assert.notEqual(signal.attribution, 'EXECUTION_DETERIORATION');

    const execution = monitor.evaluate({
      strategyId: 's_execution_decay',
      evaluatedAt: EVAL,
      observations: [
        ...seriesObservations('ACTIVE_RETURN_BPS', [108, 110, 109, 111, 110, 109, 108, 107]),
        ...seriesObservations('HIT_RATE_BPS', [5_180, 5_200, 5_190, 5_210, 5_200, 5_190, 5_180, 5_170]),
        ...seriesObservations('SLIPPAGE_BPS', [12, 14, 13, 15, 40, 45, 48, 52]),
        ...seriesObservations('EXECUTION_COST_BPS', [20, 22, 21, 23, 55, 58, 60, 62]),
      ],
      baselines: defaultAlphaBaselines(),
      minimumObservationsPerMetric: 8,
    });
    assert.equal(execution.attribution, 'EXECUTION_DETERIORATION');
  });

  it('detects regime and data/provider degradation classes', () => {
    const monitor = new AlphaDecayMonitor();
    const regime = monitor.evaluate({
      strategyId: 's_regime',
      evaluatedAt: EVAL,
      observations: [
        ...seriesObservations('ACTIVE_RETURN_BPS', [108, 110, 109, 111, 110, 109, 108, 107]),
        ...seriesObservations('HIT_RATE_BPS', [5_180, 5_200, 5_190, 5_210, 5_200, 5_190, 5_180, 5_170]),
        ...seriesObservations('REGIME_MIX_SHIFT', [48, 50, 52, 51, 90, 95, 98, 100]),
      ],
      baselines: defaultAlphaBaselines(),
      minimumObservationsPerMetric: 8,
    });
    assert.equal(regime.attribution, 'MARKET_REGIME_SHIFT');

    const provider = monitor.evaluate({
      strategyId: 's_provider',
      evaluatedAt: EVAL,
      observations: [
        ...seriesObservations('ACTIVE_RETURN_BPS', [108, 110, 109, 111, 110, 109, 108, 107]),
        ...seriesObservations('HIT_RATE_BPS', [5_180, 5_200, 5_190, 5_210, 5_200, 5_190, 5_180, 5_170]),
        ...seriesObservations('FEATURE_DISTRIBUTION_SHIFT', [95, 98, 100, 102, 180, 190, 200, 210]),
      ],
      baselines: defaultAlphaBaselines(),
      minimumObservationsPerMetric: 8,
    });
    assert.equal(provider.attribution, 'DATA_PROVIDER_DEGRADATION');
  });

  it('recommends demotion/pause/shadow without permitting risk increase', () => {
    const monitor = new AlphaDecayMonitor();
    const broken = monitor.evaluate({
      strategyId: 's_broken',
      evaluatedAt: EVAL,
      observations: [
        ...seriesObservations('ACTIVE_RETURN_BPS', [115, 114, 113, 30, 28, 25, 22, 20]),
        ...seriesObservations('HIT_RATE_BPS', [5_200, 5_180, 5_150, 4_700, 4_600, 4_500, 4_400, 4_300]),
        ...seriesObservations('DRAWDOWN_BPS', [800, 820, 850, 1_800, 2_000, 2_200, 2_400, 2_600]),
        ...seriesObservations('FORECAST_CALIBRATION_BPS', [9_500, 9_480, 9_450, 8_000, 7_800, 7_600, 7_400, 7_200]),
      ],
      baselines: defaultAlphaBaselines(),
      minimumObservationsPerMetric: 8,
    });
    assert.ok(broken.health === 'DEGRADED' || broken.health === 'BROKEN');
    assert.equal(broken.demotion.permitsRiskIncrease, false);
    assert.ok(
      broken.demotion.action === 'DEMOTE' ||
        broken.demotion.action === 'PAUSE' ||
        broken.demotion.action === 'RETURN_TO_SHADOW',
    );
    if (broken.demotion.demotionTriggerHint) {
      assert.ok(alpha11AutomaticDegradationEligible(broken) || broken.demotion.demotionTriggerHint === 'DATA_QUALITY_PROBLEM');
    }
  });

  it('returns INSUFFICIENT_DATA when key observations are below minimum', () => {
    const monitor = new AlphaDecayMonitor();
    const state = monitor.evaluate({
      strategyId: 's_sparse',
      evaluatedAt: EVAL,
      observations: seriesObservations('ACTIVE_RETURN_BPS', [100, 101, 102]),
      baselines: defaultAlphaBaselines(),
      minimumObservationsPerMetric: 8,
    });
    assert.equal(state.health, 'INSUFFICIENT_DATA');
  });
});
