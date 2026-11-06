import type {
  Cf04BaselineModelKind,
  Cf04LiquidityBucket,
  Cf04QuantileLevel,
  Cf04RegimeLabel,
} from './taxonomy.ts';
import type { CounterfactualTrainingRow } from './types.ts';
import {
  defaultQuantileLevels,
  maeRmse,
  predictLinear,
  quantileLinearOffset,
  ridgeRegressionWeights,
  robustHuberWeights,
  singleFeatureStump,
  stumpPredict,
  weightedRidge,
} from './math.ts';
import { OUTCOME_VECTOR_KEYS, outcomeVectorToArray } from './vector.ts';

export type FoldBoundary = {
  readonly trainIndices: readonly number[];
  readonly valIndices: readonly number[];
};

/** Chronological contiguous blocks: train is everything strictly before the validation window. */
export function buildChronologicalFolds(rows: readonly CounterfactualTrainingRow[], foldCount: number): FoldBoundary[] {
  const n = rows.length;
  if (foldCount < 2 || n < foldCount + 1) {
    throw new Error('cf04: insufficient rows or folds for chronological splitting');
  }
  const sortedIdx = rows
    .map((r, i) => ({ i, t: r.asOfUtcMs }))
    .sort((a, b) => a.t - b.t)
    .map((x) => x.i);
  const foldSize = Math.floor(n / foldCount);
  if (foldSize < 1) {
    throw new Error('cf04: fold size too small');
  }
  const folds: FoldBoundary[] = [];
  for (let f = 0; f < foldCount; f += 1) {
    const vStart = f * foldSize;
    const vEnd = f === foldCount - 1 ? n : Math.min(n, vStart + foldSize);
    const valIndices = sortedIdx.slice(vStart, vEnd);
    const trainIndices = sortedIdx.slice(0, vStart);
    folds.push({ trainIndices, valIndices });
  }
  return folds;
}

export function assertIssuerInstrumentLeakageGuard(
  train: readonly CounterfactualTrainingRow[],
  val: readonly CounterfactualTrainingRow[],
): void {
  const trainKey = new Set(train.map((r) => `${r.issuerId}::${r.instrumentId}`));
  for (const v of val) {
    const k = `${v.issuerId}::${v.instrumentId}`;
    if (trainKey.has(k)) {
      throw new Error(`cf04: issuer/instrument leakage blocked for ${k}`);
    }
  }
}

function featureRows(rows: readonly CounterfactualTrainingRow[]): number[][] {
  return rows.map((r) => [...r.features.values]);
}

export type QuantileOffsets = Partial<Record<Cf04QuantileLevel, number>>;

export type DimModelState =
  | { readonly kind: 'LINEAR_RIDGE'; readonly weights: readonly number[] }
  | { readonly kind: 'ROBUST_HUBER'; readonly weights: readonly number[] }
  | {
      readonly kind: 'TREE_ENSEMBLE_STUMP';
      readonly stump: {
        readonly featureIndex: number;
        readonly threshold: number;
        readonly leftMean: number;
        readonly rightMean: number;
      };
    }
  | {
      readonly kind: 'QUANTILE_LINEAR';
      readonly weights: readonly number[];
      readonly offsets: QuantileOffsets;
    };

export type FoldTrainedModels = {
  readonly baselineKind: Cf04BaselineModelKind;
  readonly dimStates: readonly DimModelState[];
};

