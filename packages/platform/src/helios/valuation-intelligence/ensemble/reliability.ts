import type { UtcInstant } from '@solstice/domain';

import {
  DEFAULT_RELIABILITY_SHRINKAGE,
  MIN_RELIABILITY_SAMPLE_FOR_FULL_WEIGHT,
  type IntrinsicEnsembleMethod,
  type MarketReferencedEnsembleMethod,
  type ValuationEnsembleLane,
} from './taxonomy.ts';
import type { ModelReliabilityMetrics, ModelReliabilityState } from './types.ts';

export type HistoricalModelResearchRecord = {
  readonly method: IntrinsicEnsembleMethod | MarketReferencedEnsembleMethod;
  readonly lane: ValuationEnsembleLane;
  readonly inputForecastAccuracy: number | null;
  readonly cashFlowForecastAccuracy: number | null;
  readonly marginForecastAccuracy: number | null;
  readonly modelStability: number | null;
  readonly terminalDependence: number | null;
  readonly dataQuality: number | null;
  readonly assumptionPlausibility: number | null;
  readonly sampleCount: number;
  readonly asOf: UtcInstant;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function averageDefined(values: readonly (number | null)[]): number | null {
  const defined = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (defined.length === 0) return null;
  return defined.reduce((a, b) => a + b, 0) / defined.length;
}

function terminalPenalty(terminalDependence: number | null): number {
  if (terminalDependence === null) return 0;
  return clamp01(terminalDependence) * 0.25;
}

export function compositeReliabilityFromMetrics(metrics: ModelReliabilityMetrics): number {
  const core = averageDefined([
    metrics.inputForecastAccuracy,
    metrics.cashFlowForecastAccuracy,
    metrics.marginForecastAccuracy,
    metrics.modelStability,
    metrics.dataQuality,
    metrics.assumptionPlausibility,
  ]);
  if (core === null) return 0.35;
  const sampleFactor =
    metrics.historicalSampleCount >= MIN_RELIABILITY_SAMPLE_FOR_FULL_WEIGHT
      ? 1
      : metrics.historicalSampleCount / MIN_RELIABILITY_SAMPLE_FOR_FULL_WEIGHT;
  const shrunk = core * sampleFactor - terminalPenalty(metrics.terminalDependence);
  return clamp01(shrunk);
}

export function applyReliabilityShrinkage(
  applicabilityPrior: number,
  reliability: number,
  shrinkage: number = DEFAULT_RELIABILITY_SHRINKAGE,
): number {
  const s = clamp01(shrinkage);
  return clamp01(applicabilityPrior * (1 - s) + reliability * s);
}

export function buildModelReliabilityState(
  record: HistoricalModelResearchRecord,
  applicabilityPrior: number,
): ModelReliabilityState {
  const metrics: ModelReliabilityMetrics = Object.freeze({
    inputForecastAccuracy: record.inputForecastAccuracy,
    cashFlowForecastAccuracy: record.cashFlowForecastAccuracy,
    marginForecastAccuracy: record.marginForecastAccuracy,
    modelStability: record.modelStability,
    terminalDependence: record.terminalDependence,
    dataQuality: record.dataQuality,
    assumptionPlausibility: record.assumptionPlausibility,
    historicalSampleCount: record.sampleCount,
    trainedOnFutureReturns: false,
  });

  const compositeReliability = compositeReliabilityFromMetrics(metrics);
  const shrinkageApplied = applyReliabilityShrinkage(applicabilityPrior, compositeReliability);

  return Object.freeze({
    method: record.method,
    lane: record.lane,
    metrics,
    compositeReliability,
    shrinkageApplied,
    evidenceAsOf: record.asOf,
  });
}
