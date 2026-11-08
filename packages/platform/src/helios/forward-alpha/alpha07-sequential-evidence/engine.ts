/**
 * ALPHA07 — accumulate forward observations into anytime-valid sequential evidence.
 */

import type { UtcInstant } from '@solstice/domain';

import { assessReturnDependence } from './dependence.ts';
import { buildConfidenceSequenceState, selectSequentialMethod } from './confidence-sequence.ts';
import { eProcessMeanExcess } from './e-process.ts';
import { buildOfflineAlphaDiagnostics } from './offline-diagnostics.ts';
import { buildAnytimeValidComparison } from './comparison.ts';
import { HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA } from './taxonomy.ts';
import type {
  AnytimeValidComparison,
  PredeclaredReturnBounds,
  SequentialAlphaEvidence,
  SequentialEvidenceCampaignConfig,
  SequentialModelConfidenceSet,
  SequentialObservation,
  SequentialTrackedMetrics,
} from './types.ts';

function aggregateBlockMeans(series: readonly number[], blockSize: number): readonly number[] {
  if (blockSize <= 1) {
    return series;
  }
  const blocks: number[] = [];
  for (let i = 0; i + blockSize <= series.length; i += blockSize) {
    let sum = 0;
    for (let j = 0; j < blockSize; j += 1) {
      sum += series[i + j]!;
    }
    blocks.push(sum / blockSize);
  }
  return Object.freeze(blocks);
}

function computeTrackedMetrics(observations: readonly SequentialObservation[]): SequentialTrackedMetrics {
  const n = observations.length;
  if (n === 0) {
    return Object.freeze({
      activeReturnMean: null,
      lossDifferential: null,
      hitRate: null,
      forecastScoreDifference: null,
    });
  }
  const activeReturnMean = observations.reduce((a, o) => a + o.activeReturn, 0) / n;

  const lossRows = observations.filter((o) => o.lossDifferential !== undefined);
  const lossDifferential =
    lossRows.length === 0
      ? null
      : lossRows.reduce((a, o) => a + (o.lossDifferential ?? 0), 0) / lossRows.length;

  const hitRows = observations.filter((o) => o.hit !== undefined);
  const hitRate =
    hitRows.length === 0 ? null : hitRows.filter((o) => o.hit).length / hitRows.length;

  const forecastRows = observations.filter(
    (o) => o.forecastScore !== undefined && o.benchmarkForecastScore !== undefined,
  );
  const forecastScoreDifference =
    forecastRows.length === 0
      ? null
      : forecastRows.reduce(
          (a, o) => a + (o.forecastScore ?? 0) - (o.benchmarkForecastScore ?? 0),
          0,
        ) / forecastRows.length;

  return Object.freeze({
    activeReturnMean,
    lossDifferential,
    hitRate,
    forecastScoreDifference,
  });
}

export function validateObservationAgainstBounds(
  observation: SequentialObservation,
  bounds: PredeclaredReturnBounds,
): boolean {
  if (observation.activeReturn < bounds.lowerBound || observation.activeReturn > bounds.upperBound) {
    return false;
  }
  if (observation.benchmarkReturn < bounds.lowerBound || observation.benchmarkReturn > bounds.upperBound) {
    return false;
  }
  return true;
}

export function excessReturnBounds(bounds: PredeclaredReturnBounds): PredeclaredReturnBounds {
  return Object.freeze({
    lowerBound: bounds.lowerBound - bounds.upperBound,
    upperBound: bounds.upperBound - bounds.lowerBound,
    registeredAt: bounds.registeredAt,
  });
}

export function buildSequentialModelConfidenceSet(input: {
  readonly modelId: string;
  readonly observations: readonly SequentialObservation[];
  readonly bounds: PredeclaredReturnBounds;
  readonly alpha: number;
  readonly nullMean: number;
  readonly blockSize: number;
}): SequentialModelConfidenceSet {
  const returns = input.observations.map((o) => o.activeReturn);
  const assumption = assessReturnDependence({ returns, bounds: input.bounds });
  const method = selectSequentialMethod(assumption);

  let seqObs = returns;
  let effectiveN = returns.length;
  if (method === 'BLOCK_CONFIDENCE_SEQUENCE') {
    seqObs = [...aggregateBlockMeans(returns, input.blockSize)];
    effectiveN = seqObs.length;
  }

  const confidenceSequence = buildConfidenceSequenceState({
    assumption,
    bounds: input.bounds,
    alpha: input.alpha,
    observations: seqObs,
    effectiveSampleSize: Math.max(1, effectiveN),
  });

  const eProcess = eProcessMeanExcess({
    observations: returns,
    nullMean: input.nullMean,
    bounds: input.bounds,
    assumption,
  });

  return Object.freeze({
    schema: HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
    modelId: input.modelId,
    observationCount: returns.length,
    meanEstimate: confidenceSequence.cumulativeMean,
    confidenceSequence,
    eProcess,
    metrics: computeTrackedMetrics(input.observations),
  });
}

