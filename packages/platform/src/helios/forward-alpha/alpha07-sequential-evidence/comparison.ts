/**
 * ALPHA07 — sequential benchmark comparison (excess returns).
 */

import { HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA } from './taxonomy.ts';
import { buildConfidenceSequenceState, selectSequentialMethod } from './confidence-sequence.ts';
import { assessReturnDependence } from './dependence.ts';
import { eProcessMeanExcess } from './e-process.ts';
import type { AnytimeValidComparison, PredeclaredReturnBounds, SequentialObservation } from './types.ts';

function excessReturnBounds(bounds: PredeclaredReturnBounds): PredeclaredReturnBounds {
  return Object.freeze({
    lowerBound: bounds.lowerBound - bounds.upperBound,
    upperBound: bounds.upperBound - bounds.lowerBound,
    registeredAt: bounds.registeredAt,
  });
}

export function buildAnytimeValidComparison(input: {
  readonly subjectId: string;
  readonly benchmarkId: string;
  readonly observations: readonly SequentialObservation[];
  readonly bounds: PredeclaredReturnBounds;
  readonly alpha: number;
  readonly blockSize: number;
}): AnytimeValidComparison {
  const excess = input.observations.map((row) => row.activeReturn - row.benchmarkReturn);
  const excessBounds = excessReturnBounds(input.bounds);
  const assumption = assessReturnDependence({ returns: excess, bounds: excessBounds });
  const method = selectSequentialMethod(assumption);

  let effectiveN = excess.length;
  if (method === 'BLOCK_CONFIDENCE_SEQUENCE' && input.blockSize > 1) {
    effectiveN = Math.floor(excess.length / input.blockSize);
  }

  const confidenceSequence = buildConfidenceSequenceState({
    assumption,
    bounds: excessBounds,
    alpha: input.alpha,
    observations: excess,
    effectiveSampleSize: Math.max(1, effectiveN),
  });

  const eProcess = eProcessMeanExcess({
    observations: excess,
    nullMean: 0,
    bounds: excessBounds,
    assumption,
  });

  const meanExcess =
    excess.length === 0 ? 0 : excess.reduce((a, b) => a + b, 0) / Math.max(1, excess.length);

  const subjectAhead =
    confidenceSequence.anytimeValid && confidenceSequence.lowerConfidenceBound !== null
      ? confidenceSequence.lowerConfidenceBound > 0
      : null;

  return Object.freeze({
    schema: HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
    subjectId: input.subjectId,
    benchmarkId: input.benchmarkId,
    observationCount: excess.length,
    meanExcessVsBenchmark: meanExcess,
    lowerConfidenceBound: confidenceSequence.lowerConfidenceBound,
    upperConfidenceBound: confidenceSequence.upperConfidenceBound,
    eValue: eProcess.eValue,
    evidenceStrength: eProcess.evidenceStrength,
    subjectAheadOfBenchmark: subjectAhead,
    method,
    assumption,
  });
}
