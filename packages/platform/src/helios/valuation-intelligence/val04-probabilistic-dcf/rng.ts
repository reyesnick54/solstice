/**
 * Deterministic seeded Gaussian draws with optional correlation (Cholesky).
 */

import { DCF_ASSUMPTION_KEYS, type DcfAssumptionKey } from './taxonomy.ts';

export type RngState = { state: number };

export function createRngState(seed: number): RngState {
  return { state: seed >>> 0 };
}

export function nextUniform(rng: RngState): number {
  rng.state = (Math.imul(rng.state, 1664525) + 1013904223) >>> 0;
  return rng.state / 0x1_0000_0000;
}

/** Box–Muller standard normal draw. */
export function nextStandardNormal(rng: RngState): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 <= Number.EPSILON) {
    u1 = nextUniform(rng);
    u2 = nextUniform(rng);
  }
  const mag = Math.sqrt(-2 * Math.log(u1));
  return mag * Math.cos(2 * Math.PI * u2);
}

export function choleskyLower(matrix: readonly (readonly number[])[]): number[][] | null {
  const n = matrix.length;
  if (n === 0) return null;
  const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    if ((matrix[i]?.length ?? 0) !== n) return null;
  }
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = matrix[i]![j]!;
      for (let k = 0; k < j; k += 1) {
        sum -= L[i]![k]! * L[j]![k]!;
      }
      if (i === j) {
        if (sum <= 0) return null;
        L[i]![j] = Math.sqrt(sum);
      } else {
        L[i]![j] = sum / L[j]![j]!;
      }
    }
  }
  return L;
}

export function drawCorrelatedNormals(input: {
  readonly rng: RngState;
  readonly correlationMatrix: readonly (readonly number[])[];
}): Record<DcfAssumptionKey, number> {
  const n = DCF_ASSUMPTION_KEYS.length;
  const L = choleskyLower(input.correlationMatrix);
  const independent: number[] = [];
  for (let i = 0; i < n; i += 1) {
    independent.push(nextStandardNormal(input.rng));
  }
  const correlated: number[] = Array(n).fill(0);
  if (L) {
    for (let i = 0; i < n; i += 1) {
      let sum = 0;
      for (let j = 0; j <= i; j += 1) {
        sum += L[i]![j]! * independent[j]!;
      }
      correlated[i] = sum;
    }
  } else {
    for (let i = 0; i < n; i += 1) {
      correlated[i] = independent[i]!;
    }
  }
  const draws = {} as Record<DcfAssumptionKey, number>;
  for (let i = 0; i < n; i += 1) {
    draws[DCF_ASSUMPTION_KEYS[i]!] = correlated[i]!;
  }
  return draws;
}

export function sampleTruncatedNormal(z: number, mean: number, stdDev: number, min?: number, max?: number): number {
  let v = mean + z * stdDev;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return v;
}
