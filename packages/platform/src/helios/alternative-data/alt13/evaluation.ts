/**
 * HELIOS ALT13 — incremental information evaluation across baselines.
 */

import type { UtcInstant } from '@solstice/domain';

import {
  approximateIncrementalPValue,
  computeBrier,
  computeLogLoss,
  computeMae,
  conditionalMutualInformationProxy,
} from './metrics.ts';
import {
  evaluateOrthogonalizedResidualPrediction,
  orthogonalPartialCorrelationForAltFeature,
} from './orthogonal.ts';
import type {
  AlternativeSignalHypothesis,
  AlternativeSignalHypothesisId,
  Alt13EvaluationRow,
  IncrementalInformationState,
  IncrementalMetricReading,
} from './types.ts';
import type { Alt13CoreBaseline, Alt13ForecastTarget, Alt13IncrementalMetric } from './taxonomy.ts';

function predictBaseline(row: Alt13EvaluationRow, baseline: Alt13CoreBaseline, altFeatureId: string): number {
  const pick = (rec: Readonly<Record<string, number>>, keys: string[]) => {
    const vals = keys.map((k) => rec[k]).filter((v) => v !== undefined);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b!, 0) / vals.length;
  };
  switch (baseline) {
    case 'MARKET_ONLY':
      return pick(row.marketFeatures, ['mkt_ret', 'mkt_vol']);
    case 'FUNDAMENTALS_ONLY':
      return pick(row.fundamentalsFeatures, ['fund_growth', 'fund_margin']);
    case 'EARNINGS_ONLY':
      return pick(row.earningsFeatures, ['earn_surprise', 'earn_revision']);
    case 'VALUATION_ONLY':
      return pick(row.valuationFeatures, ['val_multiple', 'val_spread']);
    case 'CORE_HELIOS':
      return (
        pick(row.marketFeatures, ['mkt_ret']) +
        pick(row.fundamentalsFeatures, ['fund_growth']) +
        pick(row.earningsFeatures, ['earn_surprise']) +
        pick(row.valuationFeatures, ['val_multiple'])
      ) / 4;
    case 'CORE_HELIOS_PLUS_ALT_SIGNAL':
      return (
        (pick(row.marketFeatures, ['mkt_ret']) +
          pick(row.fundamentalsFeatures, ['fund_growth']) +
          pick(row.earningsFeatures, ['earn_surprise']) +
          pick(row.valuationFeatures, ['val_multiple']) +
          (row.altFeatures[altFeatureId] ?? 0)) /
        5
      );
    default:
      return 0;
  }
}

