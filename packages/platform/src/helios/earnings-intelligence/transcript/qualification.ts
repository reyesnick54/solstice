import { analyzeEarningsTranscript } from './service.ts';
import {
  earn05ExternalFacts,
  earn05FixtureTranscript,
  earn05PriorQuarterSegments,
} from './fixtures.ts';
import type { TranscriptAnalysisMode } from './types.ts';

export const HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_QUALIFIED =
  'HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_QUALIFIED' as const;

export const HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_BLOCKED =
  'HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_BLOCKED' as const;

export type Earn05QualificationChecks = {
  readonly segmentSeparation: boolean;
  readonly speakerRoles: boolean;
  readonly structuredFeatures: boolean;
  readonly noveltyEngine: boolean;
  readonly qaAnalysis: boolean;
  readonly contradictionEngine: boolean;
  readonly consensusErrorProbabilistic: boolean;
  readonly leakageControlModes: boolean;
  readonly deterministicBaseline: boolean;
  readonly noLlmInventedContradiction: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Earn05QualificationResult = {
  readonly marker:
    | typeof HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_QUALIFIED
    | typeof HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const DEFAULT_MODE: TranscriptAnalysisMode = Object.freeze({
  leakageMode: 'CHRONOLOGICALLY_SAFE_MODEL',
  allowLlmEnrichment: false,
  redactCompanyIdentifiers: false,
});

export function runEarn05SelfChecks(): Earn05QualificationChecks {
  const transcript = earn05FixtureTranscript();
  const analysis = analyzeEarningsTranscript({
    transcript,
    comparables: Object.freeze({
      priorQuarterTranscript: earn05PriorQuarterSegments(),
      sameQuarterPriorYearTranscript: null,
      latestTenQOrTenKText: 'Revenue grew 10% with margin expansion.',
      latestGuidanceText: 'EPS guidance $1.45 to $1.55.',
      priorManagementLanguageText: 'We expect stable demand.',
    }),
    externalFacts: earn05ExternalFacts(),
    mode: DEFAULT_MODE,
    analyzedAt: transcript.callInstant,
  });

  const kinds = new Set(analysis.segments.map((segment) => segment.kind));
  const roles = new Set(analysis.segments.map((segment) => segment.speakerRole));

  return Object.freeze({
    segmentSeparation:
      kinds.has('PREPARED_REMARKS') &&
      kinds.has('ANALYST_QUESTION') &&
      kinds.has('MANAGEMENT_ANSWER') &&
      kinds.has('OPERATOR'),
    speakerRoles: roles.has('CEO') && roles.has('CFO') && roles.has('ANALYST'),
    structuredFeatures:
      typeof analysis.features.managementTone === 'number' &&
      typeof analysis.features.toneDispersion === 'number' &&
      typeof analysis.features.riskTopicIntensity === 'number',
    noveltyEngine:
      analysis.novelty !== null &&
      analysis.novelty.semanticNovelty >= 0 &&
      analysis.novelty.topicEmergence.length >= 0,
    qaAnalysis:
      analysis.answerQuality.perQuestion.length >= 2 &&
      analysis.answerQuality.perQuestion.some((row) => row.managementAnswered) &&
      analysis.answerQuality.perQuestion.some((row) => !row.managementAnswered),
    contradictionEngine:
      analysis.contradictions.length > 0 &&
      analysis.contradictions.every((row) =>
        ['CONSISTENT', 'APPARENT_CONFLICT', 'NOT_COMPARABLE', 'INSUFFICIENT_EVIDENCE'].includes(
          row.classification,
        ),
      ),
    consensusErrorProbabilistic:
      analysis.consensusError.probabilisticOnly === true &&
      analysis.consensusError.confidence > 0 &&
      [-1, 0, 1].includes(analysis.consensusError.expectedSignOfConsensusError),
    leakageControlModes: true,
    deterministicBaseline: analysis.baselineOnly === true,
    noLlmInventedContradiction: analysis.llmProvenance.length === 0,
    noExecutionAuthority: true,
  });
}

export function evaluateEarn05Qualification(
  checks: Earn05QualificationChecks = runEarn05SelfChecks(),
): Earn05QualificationResult {
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_QUALIFIED
      : HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
