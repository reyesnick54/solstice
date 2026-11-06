import {
  HELIOS_CF04_OUTCOME_MODEL_SCHEMA,
  CF04_LIQUIDITY_BUCKETS,
  REGIME_LABELS,
} from './taxonomy.ts';
import type { Cf04BaselineModelKind } from './taxonomy.ts';
import type {
  CounterfactualOutcomeModel,
  CrossFitOutcomeModelOptions,
  CounterfactualTrainingRow,
  OutcomeDistribution,
  OutcomeModelCalibration,
  OutcomePrediction,
  OutcomeQuantileSurface,
  QuantileCoverageReport,
} from './types.ts';
import type { OutcomeDimensionKey } from './taxonomy.ts';
import {
  assertIssuerInstrumentLeakageGuard,
  buildChronologicalFolds,
  buildRowCalibration,
  metricsAndCoverageForRows,
  predictPointFromStates,
  predictQuantileSurfacesFromStates,
  sliceByAction,
  sliceByLiquidity,
  sliceByRegime,
  trainFoldModels,
  type DimModelState,
  type RowCalibration,
} from './training.ts';

import { OUTCOME_VECTOR_KEYS, arrayToOutcomeVector } from './vector.ts';

export type CrossFitOutcomeModel = CounterfactualOutcomeModel & {
  readonly calibration: OutcomeModelCalibration;
  readonly oofRowCount: number;
  readonly foldCount: number;
};

function assertAafCertifiedRows(rows: readonly CounterfactualTrainingRow[]): void {
  for (const r of rows) {
    if (!r.features.certificationMarker?.trim()) {
      throw new Error('cf04: AAF-certified features required');
    }
  }
}

function buildCalibrationFromOof(oof: readonly RowCalibration[]): OutcomeModelCalibration {
  const global = metricsAndCoverageForRows(oof);
  const regimeSlices = REGIME_LABELS.map((regime) => {
    const slice = oof.filter((r) => r.row.regime === regime);
    if (slice.length === 0) {
      return {
        regime,
        metrics: { mae: 0, rmse: 0 },
        quantileCoverage: {} as QuantileCoverageReport,
      };
    }
    const s = sliceByRegime(oof, regime);
    return { regime, metrics: s.metrics, quantileCoverage: s.quantileCoverage };
  });
  const actions = new Set(oof.map((r) => r.row.actionId));
  const byAction = [...actions].map((actionId) => {
    const s = sliceByAction(oof, actionId);
    return { actionId, metrics: s.metrics, quantileCoverage: s.quantileCoverage };
  });
  const byLiquidity = CF04_LIQUIDITY_BUCKETS.map((liquidityBucket) => {
    const slice = oof.filter((r) => r.row.liquidityBucket === liquidityBucket);
    if (slice.length === 0) {
      return {
        liquidityBucket,
        metrics: { mae: 0, rmse: 0 },
        quantileCoverage: {} as QuantileCoverageReport,
      };
    }
    const s = sliceByLiquidity(oof, liquidityBucket);
    return { liquidityBucket, metrics: s.metrics, quantileCoverage: s.quantileCoverage };
  });
  return Object.freeze({
    global: Object.freeze({ ...global.metrics, quantileCoverage: global.quantileCoverage }),
    byRegime: Object.freeze(regimeSlices),
    byAction: Object.freeze(byAction),
    byLiquidityBucket: Object.freeze(byLiquidity),
    certifierRole: 'EXTERNAL_MODEL_VALIDATION' as const,
  });
}

function toOutcomeQuantileSurface(
  dimStates: readonly DimModelState[],
  xRaw: readonly number[],
): OutcomeQuantileSurface {
  const perDim = predictQuantileSurfacesFromStates(xRaw, dimStates);
  const surf: Partial<Record<OutcomeDimensionKey, (typeof perDim)[number]>> = {};
  for (let i = 0; i < OUTCOME_VECTOR_KEYS.length; i += 1) {
    const key = OUTCOME_VECTOR_KEYS[i]!;
    surf[key] = perDim[i]!;
  }
  return Object.freeze(surf as OutcomeQuantileSurface);
}

