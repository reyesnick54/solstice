import type { UtcInstant } from '@solstice/domain';

import type {
  CONSENSUS_ERROR_SIGN,
  CONTRADICTION_CLASSIFICATIONS,
  LLM_LEAKAGE_MODES,
  SPEAKER_ROLES,
  TRANSCRIPT_SEGMENT_KINDS,
} from './taxonomy.ts';

export type TranscriptSegmentKind = (typeof TRANSCRIPT_SEGMENT_KINDS)[number];
export type SpeakerRole = (typeof SPEAKER_ROLES)[number];
export type ContradictionClassification = (typeof CONTRADICTION_CLASSIFICATIONS)[number];
export type LlmLeakageMode = (typeof LLM_LEAKAGE_MODES)[number];
export type ConsensusErrorSign = (typeof CONSENSUS_ERROR_SIGN)[number];

export type TranscriptSegmentInput = {
  readonly segmentId: string;
  readonly kind: TranscriptSegmentKind;
  readonly speakerLabel: string;
  readonly text: string;
  readonly sequence: number;
};

export type ParsedTranscriptSegment = {
  readonly segmentId: string;
  readonly kind: TranscriptSegmentKind;
  readonly speakerLabel: string;
  readonly speakerRole: SpeakerRole;
  readonly text: string;
  readonly sequence: number;
  readonly tokenCount: number;
};

export type PointInTimeEarningsTranscript = {
  readonly transcriptId: string;
  readonly companyTicker: string | null;
  readonly companyName: string | null;
  readonly fiscalPeriodLabel: string;
  readonly callInstant: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly segments: readonly TranscriptSegmentInput[];
  readonly provenanceRef: string;
};

export type ToneFeatureBundle = {
  readonly managementTone: number;
  readonly analystTone: number;
  readonly qaTone: number;
  readonly preparedTone: number;
  readonly toneDispersion: number;
  readonly managementAnalystToneGap: number;
  readonly uncertaintyScore: number;
  readonly hedgingScore: number;
  readonly specificityScore: number;
  readonly directnessScore: number;
  readonly answerEvasionScore: number;
  readonly forwardLookingScore: number;
  readonly backwardLookingScore: number;
  readonly futurePastBalance: number;
  readonly numericalSpecificityScore: number;
  readonly riskTopicIntensity: number;
  readonly capitalAllocationIntensity: number;
  readonly demandIntensity: number;
  readonly pricingIntensity: number;
  readonly marginLanguageIntensity: number;
  readonly hiringIntensity: number;
  readonly costControlIntensity: number;
};

export type NoveltyComparisonCorpus = {
  readonly priorQuarterTranscript: readonly ParsedTranscriptSegment[] | null;
  readonly sameQuarterPriorYearTranscript: readonly ParsedTranscriptSegment[] | null;
  readonly latestTenQOrTenKText: string | null;
  readonly latestGuidanceText: string | null;
  readonly priorManagementLanguageText: string | null;
};

export type NoveltyFeatures = {
  readonly semanticNovelty: number;
  readonly topicEmergence: readonly string[];
  readonly topicDisappearance: readonly string[];
  readonly languageShift: number;
  readonly guidanceLanguageShift: number;
};

export type AnalystQuestionAnalysis = {
  readonly questionSegmentId: string;
  readonly answerSegmentIds: readonly string[];
  readonly questionTopics: readonly string[];
  readonly requestedFacts: readonly string[];
  readonly answerSemanticRelevance: number;
  readonly answerSpecificity: number;
  readonly answerNumericContent: number;
  readonly managementAnswered: boolean;
  readonly evasionLexiconHits: number;
  readonly calibrationNote: string;
};

export type ManagementAnswerQuality = {
  readonly aggregateRelevance: number;
  readonly aggregateSpecificity: number;
  readonly aggregateNumericContent: number;
  readonly answeredQuestionRatio: number;
  readonly perQuestion: readonly AnalystQuestionAnalysis[];
};

export type ExtractedNumericClaim = {
  readonly claimId: string;
  readonly segmentId: string;
  readonly metricHint: string | null;
  readonly valueText: string;
  readonly normalizedValue: number | null;
  readonly unitHint: string | null;
};

export type ExternalFactRecord = {
  readonly recordId: string;
  readonly sourceKind: 'SEC_FILING' | 'EARNINGS_RELEASE' | 'PRIOR_GUIDANCE' | 'CURRENT_GUIDANCE';
  readonly metricHint: string | null;
  readonly valueText: string;
  readonly normalizedValue: number | null;
  readonly unitHint: string | null;
  readonly asOf: UtcInstant;
};

export type ContradictionAssessment = {
  readonly claimId: string;
  readonly externalRecordId: string;
  readonly classification: ContradictionClassification;
  readonly rationale: string;
  readonly evidenceRefs: readonly string[];
};

export type ConsensusErrorEstimate = {
  readonly expectedSignOfConsensusError: ConsensusErrorSign;
  readonly confidence: number;
  readonly supportingTranscriptFeatures: readonly string[];
  readonly probabilisticOnly: true;
};

export type LlmInferenceProvenance = {
  readonly modelName: string;
  readonly modelVersion: string;
  readonly trainingCutoff: string | null;
  readonly promptVersion: string;
  readonly inputEvidenceHash: string;
  readonly outputHash: string;
  readonly leakageMode: LlmLeakageMode;
  readonly webToolsDisabled: boolean;
};

export type TranscriptAnalysisMode = {
  readonly leakageMode: LlmLeakageMode;
  readonly allowLlmEnrichment: boolean;
  readonly redactCompanyIdentifiers: boolean;
};

export type TranscriptSemanticAnalysis = {
  readonly analysisId: string;
  readonly transcriptId: string;
  readonly analyzedAt: UtcInstant;
  readonly mode: TranscriptAnalysisMode;
  readonly segments: readonly ParsedTranscriptSegment[];
  readonly features: ToneFeatureBundle;
  readonly novelty: NoveltyFeatures | null;
  readonly answerQuality: ManagementAnswerQuality;
  readonly numericClaims: readonly ExtractedNumericClaim[];
  readonly contradictions: readonly ContradictionAssessment[];
  readonly consensusError: ConsensusErrorEstimate;
  readonly baselineOnly: boolean;
  readonly llmProvenance: readonly LlmInferenceProvenance[];
  readonly inputEvidenceHash: string;
  readonly outputHash: string;
};

export type TranscriptIntelligenceAnalyzeRequest = {
  readonly transcript: PointInTimeEarningsTranscript;
  readonly comparables: NoveltyComparisonCorpus | null;
  readonly externalFacts: readonly ExternalFactRecord[];
  readonly mode: TranscriptAnalysisMode;
  readonly analyzedAt: UtcInstant;
};