function buildMetric(
  metric: Alt13IncrementalMetric,
  baseline: Alt13CoreBaseline,
  rows: readonly Alt13EvaluationRow[],
  target: Alt13ForecastTarget,
  altFeatureId: string,
): IncrementalMetricReading {
  const corePred: number[] = [];
  const augPred: number[] = [];
  const actual: number[] = [];
  const probsCore: number[] = [];
  const probsAug: number[] = [];
  const labels: boolean[] = [];

  for (const row of rows) {
    const y = row.targets[target];
    if (y === undefined) continue;
    actual.push(y);
    corePred.push(predictBaseline(row, baseline === 'CORE_HELIOS_PLUS_ALT_SIGNAL' ? 'CORE_HELIOS' : baseline, altFeatureId));
    augPred.push(predictBaseline(row, 'CORE_HELIOS_PLUS_ALT_SIGNAL', altFeatureId));
    const label = row.binaryTargets[target];
    if (label !== undefined) {
      labels.push(label);
      probsCore.push(1 / (1 + Math.exp(-corePred[corePred.length - 1]!)));
      probsAug.push(1 / (1 + Math.exp(-augPred[augPred.length - 1]!)));
    }
  }

  let delta = 0;
  if (metric === 'DELTA_MAE') {
    delta = computeMae(actual, corePred) - computeMae(actual, augPred);
  } else if (metric === 'DELTA_LOG_LOSS' && labels.length > 0) {
    delta = computeLogLoss(probsCore, labels) - computeLogLoss(probsAug, labels);
  } else if (metric === 'DELTA_BRIER' && labels.length > 0) {
    delta = computeBrier(probsCore, labels) - computeBrier(probsAug, labels);
  } else if (metric === 'CONDITIONAL_MUTUAL_INFORMATION') {
    const f = rows.map((r) => r.altFeatures[altFeatureId] ?? 0);
    delta = conditionalMutualInformationProxy(
      f,
      actual,
      rows.map((r) => [r.marketFeatures.mkt_ret ?? 0, r.fundamentalsFeatures.fund_growth ?? 0]),
    );
  } else if (metric === 'PARTIAL_CORRELATION') {
    const rho = orthogonalPartialCorrelationForAltFeature(rows, target, altFeatureId);
    delta = rho ?? 0;
  } else if (metric === 'ORTHOGONALIZED_RESIDUAL_PREDICTION') {
    delta = evaluateOrthogonalizedResidualPrediction({ rows, target, altFeatureId }).incrementalR2Proxy;
  }

  const rawPValue = approximateIncrementalPValue(delta, actual.length, metric);
  return Object.freeze({
    metric,
    baseline,
    augmentedBaseline: 'CORE_HELIOS_PLUS_ALT_SIGNAL',
    delta,
    rawPValue,
    fdrAdjustedPValue: null,
    incrementallyInformative: delta > 0,
  });
}

export function alternativeSignalHypothesisIdFrom(featureId: string, target: Alt13ForecastTarget): AlternativeSignalHypothesisId {
  return `alt13:hyp:${featureId}:${target}` as AlternativeSignalHypothesisId;
}

export function registerAlternativeSignalHypothesis(input: {
  readonly featureId: string;
  readonly providerIds: readonly string[];
  readonly target: Alt13ForecastTarget;
  readonly registeredAt: UtcInstant;
  readonly economicJustification: string;
}): AlternativeSignalHypothesis {
  return Object.freeze({
    hypothesisId: alternativeSignalHypothesisIdFrom(input.featureId, input.target),
    featureId: input.featureId,
    providerIds: Object.freeze([...input.providerIds]),
    target: input.target,
    coreBaseline: 'CORE_HELIOS',
    augmentedBaseline: 'CORE_HELIOS_PLUS_ALT_SIGNAL',
    registeredAt: input.registeredAt,
    economicJustification: input.economicJustification,
    grantsExecutionAuthority: false,
  });
}

export function evaluateIncrementalInformationState(input: {
  readonly hypothesis: AlternativeSignalHypothesis;
  readonly rows: readonly Alt13EvaluationRow[];
  readonly metrics?: readonly Alt13IncrementalMetric[];
}): IncrementalInformationState {
  const metricList = input.metrics ?? [
    'DELTA_MAE',
    'DELTA_LOG_LOSS',
    'DELTA_BRIER',
    'CONDITIONAL_MUTUAL_INFORMATION',
    'PARTIAL_CORRELATION',
    'ORTHOGONALIZED_RESIDUAL_PREDICTION',
  ];

  const readings = metricList.map((metric) =>
    buildMetric(metric, 'CORE_HELIOS', input.rows, input.hypothesis.target, input.hypothesis.featureId),
  );

  return Object.freeze({
    hypothesisId: input.hypothesis.hypothesisId,
    target: input.hypothesis.target,
    oosRowCount: input.rows.length,
    metrics: Object.freeze(readings),
    primaryTarget: input.hypothesis.target !== 'STOCK_RETURN_SECONDARY',
    stockReturnSecondaryOnly: input.hypothesis.target === 'STOCK_RETURN_SECONDARY',
    grantsExecutionAuthority: false,
  });
}
