import type { UtcInstant } from '../imports.ts';

export type EarningsTranscriptMeshEvidenceRef = {
  readonly evidenceId: string;
  readonly sourceRef: string;
  readonly observedAt: UtcInstant;
};

export type EarningsTranscriptMeshAnalyzeInput = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly transcriptId: string;
  readonly evidenceRefs: readonly EarningsTranscriptMeshEvidenceRef[];
};

export type EarningsTranscriptMeshFeatureSummary = {
  readonly managementTone: number;
  readonly uncertaintyScore: number;
  readonly forwardLookingScore: number;
  readonly semanticNovelty: number | null;
  readonly answeredQuestionRatio: number;
  readonly expectedSignOfConsensusError: -1 | 0 | 1;
  readonly consensusConfidence: number;
  readonly qualificationMarker: string;
  readonly analysisOutputHash: string;
};

export type EarningsTranscriptMeshAnalyzeResult =
  | {
      readonly ok: true;
      readonly featureSummary: EarningsTranscriptMeshFeatureSummary;
      readonly specialistRole: 'EARNINGS_RESEARCH';
      readonly baselineOnly: true;
    }
  | { readonly ok: false; readonly message: string };

export type EarningsTranscriptIntelligencePort = {
  readonly analyzeForMesh: (
    input: EarningsTranscriptMeshAnalyzeInput,
  ) => EarningsTranscriptMeshAnalyzeResult;
};
