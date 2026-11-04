import {
  analyzeEarningsTranscript,
  earn05ExternalFacts,
  earn05FixtureTranscript,
  earn05PriorQuarterSegments,
  evaluateEarn05Qualification,
  runEarn05SelfChecks,
} from '../../../platform/src/helios/earnings-intelligence/transcript/index.ts';

import type {
  EarningsTranscriptIntelligencePort,
  EarningsTranscriptMeshAnalyzeInput,
  EarningsTranscriptMeshAnalyzeResult,
} from './types.ts';

/**
 * Simulation fixture port — binds mesh requests to canonical HELIOS EARN05 analysis.
 * Production callers must inject point-in-time transcript materialization behind this port.
 */
export function createFixtureEarningsTranscriptIntelligencePort(): EarningsTranscriptIntelligencePort {
  return Object.freeze({
    analyzeForMesh(input: EarningsTranscriptMeshAnalyzeInput): EarningsTranscriptMeshAnalyzeResult {
      if (input.evidenceRefs.length === 0) {
        return Object.freeze({ ok: false, message: 'At least one evidence reference is required.' });
      }
      const transcript = earn05FixtureTranscript();
      const analysis = analyzeEarningsTranscript({
        transcript: Object.freeze({
          ...transcript,
          transcriptId: input.transcriptId || transcript.transcriptId,
        }),
        comparables: Object.freeze({
          priorQuarterTranscript: earn05PriorQuarterSegments(),
          sameQuarterPriorYearTranscript: null,
          latestTenQOrTenKText: 'Revenue and margin trends from latest filing fixture.',
          latestGuidanceText: 'EPS guidance $1.45 to $1.55.',
          priorManagementLanguageText: 'We expect stable demand.',
        }),
        externalFacts: earn05ExternalFacts(),
        mode: Object.freeze({
          leakageMode: 'CHRONOLOGICALLY_SAFE_MODEL',
          allowLlmEnrichment: false,
          redactCompanyIdentifiers: false,
        }),
        analyzedAt: transcript.callInstant,
      });
      const qualification = evaluateEarn05Qualification(runEarn05SelfChecks());
      return Object.freeze({
        ok: true,
        specialistRole: 'EARNINGS_RESEARCH',
        baselineOnly: true,
        featureSummary: Object.freeze({
          managementTone: analysis.features.managementTone,
          uncertaintyScore: analysis.features.uncertaintyScore,
          forwardLookingScore: analysis.features.forwardLookingScore,
          semanticNovelty: analysis.novelty?.semanticNovelty ?? null,
          answeredQuestionRatio: analysis.answerQuality.answeredQuestionRatio,
          expectedSignOfConsensusError: analysis.consensusError.expectedSignOfConsensusError,
          consensusConfidence: analysis.consensusError.confidence,
          qualificationMarker: qualification.marker,
          analysisOutputHash: analysis.outputHash,
        }),
      });
    },
  });
}