export function evaluateSequentialAlphaEvidence(input: {
  readonly config: SequentialEvidenceCampaignConfig;
  readonly observations: readonly SequentialObservation[];
  readonly evaluatedAt: UtcInstant;
}): SequentialAlphaEvidence {
  const alpha = input.config.confidenceAlpha ?? 0.05;
  const nullMean = input.config.nullMean ?? 0;
  const blockSize = input.config.blockSize ?? 5;
  const subjectId = input.config.subjectId ?? input.config.campaignId;
  const benchmarkId = input.config.benchmarkId ?? 'BENCHMARK';

  for (const row of input.observations) {
    if (!validateObservationAgainstBounds(row, input.config.bounds)) {
      const offline = buildOfflineAlphaDiagnostics({
        returns: input.observations.map((o) => o.activeReturn),
        bounds: input.config.bounds,
      });
      const blockedCs = buildConfidenceSequenceState({
        assumption: 'ASSUMPTIONS_FAILED',
        bounds: input.config.bounds,
        alpha,
        observations: [],
        effectiveSampleSize: 0,
      });
      const blockedE = eProcessMeanExcess({
        observations: [],
        nullMean,
        bounds: input.config.bounds,
        assumption: 'ASSUMPTIONS_FAILED',
      });
      const confidenceSet = Object.freeze({
        schema: HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
        modelId: subjectId,
        observationCount: input.observations.length,
        meanEstimate: 0,
        confidenceSequence: blockedCs,
        eProcess: blockedE,
        metrics: computeTrackedMetrics(input.observations),
      });
      return Object.freeze({
        schema: HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
        campaignId: input.config.campaignId,
        evaluatedAt: input.evaluatedAt,
        bounds: input.config.bounds,
        dependenceAssumption: 'ASSUMPTIONS_FAILED',
        method: 'NONE',
        observationCount: input.observations.length,
        lowerConfidenceBound: null,
        upperConfidenceBound: null,
        eValue: 1,
        evidenceStrength: 0,
        metrics: confidenceSet.metrics,
        confidenceSequence: blockedCs,
        eProcess: blockedE,
        offlineDiagnostics: offline,
        comparison: null,
        confidenceSet,
        sequentialInferenceActive: false,
      });
    }
  }

  const confidenceSet = buildSequentialModelConfidenceSet({
    modelId: subjectId,
    observations: input.observations,
    bounds: input.config.bounds,
    alpha,
    nullMean,
    blockSize,
  });

  const comparison: AnytimeValidComparison | null =
    input.observations.length > 0
      ? buildAnytimeValidComparison({
          subjectId,
          benchmarkId,
          observations: input.observations,
          bounds: input.config.bounds,
          alpha,
          blockSize,
        })
      : null;

  const offlineDiagnostics = buildOfflineAlphaDiagnostics({
    returns: input.observations.map((o) => o.activeReturn),
    bounds: input.config.bounds,
  });

  const minObs = input.config.minObservationsForInference ?? 1;
  const sequentialInferenceActive =
    confidenceSet.confidenceSequence.anytimeValid &&
    confidenceSet.eProcess.anytimeValid &&
    input.observations.length >= minObs;

  return Object.freeze({
    schema: HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
    campaignId: input.config.campaignId,
    evaluatedAt: input.evaluatedAt,
    bounds: input.config.bounds,
    dependenceAssumption: confidenceSet.confidenceSequence.assumption,
    method: confidenceSet.confidenceSequence.method,
    observationCount: input.observations.length,
    lowerConfidenceBound: confidenceSet.confidenceSequence.lowerConfidenceBound,
    upperConfidenceBound: confidenceSet.confidenceSequence.upperConfidenceBound,
    eValue: confidenceSet.eProcess.eValue,
    evidenceStrength: confidenceSet.eProcess.evidenceStrength,
    metrics: confidenceSet.metrics,
    confidenceSequence: confidenceSet.confidenceSequence,
    eProcess: confidenceSet.eProcess,
    offlineDiagnostics,
    comparison,
    confidenceSet,
    sequentialInferenceActive,
  });
}
