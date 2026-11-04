import { analyzeEarningsTranscript } from './service.ts';
import {
  earn05ExternalFacts,
  earn05FixtureTranscript,
  earn05PriorQuarterSegments,
} from './fixtures.ts';
import { evaluateEarn05Qualification, runEarn05SelfChecks } from './qualification.ts';

/**
 * Simulation fixture port for Agentic Capital Mesh EARN05 bridge tests.
 * Production callers inject point-in-time transcript materialization behind the mesh port.
 */
export function createEarn05TranscriptMeshFixturePort(): {
  readonly analyzeForMesh: (input: {
    readonly workOrderId: string;
    readonly subjectId: string;
    readonly transcriptId: string;
    readonly evidenceRefs: readonly {
      readonly evidenceId: string;
      readonly sourceRef: string;
      readonly observedAt: string;
    }[];
  }) =>
    | {
        readonly ok: true;
        readonly featureSummary: {
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
        readonly specialistRole: 'EARNINGS_RESEARCH';
        readonly baselineOnly: true;
      }
    | { readonly ok: false; readonly message: string };
} {
  return Object.freeze({
    analyzeForMesh(input) {
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
