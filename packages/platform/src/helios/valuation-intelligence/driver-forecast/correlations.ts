/**
 * Correlated factor draws for business-driver Monte Carlo paths.
 */

import type { CorrelatedDriverFactor } from './taxonomy.ts';
import type { CorrelationSpec } from './types.ts';
import type { SeededRng } from './rng.ts';

function choleskyDecomposition(matrix: readonly (readonly number[])[]): number[][] {
  const n = matrix.length;
  const lower: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = 0;
      for (let k = 0; k < j; k += 1) {
        sum += (lower[i]![k] ?? 0) * (lower[j]![k] ?? 0);
      }
      if (i === j) {
        const diag = (matrix[i]![i] ?? 0) - sum;
        lower[i]![j] = diag <= 0 ? 0 : Math.sqrt(diag);
      } else {
        const denom = lower[j]![j] ?? 1;
        lower[i]![j] = denom === 0 ? 0 : ((matrix[i]![j] ?? 0) - sum) / denom;
      }
    }
  }
  return lower;
}

export type CorrelatedFactorDraw = Readonly<Record<CorrelatedDriverFactor, number>>;

export function drawCorrelatedFactors(
  spec: CorrelationSpec,
  rng: SeededRng,
  volatilities: Readonly<Partial<Record<CorrelatedDriverFactor, number>>>,
): CorrelatedFactorDraw {
  const n = spec.factors.length;
  const z = Array.from({ length: n }, () => rng.nextStandardNormal());
  const chol = choleskyDecomposition(spec.correlationMatrix);
  const correlated = z.map((_, i) => {
    let sum = 0;
    for (let j = 0; j <= i; j += 1) {
      sum += (chol[i]![j] ?? 0) * (z[j] ?? 0);
    }
    return sum;
  });
  const out: Partial<Record<CorrelatedDriverFactor, number>> = {};
  for (let i = 0; i < n; i += 1) {
    const factor = spec.factors[i]!;
    const vol = volatilities[factor] ?? 0.05;
    out[factor] = (correlated[i] ?? 0) * vol;
  }
  return Object.freeze(out as Record<CorrelatedDriverFactor, number>);
}

export const DEFAULT_VAL02_CORRELATION: CorrelationSpec = Object.freeze({
  factors: Object.freeze([
    'revenueGrowth',
    'grossMargin',
    'operatingMargin',
    'capexIntensity',
    'workingCapitalIntensity',
    'reinvestment',
  ]),
  correlationMatrix: Object.freeze([
    Object.freeze([1, -0.25, -0.2, 0.55, 0.45, 0.6]),
    Object.freeze([-0.25, 1, 0.85, -0.1, -0.05, -0.08]),
    Object.freeze([-0.2, 0.85, 1, -0.05, -0.04, -0.06]),
    Object.freeze([0.55, -0.1, -0.05, 1, 0.65, 0.9]),
    Object.freeze([0.45, -0.05, -0.04, 0.65, 1, 0.7]),
    Object.freeze([0.6, -0.08, -0.06, 0.9, 0.7, 1]),
  ]),
}) as CorrelationSpec;
