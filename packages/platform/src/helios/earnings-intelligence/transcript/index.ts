export {
  TRANSCRIPT_SEGMENT_KINDS,
  SPEAKER_ROLES,
  CONTRADICTION_CLASSIFICATIONS,
  LLM_LEAKAGE_MODES,
  CONSENSUS_ERROR_SIGN,
  EARN05_TOPIC_LEXICON,
} from './taxonomy.ts';
export type {
  TranscriptSegmentKind,
  SpeakerRole,
  ContradictionClassification,
  LlmLeakageMode,
  ConsensusErrorSign,
  TranscriptSegmentInput,
  ParsedTranscriptSegment,
  PointInTimeEarningsTranscript,
  ToneFeatureBundle,
  NoveltyComparisonCorpus,
  NoveltyFeatures,
  AnalystQuestionAnalysis,
  ManagementAnswerQuality,
  ExtractedNumericClaim,
  ExternalFactRecord,
  ContradictionAssessment,
  ConsensusErrorEstimate,
  LlmInferenceProvenance,
  TranscriptAnalysisMode,
  TranscriptSemanticAnalysis,
  TranscriptIntelligenceAnalyzeRequest,
} from './types.ts';
export { hashTranscriptEvidence, shortEvidenceId } from './evidence-hash.ts';
export {
  parseStructuredSegments,
  parseRawTranscriptText,
  parseEarningsTranscript,
} from './segmentation.ts';
export { inferSpeakerRole } from './speaker-roles.ts';
export { computeLexicalToneFeatures } from './lexical-baseline.ts';
export { computeNoveltyFeatures } from './novelty.ts';
export { analyzeQuestionAnswerBlock } from './qa-analysis.ts';
export { extractNumericClaims, assessContradictions } from './contradiction.ts';
export { estimateConsensusError } from './consensus-error.ts';
export {
  applyLeakageControls,
  buildLlmProvenance,
  assertChronologicalResearchPolicy,
  type RedactedTranscriptView,
} from './leakage-control.ts';
export {
  EarningsTranscriptIntelligenceService,
  analyzeEarningsTranscript,
} from './service.ts';
export {
  EARN05_FIXTURE_SEGMENTS,
  earn05FixtureTranscript,
  earn05PriorQuarterSegments,
  earn05ExternalFacts,
} from './fixtures.ts';
export {
  HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_QUALIFIED,
  HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_BLOCKED,
  runEarn05SelfChecks,
  evaluateEarn05Qualification,
  type Earn05QualificationChecks,
  type Earn05QualificationResult,
} from './qualification.ts';
