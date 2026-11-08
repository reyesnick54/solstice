/**
 * ALPHA07 — time-uniform confidence sequences for pre-bounded returns.
 */

import { HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA } from './taxonomy.ts';
import type { ReturnDependenceAssumption, SequentialEvidenceMethod } from './taxonomy.ts';
import type { ConfidenceSequenceState, PredeclaredReturnBounds } from './types.ts';

function rangeWidth(bounds: PredeclaredReturnBounds): number {
  return bounds.upperBound - bounds.lowerBound;
}

/**
 * Anytime-valid Hoeffding-style width for bounded IID means (time-uniform log factor).
 */
export function boundedConfidenceSequenceWidth(input: {
  readonly t: number;
  readonly alpha: number;
  readonly bounds: PredeclaredReturnBounds;
}): number {
  if (input.t < 1) {
    return rangeWidth(input.bounds) / 2;
  }
  const span = rangeWidth(input.bounds);
  const logFactor = Math.log((2 * Math.log(input.t + 1) + 1) / Math.max(input.alpha, 1e-12));
  return (span / 2) * Math.sqrt(logFactor / input.t);
}

export function selectSequentialMethod(
  assumption: ReturnDependenceAssumption,
): SequentialEvidenceMethod {
  switch (assumption) {
    case 'IID_APPROXIMATION_ACCEPTABLE':
      return 'BOUNDED_CONFIDENCE_SEQUENCE';
    case 'WEAK_DEPENDENCE_SUPPORTED':
      return 'BOUNDED_CONFIDENCE_SEQUENCE';
    case 'DEPENDENCE_REQUIRES_BLOCK_METHOD':
      return 'BLOCK_CONFIDENCE_SEQUENCE';
    default:
      return 'NONE';
  }
}

export function buildConfidenceSequenceState(input: {
  readonly assumption: ReturnDependenceAssumption;
  readonly bounds: PredeclaredReturnBounds | null;
  readonly alpha: number;
  readonly observations: readonly number[];
  readonly effectiveSampleSize: number;
}): ConfidenceSequenceState {
  const method = selectSequentialMethod(input.assumption);
  const n = input.observations.length;
  const mean = n === 0 ? 0 : input.observations.reduce((a, b) => a + b, 0) / n;

  if (method === 'NONE' || input.bounds === null) {
    return Object.freeze({
      schema: HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
      assumption: input.assumption,
      method,
      bounds: input.bounds,
      alpha: input.alpha,
      observationCount: n,
      effectiveSampleSize: input.effectiveSampleSize,
      cumulativeMean: mean,
      lowerConfidenceBound: null,
      upperConfidenceBound: null,
      anytimeValid: false,
      blockedReason:
        input.assumption === 'ASSUMPTIONS_FAILED'
          ? 'dependence_or_bounds_assumption_failed'
          : 'sequential_method_not_applicable',
    });
  }

  const inflator = input.assumption === 'WEAK_DEPENDENCE_SUPPORTED' ? Math.SQRT2 : 1;
  const tEff = Math.max(1, input.effectiveSampleSize);
  const halfWidth = boundedConfidenceSequenceWidth({ t: tEff, alpha: input.alpha, bounds: input.bounds }) * inflator;

  return Object.freeze({
    schema: HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
    assumption: input.assumption,
    method,
    bounds: input.bounds,
    alpha: input.alpha,
    observationCount: n,
    effectiveSampleSize: input.effectiveSampleSize,
    cumulativeMean: mean,
    lowerConfidenceBound: mean - halfWidth,
    upperConfidenceBound: mean + halfWidth,
    anytimeValid: true,
    blockedReason: null,
  });
}