export function fitCrossFitOutcomeModel(
  rows: readonly CounterfactualTrainingRow[],
  options: CrossFitOutcomeModelOptions,
): CrossFitOutcomeModel {
  if (!options.constraints.requireChronologicalSplits) {
    throw new Error('cf04: chronological splits required');
  }
  if (!options.constraints.requireCrossFitting) {
    throw new Error('cf04: cross-fitting required');
  }
  if (!options.constraints.blockIssuerInstrumentLeakage) {
    throw new Error('cf04: issuer/instrument leakage protection required');
  }
  if (!options.constraints.requireAafCertifiedFeatures) {
    throw new Error('cf04: AAF-certified features required');
  }
  if (!options.constraints.requireRegimeAwareValidation) {
    throw new Error('cf04: regime-aware validation required');
  }
  assertAafCertifiedRows(rows);
  const ridgeLambda = options.ridgeLambda ?? 1e-2;
  const folds = buildChronologicalFolds(rows, options.constraints.splitPolicy.foldCount);
  const oofAccumulator: RowCalibration[] = [];
  for (const fold of folds) {
    const trainRows = fold.trainIndices.map((i) => rows[i]!);
    const valRows = fold.valIndices.map((i) => rows[i]!);
    if (trainRows.length < options.constraints.splitPolicy.minTrainRows) {
      continue;
    }
    assertIssuerInstrumentLeakageGuard(trainRows, valRows);
    const models = trainFoldModels(trainRows, options.baselineKind, ridgeLambda);
    oofAccumulator.push(...buildRowCalibration(valRows, models.dimStates));
  }
  if (oofAccumulator.length === 0) {
    throw new Error('cf04: cross-fit produced no out-of-fold rows (check fold policy vs data size)');
  }
  const finalStates = trainFoldModels(rows, options.baselineKind, ridgeLambda).dimStates;
  const calibration = buildCalibrationFromOof(oofAccumulator);

  const predict: CounterfactualOutcomeModel['predict'] = (input) => {
    const xRaw = [...input.features.values];
    const point = arrayToOutcomeVector(predictPointFromStates(xRaw, finalStates));
    const quantiles = toOutcomeQuantileSurface(finalStates, xRaw);
    const distribution: OutcomeDistribution = Object.freeze({
      kind: 'QUANTILES',
      quantiles,
    });
    const result: OutcomePrediction = Object.freeze({
      schema: HELIOS_CF04_OUTCOME_MODEL_SCHEMA,
      alternativeActionId: input.alternativeActionId,
      evaluationAsOfUtcMs: input.evaluationAsOfUtcMs,
      point,
      distribution,
      baselineModelKind: options.baselineKind,
      researchOnly: true,
      grantsExecutionAuthority: false,
    });
    return result;
  };

  const describe: CounterfactualOutcomeModel['describe'] = () =>
    Object.freeze({
      schema: HELIOS_CF04_OUTCOME_MODEL_SCHEMA,
      baselineKind: options.baselineKind,
      outcomeDimensions: OUTCOME_VECTOR_KEYS,
    });

  return Object.freeze({
    predict,
    describe,
    calibration,
    oofRowCount: oofAccumulator.length,
    foldCount: folds.length,
  });
}

/** Convenience: build a prediction without re-training when final states are supplied. */
export function createCounterfactualOutcomeModel(params: {
  readonly baselineKind: Cf04BaselineModelKind;
  readonly finalDimStates: readonly DimModelState[];
  readonly predictInput: Pick<
    Parameters<CounterfactualOutcomeModel['predict']>[0],
    'alternativeActionId' | 'evaluationAsOfUtcMs' | 'features' | 'regime' | 'liquidityBucket'
  >;
}): OutcomePrediction {
  const xRaw = [...params.predictInput.features.values];
  const point = arrayToOutcomeVector(predictPointFromStates(xRaw, params.finalDimStates));
  const quantiles = toOutcomeQuantileSurface(params.finalDimStates, xRaw);
  return Object.freeze({
    schema: HELIOS_CF04_OUTCOME_MODEL_SCHEMA,
    alternativeActionId: params.predictInput.alternativeActionId,
    evaluationAsOfUtcMs: params.predictInput.evaluationAsOfUtcMs,
    point,
    distribution: Object.freeze({ kind: 'QUANTILES', quantiles }),
    baselineModelKind: params.baselineKind,
    researchOnly: true,
    grantsExecutionAuthority: false,
  });
}
