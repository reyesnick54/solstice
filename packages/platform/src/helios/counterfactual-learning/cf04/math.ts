import { CF04_QUANTILE_LEVELS } from './taxonomy.ts';
import type { Cf04QuantileLevel } from './taxonomy.ts';

/** Add intercept column. */
export function designMatrix(rows: readonly (readonly number[])[]): number[][] {
  return rows.map((r) => [1, ...r]);
}

export function transpose(m: readonly (readonly number[])[]): number[][] {
  if (m.length === 0) {
    return [];
  }
  const cols = m[0]!.length;
  const out: number[][] = [];
  for (let c = 0; c < cols; c += 1) {
    out.push(m.map((row) => row[c]!));
  }
  return out;
}

export function matMul(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < a.length; i += 1) {
    const row: number[] = [];
    for (let j = 0; j < b[0]!.length; j += 1) {
      let s = 0;
      for (let k = 0; k < b.length; k += 1) {
        s += a[i]![k]! * b[k]![j]!;
      }
      row.push(s);
    }
    out.push(row);
  }
  return out;
}

/** Gaussian elimination / LU-style solve for small systems. */
export function solveLinear(a: number[][], b: number[]): number[] {
  const n = a.length;
  const m = a[0]!.length;
  const aug: number[][] = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < m; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(aug[r]![col]!) > Math.abs(aug[pivot]![col]!)) {
        pivot = r;
      }
    }
    if (Math.abs(aug[pivot]![col]!) < 1e-12) {
      throw new Error('cf04: singular design matrix');
    }
    if (pivot !== col) {
      [aug[col], aug[pivot]] = [aug[pivot]!, aug[col]!];
    }
    const div = aug[col]![col]!;
    for (let c = col; c <= m; c += 1) {
      aug[col]![c]! /= div;
    }
    for (let r = 0; r < n; r += 1) {
      if (r === col) {
        continue;
      }
      const f = aug[r]![col]!;
      if (f === 0) {
        continue;
      }
      for (let c = col; c <= m; c += 1) {
        aug[r]![c]! -= f * aug[col]![c]!;
      }
    }
  }
  return aug.map((row) => row[m]!);
}

export function ridgeRegressionWeights(
  xWithIntercept: readonly (readonly number[])[],
  y: readonly number[],
  lambda: number,
): number[] {
  const xt = transpose(xWithIntercept);
  const xtx = matMul(xt, xWithIntercept);
  const d = xtx.length;
  for (let i = 0; i < d; i += 1) {
    const ridge = i === 0 ? 0 : lambda;
    xtx[i]![i]! += ridge;
  }
  const xtyCol = matMul(
    xt,
    y.map((v) => [v]),
  );
  const rhs = xtyCol.map((row) => row[0]!);
  return solveLinear(xtx, rhs);
}

export function predictLinear(w: readonly number[], xWithIntercept: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < w.length; i += 1) {
    s += w[i]! * xWithIntercept[i]!;
  }
  return s;
}

/** Tukey bisquare robust weights; 2 iterations. */
export function robustHuberWeights(residuals: readonly number[]): number[] {
  const mad =
    medianAbsoluteDeviation(residuals.length ? residuals : [0]) || 1e-9;
  const c = 1.345 * mad;
  return residuals.map((r) => {
    const a = Math.abs(r);
    if (a < 1e-15) {
      return 1;
    }
    return a <= c ? 1 : c / a;
  });
}

export function weightedRidge(
  xWithIntercept: readonly (readonly number[])[],
  y: readonly number[],
  weights: readonly number[],
  lambda: number,
): number[] {
  const wx = xWithIntercept.map((row, i) => row.map((v) => v * Math.sqrt(weights[i]!)));
  const wy = y.map((v, i) => v * Math.sqrt(weights[i]!));
  return ridgeRegressionWeights(wx, wy, lambda);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function medianAbsoluteDeviation(values: readonly number[]): number {
  const med = median(values);
  return median(values.map((v) => Math.abs(v - med)));
}

export function quantilesFromSample(
  sample: readonly number[],
  levels: readonly Cf04QuantileLevel[],
): Partial<Record<Cf04QuantileLevel, number>> {
  if (sample.length === 0) {
    return {};
  }
  const s = [...sample].sort((a, b) => a - b);
  const out: Partial<Record<Cf04QuantileLevel, number>> = {};
  for (const q of levels) {
    const idx = (s.length - 1) * q;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) {
      out[q] = s[lo]!;
    } else {
      const t = idx - lo;
      out[q] = s[lo]! * (1 - t) + s[hi]! * t;
    }
  }
  return out;
}

export function defaultQuantileLevels(): readonly Cf04QuantileLevel[] {
  return CF04_QUANTILE_LEVELS;
}

export function maeRmse(predicted: readonly number[], actual: readonly number[]): { mae: number; rmse: number } {
  let ae = 0;
  let se = 0;
  for (let i = 0; i < predicted.length; i += 1) {
    const d = predicted[i]! - actual[i]!;
    ae += Math.abs(d);
    se += d * d;
  }
  const n = predicted.length || 1;
  return { mae: ae / n, rmse: Math.sqrt(se / n) };
}

export function singleFeatureStump(
  x: readonly (readonly number[])[],
  y: readonly number[],
): { featureIndex: number; threshold: number; leftMean: number; rightMean: number } {
  const p = x[0]!.length;
  let best = { featureIndex: 0, threshold: 0, loss: Number.POSITIVE_INFINITY, leftMean: 0, rightMean: 0 };
  for (let j = 0; j < p; j += 1) {
    const pairs = x.map((row, i) => ({ v: row[j]!, y: y[i]! })).sort((a, b) => a.v - b.v);
    for (let k = 1; k < pairs.length; k += 1) {
      const thr = (pairs[k - 1]!.v + pairs[k]!.v) / 2;
      const left = pairs.slice(0, k).map((p0) => p0.y);
      const right = pairs.slice(k).map((p0) => p0.y);
      const mL = mean(left);
      const mR = mean(right);
      const loss =
        left.reduce((s, v) => s + (v - mL) ** 2, 0) + right.reduce((s, v) => s + (v - mR) ** 2, 0);
      if (loss < best.loss) {
        best = { featureIndex: j, threshold: thr, loss, leftMean: mL, rightMean: mR };
      }
    }
  }
  return {
    featureIndex: best.featureIndex,
    threshold: best.threshold,
    leftMean: best.leftMean,
    rightMean: best.rightMean,
  };
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stumpPredict(
  xRow: readonly number[],
  stump: { featureIndex: number; threshold: number; leftMean: number; rightMean: number },
): number {
  return xRow[stump.featureIndex]! <= stump.threshold ? stump.leftMean : stump.rightMean;
}

/** Linear quantile: fit ridge on y, then shift by residual quantile offset at level q. */
export function quantileLinearOffset(
  residuals: readonly number[],
  q: Cf04QuantileLevel,
): number {
  const qs = quantilesFromSample(residuals, [q]);
  return qs[q] ?? median(residuals);
}