export function trainFoldModels(
  trainRows: readonly CounterfactualTrainingRow[],
  baselineKind: Cf04BaselineModelKind,
  ridgeLambda: number,
): FoldTrainedModels {
  if (trainRows.length === 0) {
    throw new Error('cf04: empty training fold');
  }
  const xRaw = featureRows(trainRows);
  const p = xRaw[0]!.length;
  if (p === 0) {
    throw new Error('cf04: empty feature vector');
  }
  const yDims = trainRows.map((r) => outcomeVectorToArray(r.realized));
  const dimCount = yDims[0]!.length;

  const xDesign = xRaw.map((row) => [1, ...row]);
  const dimStates: DimModelState[] = [];

  for (let d = 0; d < dimCount; d += 1) {
    const y = yDims.map((row) => row[d]!);
    if (baselineKind === 'LINEAR_RIDGE') {
      dimStates.push({ kind: 'LINEAR_RIDGE', weights: ridgeRegressionWeights(xDesign, y, ridgeLambda) });
      continue;
    }
    if (baselineKind === 'ROBUST_HUBER') {
      let wts = y.map(() => 1);
      let weights = weightedRidge(xDesign, y, wts, ridgeLambda);
      for (let iter = 0; iter < 2; iter += 1) {
        const pred = xDesign.map((row) => predictLinear(weights, row));
        const residuals = y.map((v, i) => v - pred[i]!);
        wts = robustHuberWeights(residuals);
        weights = weightedRidge(xDesign, y, wts, ridgeLambda);
      }
      dimStates.push({ kind: 'ROBUST_HUBER', weights });
      continue;
    }
    if (baselineKind === 'TREE_ENSEMBLE_STUMP') {
      const stump = singleFeatureStump(xRaw, y);
      dimStates.push({ kind: 'TREE_ENSEMBLE_STUMP', stump });
      continue;
    }
    if (baselineKind === 'QUANTILE_LINEAR') {
      const weights = ridgeRegressionWeights(xDesign, y, ridgeLambda);
      const pred0 = xDesign.map((row) => predictLinear(weights, row));
      const residuals = y.map((v, i) => v - pred0[i]!);
      const offsets: QuantileOffsets = {};
      for (const q of defaultQuantileLevels()) {
        offsets[q] = quantileLinearOffset(residuals, q);
      }
      dimStates.push({ kind: 'QUANTILE_LINEAR', weights, offsets });
      continue;
    }
    const _exhaustive: never = baselineKind;
    throw new Error(`cf04: unknown baseline ${_exhaustive}`);
  }

  return { baselineKind, dimStates };
}

export function predictPointFromStates(
  xRaw: readonly number[],
  dimStates: readonly DimModelState[],
): number[] {
  const xd = [1, ...xRaw];
  const rowPred: number[] = [];
  for (let d = 0; d < dimStates.length; d += 1) {
    const m = dimStates[d]!;
    if (m.kind === 'LINEAR_RIDGE' || m.kind === 'ROBUST_HUBER') {
      rowPred.push(predictLinear(m.weights, xd));
    } else if (m.kind === 'TREE_ENSEMBLE_STUMP') {
      rowPred.push(stumpPredict(xRaw, m.stump));
    } else if (m.kind === 'QUANTILE_LINEAR') {
      rowPred.push(predictLinear(m.weights, xd));
    } else {
      const _e: never = m;
      throw new Error(`cf04: unknown model kind ${_e}`);
    }
  }
  return rowPred;
}

export function predictQuantileSurfacesFromStates(
  xRaw: readonly number[],
  dimStates: readonly DimModelState[],
): Array<Partial<Record<Cf04QuantileLevel, number>>> {
  const xd = [1, ...xRaw];
  return dimStates.map((m) => {
    if (m.kind === 'QUANTILE_LINEAR') {
      const pt = predictLinear(m.weights, xd);
      const q: Partial<Record<Cf04QuantileLevel, number>> = {};
      for (const [level, off] of Object.entries(m.offsets)) {
        if (off !== undefined) {
          q[level as Cf04QuantileLevel] = pt + off;
        }
      }
      return q;
    }
    let pt = 0;
    if (m.kind === 'LINEAR_RIDGE' || m.kind === 'ROBUST_HUBER') {
      pt = predictLinear(m.weights, xd);
    } else if (m.kind === 'TREE_ENSEMBLE_STUMP') {
      pt = stumpPredict(xRaw, m.stump);
    } else {
      const _e: never = m;
      throw new Error(`cf04: unknown model kind ${_e}`);
    }
    const single: Partial<Record<Cf04QuantileLevel, number>> = {};
    for (const qv of defaultQuantileLevels()) {
      single[qv] = pt;
    }
    return single;
  });
}

