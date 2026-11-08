/**
 * ALPHA07 — standard offline statistical diagnostics (not anytime-valid).
 */

import { HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA } from './taxonomy.ts';
import { assessReturnDependence, lag1Autocorrelation } from './dependence.ts';
import type { OfflineAlphaDiagnostics, PredeclaredReturnBounds } from './types.ts';

export function buildOfflineAlphaDiagnostics(input: {
  readonly returns: readonly number[];
  readonly bounds: PredeclaredReturnBounds;
}): OfflineAlphaDiagnostics {
  const n = input.returns.length;
  const mean = n === 0 ? 0 : input.returns.reduce((a, b) => a + b, 0) / n;
  const variance =
    n < 2
      ? 0
      : input.returns.reduce((acc, r) => {
          const d = r - mean;
          return acc + d * d;
        }, 0) /
        (n - 1);

  return Object.freeze({
    schema: HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
    observationCount: n,
    sampleMean: mean,
    sampleVariance: variance,
    lag1Autocorrelation: lag1Autocorrelation(input.returns),
    assumption: assessReturnDependence({ returns: input.returns, bounds: input.bounds }),
    note: 'OFFLINE_POST_HOC_NOT_ANYTIME_VALID',
  });
}
