export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function variance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sum = 0;
  for (const v of values) {
    const d = v - m;
    sum += d * d;
  }
  return sum / (values.length - 1);
}

export function stdDev(values: readonly number[]): number {
  return Math.sqrt(Math.max(0, variance(values)));
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

/** Average ranks for ties (Spearman). */
export function rank(values: readonly number[]): readonly number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = Array(values.length).fill(0);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1]!.v === indexed[i]!.v) j += 1;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) {
      ranks[indexed[k]!.i] = avgRank;
    }
    i = j + 1;
  }
  return Object.freeze(ranks);
}

export function pearson(x: readonly number[], y: readonly number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < x.length; i += 1) {
    const a = x[i]! - mx;
    const b = y[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den <= Number.EPSILON) return 0;
  return num / den;
}

export function spearmanRankCorrelation(x: readonly number[], y: readonly number[]): number {
  return pearson(rank(x), rank(y));
}

/**
 * Partial rank correlation of x vs y controlling for controls (when sample size permits).
 * Uses rank-residual correlation; returns null when underdetermined.
 */
export function partialRankCorrelation(
  x: readonly number[],
  y: readonly number[],
  controls: readonly (readonly number[])[],
): number | null {
  if (x.length !== y.length || x.length < controls.length + 4) return null;
  for (const c of controls) {
    if (c.length !== x.length) return null;
  }
  const rx = rank(x);
  const ry = rank(y);
  const rControls = controls.map((c) => rank(c));
  const yRes = residualize(ry, rControls);
  const xRes = residualize(rx, rControls);
  return pearson(xRes, yRes);
}

function residualize(target: readonly number[], predictors: readonly (readonly number[])[]): readonly number[] {
  if (predictors.length === 0) return target;
  const beta = fitLinear(target, predictors);
  const out: number[] = [];
  for (let i = 0; i < target.length; i += 1) {
    let fitted = beta[0]!;
    for (let j = 0; j < predictors.length; j += 1) {
      fitted += beta[j + 1]! * predictors[j]![i]!;
    }
    out.push(target[i]! - fitted);
  }
  return Object.freeze(out);
}

function fitLinear(y: readonly number[], xs: readonly (readonly number[])[]): readonly number[] {
  const k = xs.length;
  const n = y.length;
  const dim = k + 1;
  const xtx = Array.from({ length: dim }, () => Array(dim).fill(0));
  const xty = Array(dim).fill(0);
  for (let i = 0; i < n; i += 1) {
    const row = [1, ...xs.map((x) => x[i]!)];
    for (let a = 0; a < dim; a += 1) {
      xty[a] += row[a]! * y[i]!;
      for (let b = 0; b < dim; b += 1) {
        xtx[a]![b] += row[a]! * row[b]!;
      }
    }
  }
  return solveLinearSystem(xtx, xty) ?? Array(dim).fill(0);
}

function solveLinearSystem(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const a = matrix.map((row) => [...row]);
  const b = [...rhs];
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    }
    if (Math.abs(a[pivot]![col]!) <= 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    [b[col], b[pivot]] = [b[pivot]!, b[col]!];
    const div = a[col]![col]!;
    for (let j = col; j < n; j += 1) a[col]![j]! /= div;
    b[col]! /= div;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row]![col]!;
      for (let j = col; j < n; j += 1) {
        a[row]![j]! -= factor * a[col]![j]!;
      }
      b[row]! -= factor * b[col]!;
    }
  }
  return b;
}

export function coefficientOfVariation(values: readonly number[]): number {
  const m = mean(values);
  if (Math.abs(m) <= Number.EPSILON) return values.length > 1 ? 1 : 0;
  return stdDev(values) / Math.abs(m);
}