export function dimensionWiseMaeRmse(
  actual: readonly number[][],
  predicted: readonly number[][],
): { perDim: { mae: number; rmse: number }[]; pooled: { mae: number; rmse: number } } {
  if (actual.length === 0) {
    return { perDim: [], pooled: { mae: 0, rmse: 0 } };
  }
  const dimCount = actual[0]!.length;
  const perDim: { mae: number; rmse: number }[] = [];
  let ae = 0;
  let se = 0;
  let count = 0;
  for (let d = 0; d < dimCount; d += 1) {
    const a = actual.map((row) => row[d]!);
    const p = predicted.map((row) => row[d]!);
    perDim.push(maeRmse(p, a));
    for (let i = 0; i < a.length; i += 1) {
      ae += Math.abs(p[i]! - a[i]!);
      se += (p[i]! - a[i]!) ** 2;
      count += 1;
    }
  }
  return {
    perDim,
    pooled: { mae: count ? ae / count : 0, rmse: count ? Math.sqrt(se / count) : 0 },
  };
}

export function pooledQuantileCoverage(
  yByDim: readonly number[][],
  qPredByRowDim: readonly (readonly Partial<Record<Cf04QuantileLevel, number>>[])[],
): Partial<Record<Cf04QuantileLevel, number>> {
  const levels = defaultQuantileLevels();
  const out: Partial<Record<Cf04QuantileLevel, number>> = {};
  if (yByDim.length === 0) {
    for (const q of levels) {
      out[q] = 0;
    }
    return out;
  }
  const dimCount = yByDim[0]!.length;
  for (const q of levels) {
    let hits = 0;
    let total = 0;
    for (let i = 0; i < yByDim.length; i += 1) {
      for (let d = 0; d < dimCount; d += 1) {
        const thr = qPredByRowDim[i]![d]![q];
        if (thr === undefined) {
          continue;
        }
        total += 1;
        if (yByDim[i]![d]! <= thr) {
          hits += 1;
        }
      }
    }
    out[q] = total > 0 ? hits / total : 0;
  }
  return out;
}

export type RowCalibration = {
  readonly row: CounterfactualTrainingRow;
  readonly actual: readonly number[];
  readonly predictedPoint: readonly number[];
  readonly predictedQuantilesByDim: readonly Array<Partial<Record<Cf04QuantileLevel, number>>>;
};

export function buildRowCalibration(
  rows: readonly CounterfactualTrainingRow[],
  dimStates: readonly DimModelState[],
): RowCalibration[] {
  const xRaw = featureRows(rows);
  return rows.map((row, i) => {
    const xr = xRaw[i]!;
    return {
      row,
      actual: outcomeVectorToArray(row.realized),
      predictedPoint: predictPointFromStates(xr, dimStates),
      predictedQuantilesByDim: OUTCOME_VECTOR_KEYS.map((_, dimIdx) => {
        const m = dimStates[dimIdx]!;
        const qSurf = predictQuantileSurfacesFromStates(xr, [m]);
        return qSurf[0]!;
      }),
    };
  });
}

export function metricsAndCoverageForRows(rc: readonly RowCalibration[]): {
  readonly metrics: { mae: number; rmse: number };
  readonly quantileCoverage: Partial<Record<Cf04QuantileLevel, number>>;
} {
  const actual = rc.map((r) => [...r.actual]);
  const predicted = rc.map((r) => [...r.predictedPoint]);
  const { pooled } = dimensionWiseMaeRmse(actual, predicted);
  const yByDim = actual;
  const qPred = rc.map((r) => r.predictedQuantilesByDim);
  return { metrics: pooled, quantileCoverage: pooledQuantileCoverage(yByDim, qPred) };
}

export function sliceByRegime(
  rc: readonly RowCalibration[],
  regime: Cf04RegimeLabel,
): ReturnType<typeof metricsAndCoverageForRows> {
  return metricsAndCoverageForRows(rc.filter((r) => r.row.regime === regime));
}

export function sliceByAction(rc: readonly RowCalibration[], actionId: string): ReturnType<typeof metricsAndCoverageForRows> {
  return metricsAndCoverageForRows(rc.filter((r) => r.row.actionId === actionId));
}

export function sliceByLiquidity(
  rc: readonly RowCalibration[],
  bucket: Cf04LiquidityBucket,
): ReturnType<typeof metricsAndCoverageForRows> {
  return metricsAndCoverageForRows(rc.filter((r) => r.row.liquidityBucket === bucket));
}
