/**
 * ALPHA07 — return dependence assessment for sequential method gating.
 */

import { RETURN_DEPENDENCE_ASSUMPTIONS, type ReturnDependenceAssumption } from './taxonomy.ts';

const MIN_FOR_AUTOCORR = 4;
const IID_RHO_MAX = 0.1;
const WEAK_RHO_MAX = 0.35;

export function lag1Autocorrelation(series: readonly number[]): number | null {
  if (series.length < MIN_FOR_AUTOCORR) {
    return null;
  }
  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let var0 = 0;
  for (let i = 0; i < n; i += 1) {
    const d = series[i]! - mean;
    var0 += d * d;
    if (i < n - 1) {
      num += d * (series[i + 1]! - mean);
    }
  }
  if (var0 <= Number.EPSILON) {
    return 0;
  }
  return num / var0;
}

export function assessReturnDependence(input: {
  readonly returns: readonly number[];
  readonly bounds: { readonly lowerBound: number; readonly upperBound: number };
  readonly minObservations?: number;
}): ReturnDependenceAssumption {
  const minObs = input.minObservations ?? 2;
  if (input.returns.length < minObs) {
    return 'ASSUMPTIONS_FAILED';
  }
  for (const r of input.returns) {
    if (r < input.bounds.lowerBound - Number.EPSILON || r > input.bounds.upperBound + Number.EPSILON) {
      return 'ASSUMPTIONS_FAILED';
    }
  }
  const rho = lag1Autocorrelation(input.returns);
  if (rho === null) {
    return input.returns.length >= minObs ? 'WEAK_DEPENDENCE_SUPPORTED' : 'ASSUMPTIONS_FAILED';
  }
  const absRho = Math.abs(rho);
  if (absRho <= IID_RHO_MAX) {
    return 'IID_APPROXIMATION_ACCEPTABLE';
  }
  if (absRho <= WEAK_RHO_MAX) {
    return 'WEAK_DEPENDENCE_SUPPORTED';
  }
  return 'DEPENDENCE_REQUIRES_BLOCK_METHOD';
}

export function assertValidAssumption(value: string): value is ReturnDependenceAssumption {
  return (RETURN_DEPENDENCE_ASSUMPTIONS as readonly string[]).includes(value);
}
