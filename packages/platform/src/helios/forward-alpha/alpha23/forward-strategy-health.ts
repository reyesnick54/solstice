import type { ForwardDemotionPolicy, ForwardStrategyHealth, ForwardStrategyHealthInput, ForwardStrategyHealthSignal } from './types.ts';
import { type ForwardDemotionTrigger, type ForwardStrategyHealthBand } from './taxonomy.ts';

function signal(
  trigger: ForwardDemotionTrigger,
  observedBps: number,
  thresholdBps: number,
  worseWhenAbove: boolean,
  detail: string,
): ForwardStrategyHealthSignal {
  const fired = worseWhenAbove ? observedBps > thresholdBps : observedBps < thresholdBps;
  return Object.freeze({
    trigger,
    observedBps,
    thresholdBps,
    fired,
    detail,
  });
}

function bandFromTriggers(
  fired: readonly ForwardDemotionTrigger[],
  failSafeTriggers: ReadonlySet<ForwardDemotionTrigger>,
): ForwardStrategyHealthBand {
  if (fired.some((t) => failSafeTriggers.has(t))) {
    return 'FAIL_SAFE_REQUIRED';
  }
  if (fired.length > 0) {
    return 'DEMOTION_RECOMMENDED';
  }
  return 'HEALTHY';
}

const FAIL_SAFE_TRIGGERS: ReadonlySet<ForwardDemotionTrigger> = new Set([
  'OPERATIONAL_ANOMALY',
  'MARKET_DATA_DEGRADATION',
  'STATISTICAL_EVIDENCE_COLLAPSE',
]);

/**
 * Aggregates forward health from risk, shadow, paper, and ALPHA11 decay signals.
 */
export function computeForwardStrategyHealth(
  input: ForwardStrategyHealthInput,
  policy: ForwardDemotionPolicy,
): ForwardStrategyHealth {
  const signals: ForwardStrategyHealthSignal[] = [];

  if (input.drawdownBps != null) {
    signals.push(
      signal(
        'DRAWDOWN_LIMIT_BREACHED',
        input.drawdownBps,
        policy.maxDrawdownBps,
        true,
        'forward drawdown vs predeclared limit',
      ),
    );
  }

  if (input.alphaConfidenceBps != null) {
    signals.push(
      signal(
        'ALPHA_CONFIDENCE_DETERIORATION',
        input.alphaConfidenceBps,
        policy.minAlphaConfidenceBps,
        false,
        'alpha confidence vs minimum',
      ),
    );
  }

  if (input.benchmarkUnderperformanceBps != null) {
    signals.push(
      signal(
        'BENCHMARK_UNDERPERFORMANCE',
        input.benchmarkUnderperformanceBps,
        policy.maxBenchmarkUnderperformanceBps,
        true,
        'benchmark active return shortfall',
      ),
    );
  }

  if (input.executionCostBps != null) {
    signals.push(
      signal(
        'EXECUTION_COST_EXPLOSION',
        input.executionCostBps,
        policy.maxExecutionCostBps,
        true,
        'execution cost vs forward realism envelope',
      ),
    );
  }

  if (input.marketDataQualityBps != null) {
    signals.push(
      signal(
        'MARKET_DATA_DEGRADATION',
        10_000 - input.marketDataQualityBps,
        3_000,
        true,
        'market-data quality deterioration (inverted score)',
      ),
    );
  }

  if (input.featureHealthBps != null) {
    signals.push(
      signal(
        'STRATEGY_FEATURE_FAILURE',
        input.featureHealthBps,
        3_500,
        false,
        'strategy feature pipeline health',
      ),
    );
  }

  if (input.decisionRateChangeBps != null) {
    signals.push(
      signal(
        'DECISION_RATE_ANOMALY',
        Math.abs(input.decisionRateChangeBps),
        policy.maxDecisionRateChangeBps,
        true,
        'unexpected decision-rate change magnitude',
      ),
    );
  }

  if (input.regimeCompatibilityBps != null) {
    signals.push(
      signal(
        'REGIME_INCOMPATIBILITY',
        input.regimeCompatibilityBps,
        4_000,
        false,
        'regime compatibility score',
      ),
    );
  }

  if (input.capacityHeadroomBps != null) {
    signals.push(
      signal(
        'CAPACITY_DETERIORATION',
        input.capacityHeadroomBps,
        policy.minCapacityHeadroomBps,
        false,
        'capacity headroom vs minimum',
      ),
    );
  }

  if (input.sequentialEvidenceStrengthBps != null) {
    signals.push(
      signal(
        'STATISTICAL_EVIDENCE_COLLAPSE',
        input.sequentialEvidenceStrengthBps,
        policy.minSequentialEvidenceStrengthBps,
        false,
        'sequential / anytime-valid evidence strength',
      ),
    );
  }

  if (input.operationalAnomaly === true) {
    signals.push(
      Object.freeze({
        trigger: 'OPERATIONAL_ANOMALY' as const,
        observedBps: 10_000,
        thresholdBps: 1,
        fired: true,
        detail: 'operational anomaly detected on research runtime',
      }),
    );
  }

  const alpha11 = input.alpha11State ?? null;
  if (alpha11 && (alpha11.health === 'DEGRADED' || alpha11.health === 'BROKEN')) {
    signals.push(
      Object.freeze({
        trigger: 'ALPHA11_DECAY_SIGNAL' as const,
        observedBps: alpha11.health === 'BROKEN' ? 10_000 : 6_000,
        thresholdBps: 5_000,
        fired: true,
        detail: `ALPHA11 health=${alpha11.health} attribution=${alpha11.attribution}`,
      }),
    );
  } else if (alpha11?.health === 'WATCH') {
    signals.push(
      Object.freeze({
        trigger: 'ALPHA11_DECAY_SIGNAL' as const,
        observedBps: 4_000,
        thresholdBps: 5_000,
        fired: false,
        detail: 'ALPHA11 watch — monitor only',
      }),
    );
  }

  const firedTriggers = Object.freeze(
    signals.filter((row) => row.fired).map((row) => row.trigger),
  ) as readonly ForwardDemotionTrigger[];

  const band =
    firedTriggers.length === 0 && alpha11?.health === 'WATCH'
      ? ('WATCH' as const)
      : bandFromTriggers(firedTriggers, FAIL_SAFE_TRIGGERS);

  return Object.freeze({
    schema: policy.schema,
    strategyId: input.strategyId,
    evaluatedAt: input.evaluatedAt,
    posture: input.posture,
    band,
    signals: Object.freeze(signals),
    firedTriggers,
    alpha11Health: alpha11?.health ?? null,
    drawdownBps: input.drawdownBps ?? null,
    grantsFinancialAuthority: false,
    permitsRiskIncrease: false,
  });
}
