/**
 * HELIOS ALT13 — double-ML style nuisance residualization for incremental lift tests.
 */

import { partialCorrelation, pearsonCorrelation } from './metrics.ts';
import type { Alt13EvaluationRow, Alt13ForecastTarget } from './types.ts';
import type { Alt13CoreBaseline } from './taxonomy.ts';

function baselineFeatureKeys(baseline: Alt13CoreBaseline): readonly string[] {
  switch (baseline) {
    case 'MARKET_ONLY':
      return ['mkt_ret', 'mkt_vol'];
    case 'FUNDAMENTALS_ONLY':
      return ['fund_growth', 'fund_margin'];
    case 'EARNINGS_ONLY':
      return ['earn_surprise', 'earn_revision'];
    case 'VALUATION_ONLY':
      return ['val_multiple', 'val_spread'];
    case 'CORE_HELIOS':
    case 'CORE_HELIOS_PLUS_ALT_SIGNAL':
      return ['mkt_ret', 'fund_growth', 'earn_surprise', 'val_multiple'];
    default:
      return [];
  }
}

function featureValueForRow(row: Alt13EvaluationRow, key: string, altFeatureId?: string): number {
  if (row.marketFeatures[key] !== undefined) return row.marketFeatures[key]!;
  if (row.fundamentalsFeatures[key] !== undefined) return row.fundamentalsFeatures[key]!;
  if (row.earningsFeatures[key] !== undefined) return row.earningsFeatures[key]!;
  if (row.valuationFeatures[key] !== undefined) return row.valuationFeatures[key]!;
  if (altFeatureId && row.altFeatures[altFeatureId] !== undefined) return row.altFeatures[altFeatureId]!;
  return 0;
}

function predictFromBaseline(row: Alt13EvaluationRow, baseline: Alt13CoreBaseline, altFeatureId?: string): number {
  const keys = baselineFeatureKeys(baseline);
  const parts = keys.map((k) => featureValueForRow(row, k, altFeatureId));
  if (baseline === 'CORE_HELIOS_PLUS_ALT_SIGNAL' && altFeatureId) {
    parts.push(featureValueForRow(row, altFeatureId, altFeatureId));
  }
  return parts.reduce((a, b) => a + b, 0) / Math.max(1, parts.length);
}

export type OrthogonalResidualPrediction = {
  readonly baseline: Alt13CoreBaseline;
  readonly augmentedBaseline: 'CORE_HELIOS_PLUS_ALT_SIGNAL';
  readonly residualCorrelation: number | null;
  readonly incrementalR2Proxy: number;
  readonly grantsExecutionAuthority: false;
};

export function evaluateOrthogonalizedResidualPrediction(input: {
  readonly rows: readonly Alt13EvaluationRow[];
  readonly target: Alt13ForecastTarget;
  readonly altFeatureId: string;
}): OrthogonalResidualPrediction {
  const actual: number[] = [];
  const coreResidual: number[] = [];
  const augResidual: number[] = [];

  for (const row of input.rows) {
    const y = row.targets[input.target];
    if (y === undefined) continue;
    const corePred = predictFromBaseline(row, 'CORE_HELIOS');
    const augPred = predictFromBaseline(row, 'CORE_HELIOS_PLUS_ALT_SIGNAL', input.altFeatureId);
    actual.push(y);
    coreResidual.push(y - corePred);
    augResidual.push(y - augPred);
  }

  const residualCorrelation = pearsonCorrelation(coreResidual, augResidual);
  const incrementalR2Proxy =
    residualCorrelation === null ? 0 : Math.max(0, 1 - residualCorrelation * residualCorrelation);

  return Object.freeze({
    baseline: 'CORE_HELIOS',
    augmentedBaseline: 'CORE_HELIOS_PLUS_ALT_SIGNAL',
    residualCorrelation,
    incrementalR2Proxy,
    grantsExecutionAuthority: false,
  });
}

export function nuisanceControlsFromRow(row: Alt13EvaluationRow): readonly number[][] {
  const controls: number[][] = [
    [featureValueForRow(row, 'mkt_ret')],
    [featureValueForRow(row, 'fund_growth')],
    [featureValueForRow(row, 'earn_surprise')],
    [featureValueForRow(row, 'val_multiple')],
  ];
  return Object.freeze(controls.map((c) => Object.freeze(c)));
}

export function orthogonalPartialCorrelationForAltFeature(
  rows: readonly Alt13EvaluationRow[],
  target: Alt13ForecastTarget,
  altFeatureId: string,
): number | null {
  const featureSeries: number[] = [];
  const targetSeries: number[] = [];
  const controlMatrix: number[][] = [[], [], [], []];

  for (const row of rows) {
    const y = row.targets[target];
    if (y === undefined) continue;
    featureSeries.push(featureValueForRow(row, altFeatureId, altFeatureId));
    targetSeries.push(y);
    const controls = nuisanceControlsFromRow(row);
    for (let i = 0; i < controls.length; i += 1) {
      controlMatrix[i]!.push(controls[i]![0]!);
    }
  }

  return partialCorrelation(featureSeries, targetSeries, controlMatrix);
}
