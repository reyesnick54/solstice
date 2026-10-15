/**
 * Deterministic coverage-bias statistics — no model inference.
 */

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum / values.length;
}

export function sampleVariance(values: readonly number[], valueMean: number): number | null {
  if (values.length < 2) {
    return null;
  }
  let sumSq = 0;
  for (const value of values) {
    const delta = value - valueMean;
    sumSq += delta * delta;
  }
  return sumSq / (values.length - 1);
}

export function pooledStandardDeviation(
  groupA: readonly number[],
  groupB: readonly number[],
): number | null {
  const meanA = mean(groupA);
  const meanB = mean(groupB);
  if (meanA === null || meanB === null) {
    return null;
  }
  const varA = sampleVariance(groupA, meanA);
  const varB = sampleVariance(groupB, meanB);
  if (varA === null || varB === null) {
    return null;
  }
  const nA = groupA.length;
  const nB = groupB.length;
  if (nA + nB < 3) {
    return null;
  }
  const pooled = ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2);
  if (pooled <= 0) {
    return null;
  }
  return Math.sqrt(pooled);
}

export function standardizedMeanDifference(
  fullValues: readonly number[],
  coveredValues: readonly number[],
): number | null {
  const meanFull = mean(fullValues);
  const meanCovered = mean(coveredValues);
  if (meanFull === null || meanCovered === null) {
    return null;
  }
  const pooledStd = pooledStandardDeviation(fullValues, coveredValues);
  if (pooledStd === null || pooledStd === 0) {
    return 0;
  }
  return (meanCovered - meanFull) / pooledStd;
}

export function categoricalDistribution(labels: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const total = labels.length;
  const distribution = new Map<string, number>();
  for (const [label, count] of counts) {
    distribution.set(label, count / total);
  }
  return distribution;
}

/** Total variation distance between two categorical distributions (0..1). */
export function totalVariationDistance(
  left: ReadonlyMap<string, number>,
  right: ReadonlyMap<string, number>,
): number {
  const keys = new Set<string>([...left.keys(), ...right.keys()]);
  let l1 = 0;
  for (const key of keys) {
    l1 += Math.abs((left.get(key) ?? 0) - (right.get(key) ?? 0));
  }
  return l1 / 2;
}

export function pointBiserialCorrelation(
  binaryMissing: readonly number[],
  numericCharacteristic: readonly number[],
): number | null {
  if (binaryMissing.length !== numericCharacteristic.length || binaryMissing.length < 3) {
    return null;
  }
  const n = binaryMissing.length;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += binaryMissing[i]!;
    sumY += numericCharacteristic[i]!;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = binaryMissing[i]! - meanX;
    const dy = numericCharacteristic[i]! - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (varX <= 0 || varY <= 0) {
    return null;
  }
  return cov / Math.sqrt(varX * varY);
}

export function quantileBucketLabel(value: number, tertileCutoffs: readonly [number, number]): string {
  if (value <= tertileCutoffs[0]) {
    return 'LOW';
  }
  if (value <= tertileCutoffs[1]) {
    return 'MID';
  }
  return 'HIGH';
}

export function numericTertileCutoffs(values: readonly number[]): [number, number] | null {
  if (values.length < 3) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const lowIndex = Math.floor((sorted.length - 1) / 3);
  const highIndex = Math.floor((2 * (sorted.length - 1)) / 3);
  return [sorted[lowIndex]!, sorted[highIndex]!];
}
