/** Pure bigint arithmetic for CF06 outcome summaries (integer minor units). */

export function sortedCopy(values: readonly bigint[]): bigint[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function parseMinor(s: string): bigint {
  const t = s.trim();
  if (!/^-?\d+$/.test(t)) {
    throw new Error(`CF06: outcome minor units must be integer string, got ${JSON.stringify(s)}`);
  }
  return BigInt(t);
}

export function minorToNumberSafe(minor: string): number {
  const b = parseMinor(minor);
  const n = Number(b);
  if (!Number.isSafeInteger(n)) {
    throw new Error('CF06: outcome magnitude too large for kernel bandwidth heuristic');
  }
  return n;
}

export function formatMinor(b: bigint): string {
  return b.toString();
}

export function meanBigint(values: readonly bigint[]): bigint {
  if (values.length === 0) {
    throw new Error('CF06: empty sample for mean');
  }
  let sum = 0n;
  for (const v of values) {
    sum += v;
  }
  const n = BigInt(values.length);
  const half = n / 2n;
  const sign = sum >= 0n ? 1n : -1n;
  return (sum * sign + half) / n * sign;
}

export function variancePopulationBigint(values: readonly bigint[], mean: bigint): bigint {
  if (values.length === 0) {
    throw new Error('CF06: empty sample for variance');
  }
  let acc = 0n;
  for (const v of values) {
    const d = v - mean;
    acc += d * d;
  }
  return acc / BigInt(values.length);
}

/** Integer square root for bigint (Newton). */
export function sqrtBigintFloor(n: bigint): bigint {
  if (n < 0n) {
    throw new Error('CF06: sqrt of negative');
  }
  if (n < 2n) {
    return n;
  }
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** Unweighted quantile in (0,1); uses linear interpolation between nearest ranks. */
export function quantileUnweightedSorted(sorted: readonly bigint[], q: number): bigint {
  if (sorted.length === 0) {
    throw new Error('CF06: quantile of empty');
  }
  if (!(q > 0 && q < 1)) {
    throw new Error('CF06: quantile q must be in (0,1)');
  }
  const n = sorted.length;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) {
    return sorted[lo]!;
  }
  const wHi = pos - lo;
  const wLo = 1 - wHi;
  const a = sorted[lo]!;
  const b = sorted[hi]!;
  const out = BigInt(Math.round(Number(a) * wLo + Number(b) * wHi));
  return out;
}

export function medianUnweightedSorted(sorted: readonly bigint[]): bigint {
  if (sorted.length === 0) {
    throw new Error('CF06: median of empty');
  }
  const n = sorted.length;
  if (n % 2 === 1) {
    return sorted[(n - 1) / 2]!;
  }
  const a = sorted[n / 2 - 1]!;
  const b = sorted[n / 2]!;
  return (a + b) / 2n;
}

/**
 * Weighted quantile (normalized weights sum to 1). Uses step-CDF inversion.
 */
export function quantileWeightedSorted(
  sortedValues: readonly bigint[],
  sortedWeights: readonly number[],
  q: number,
): bigint {
  if (sortedValues.length !== sortedWeights.length || sortedValues.length === 0) {
    throw new Error('CF06: weighted quantile requires aligned non-empty arrays');
  }
  if (!(q >= 0 && q <= 1)) {
    throw new Error('CF06: q must be in [0,1]');
  }
  let cum = 0;
  for (let i = 0; i < sortedValues.length; i += 1) {
    cum += sortedWeights[i]!;
    if (cum + 1e-15 >= q) {
      return sortedValues[i]!;
    }
  }
  return sortedValues[sortedValues.length - 1]!;
}

/** Erfc via Abramowitz-Stegun approximation (double precision). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * z);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
  const ans = poly * Math.exp(-z * z);
  return x >= 0 ? ans : 2 - ans;
}

/** Standard normal CDF Φ(x). */
function normalCdf(x: number): number {
  return 1 - 0.5 * erfc(x / Math.SQRT2);
}

/**
 * Smoothed CDF at y using Gaussian kernel with bandwidth `h` (same units as values).
 * F_hat(y) = sum_i w_i * Phi((y - y_i) / h) with weights summing to 1.
 */
export function smoothedCdf(
  y: number,
  valuesNum: readonly number[],
  weights: readonly number[],
  bandwidth: number,
): number {
  if (valuesNum.length !== weights.length || valuesNum.length === 0) {
    throw new Error('CF06: smoothed CDF requires aligned arrays');
  }
  if (!(bandwidth > 0)) {
    throw new Error('CF06: bandwidth must be positive');
  }
  let s = 0;
  for (let i = 0; i < valuesNum.length; i += 1) {
    const z = (y - valuesNum[i]!) / bandwidth;
    s += weights[i]! * normalCdf(z);
  }
  return s;
}

export function invertSmoothedCdf(
  target: number,
  valuesNum: readonly number[],
  weights: readonly number[],
  bandwidth: number,
  lo: number,
  hi: number,
): number {
  if (!(target > 0 && target < 1)) {
    throw new Error('CF06: invert CDF target must be in (0,1)');
  }
  let a = lo;
  let b = hi;
  for (let iter = 0; iter < 64; iter += 1) {
    const mid = (a + b) / 2;
    const f = smoothedCdf(mid, valuesNum, weights, bandwidth);
    if (f < target) {
      a = mid;
    } else {
      b = mid;
    }
  }
  return (a + b) / 2;
}
