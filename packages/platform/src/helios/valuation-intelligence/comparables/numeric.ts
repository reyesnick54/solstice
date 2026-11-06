export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function mad(values: readonly number[], center?: number): number {
  if (values.length === 0) return 0;
  const med = center ?? median(values);
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations) * 1.4826;
}

export function robustZ(value: number, center: number, scale: number): number {
  if (scale <= 0) return 0;
  return (value - center) / scale;
}

export function winsorizeValue(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}

export function weightedMean(values: readonly number[], weights: readonly number[]): number {
  let sum = 0;
  let wSum = 0;
  for (let i = 0; i < values.length; i++) {
    const w = weights[i] ?? 0;
    sum += values[i]! * w;
    wSum += w;
  }
  return wSum > 0 ? sum / wSum : 0;
}

export function weightedStdDev(values: readonly number[], weights: readonly number[]): number {
  const mean = weightedMean(values, weights);
  let sum = 0;
  let wSum = 0;
  for (let i = 0; i < values.length; i++) {
    const w = weights[i] ?? 0;
    const d = values[i]! - mean;
    sum += w * d * d;
    wSum += w;
  }
  return wSum > 0 ? Math.sqrt(sum / wSum) : 0;
}

export function euclideanDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function invertDistanceToWeight(distance: number): number {
  return 1 / (1 + Math.max(0, distance));
}
