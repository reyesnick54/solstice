/**
 * HELIOS ALT13 — rolling utility stability diagnostics.
 */

import { pearsonCorrelation } from './metrics.ts';
import type { Alt13EvaluationRow, SignalStabilityState } from './types.ts';

export function buildSignalStabilityState(input: {
  readonly featureId: string;
  readonly rows: readonly Alt13EvaluationRow[];
  readonly windowSize?: number;
}): SignalStabilityState {
  const window = input.windowSize ?? 12;
  const utilities: number[] = [];

  for (let start = 0; start + window <= input.rows.length; start += window) {
    const slice = input.rows.slice(start, start + window);
    const f = slice.map((r) => r.altFeatures[input.featureId] ?? 0);
    const y = slice.map((r) => r.targets.REVENUE_FORECAST ?? 0);
    const rho = pearsonCorrelation(f, y);
    utilities.push(rho ?? 0);
  }

  if (utilities.length === 0) {
    return Object.freeze({
      featureId: input.featureId,
      rollingUtilityStd: 0,
      signFlipRate: 0,
      stable: false,
      grantsExecutionAuthority: false,
    });
  }

  const mean = utilities.reduce((a, b) => a + b, 0) / utilities.length;
  const variance =
    utilities.reduce((acc, u) => acc + (u - mean) ** 2, 0) / Math.max(1, utilities.length - 1);
  const std = Math.sqrt(variance);

  let flips = 0;
  for (let i = 1; i < utilities.length; i += 1) {
    if (Math.sign(utilities[i]!) !== Math.sign(utilities[i - 1]!)) {
      flips += 1;
    }
  }
  const signFlipRate = utilities.length > 1 ? flips / (utilities.length - 1) : 0;

  return Object.freeze({
    featureId: input.featureId,
    rollingUtilityStd: std,
    signFlipRate,
    stable: std < 0.2 && signFlipRate < 0.5,
    grantsExecutionAuthority: false,
  });
}
