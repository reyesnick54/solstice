/**
 * ALPHA07 — sequential forward-alpha evidence types.
 */

import type { UtcInstant } from '@solstice/domain';

import type {
  HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
  ReturnDependenceAssumption,
  SequentialEvidenceMethod,
} from './taxonomy.ts';

/** Pre-registered bounds for bounded confidence sequences (set before first observation). */
export type PredeclaredReturnBounds = {
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly registeredAt: UtcInstant;
};

export type ConfidenceSequenceState = {
  readonly schema: typeof HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA;
  readonly assumption: ReturnDependenceAssumption;
  readonly method: SequentialEvidenceMethod;
  readonly bounds: PredeclaredReturnBounds | null;
  readonly alpha: number;
  readonly observationCount: number;
  readonly effectiveSampleSize: number;
  readonly cumulativeMean: number;
  readonly lowerConfidenceBound: number | null;
  readonly upperConfidenceBound: number | null;
  readonly anytimeValid: boolean;
  readonly blockedReason: string | null;
};

export type EProcessState = {
  readonly schema: typeof HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA;
  readonly nullMean: number;
  readonly observationCount: number;
  readonly eValue: number;
  readonly evidenceStrength: number;
  readonly logEValue: number;
  readonly anytimeValid: boolean;
  readonly assumption: ReturnDependenceAssumption;
  readonly blockedReason: string | null;
};

export type SequentialTrackedMetrics = {
  readonly activeReturnMean: number | null;
  readonly lossDifferential: number | null;
  readonly hitRate: number | null;
  readonly forecastScoreDifference: number | null;
};

export type AnytimeValidComparison = {
  readonly schema: typeof HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA;
  readonly subjectId: string;
  readonly benchmarkId: string;
  readonly observationCount: number;
  readonly meanExcessVsBenchmark: number;
  readonly lowerConfidenceBound: number | null;
  readonly upperConfidenceBound: number | null;
  readonly eValue: number;
  readonly evidenceStrength: number;
  readonly subjectAheadOfBenchmark: boolean | null;
  readonly method: SequentialEvidenceMethod;
  readonly assumption: ReturnDependenceAssumption;
};

export type SequentialModelConfidenceSet = {
  readonly schema: typeof HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA;
  readonly modelId: string;
  readonly observationCount: number;
  readonly meanEstimate: number;
  readonly confidenceSequence: ConfidenceSequenceState;
  readonly eProcess: EProcessState;
  readonly metrics: SequentialTrackedMetrics;
};

export type OfflineAlphaDiagnostics = {
  readonly schema: typeof HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA;
  readonly observationCount: number;
  readonly sampleMean: number;
  readonly sampleVariance: number;
  readonly lag1Autocorrelation: number | null;
  readonly assumption: ReturnDependenceAssumption;
  readonly note: 'OFFLINE_POST_HOC_NOT_ANYTIME_VALID';
};

export type SequentialAlphaEvidence = {
  readonly schema: typeof HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA;
  readonly campaignId: string;
  readonly evaluatedAt: UtcInstant;
  readonly bounds: PredeclaredReturnBounds;
  readonly dependenceAssumption: ReturnDependenceAssumption;
  readonly method: SequentialEvidenceMethod;
  readonly observationCount: number;
  readonly lowerConfidenceBound: number | null;
  readonly upperConfidenceBound: number | null;
  readonly eValue: number;
  readonly evidenceStrength: number;
  readonly metrics: SequentialTrackedMetrics;
  readonly confidenceSequence: ConfidenceSequenceState;
  readonly eProcess: EProcessState;
  readonly offlineDiagnostics: OfflineAlphaDiagnostics;
  readonly comparison: AnytimeValidComparison | null;
  readonly confidenceSet: SequentialModelConfidenceSet;
  readonly sequentialInferenceActive: boolean;
};

export type SequentialObservation = {
  readonly at: UtcInstant;
  readonly activeReturn: number;
  readonly benchmarkReturn: number;
  readonly lossDifferential?: number;
  readonly hit?: boolean;
  readonly forecastScore?: number;
  readonly benchmarkForecastScore?: number;
};

export type SequentialEvidenceCampaignConfig = {
  readonly campaignId: string;
  readonly bounds: PredeclaredReturnBounds;
  readonly nullMean?: number;
  readonly benchmarkId?: string;
  readonly subjectId?: string;
  readonly confidenceAlpha?: number;
  readonly minObservationsForInference?: number;
  readonly blockSize?: number;
};
