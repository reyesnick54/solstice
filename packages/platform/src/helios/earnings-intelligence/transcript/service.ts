import { hashTranscriptEvidence, shortEvidenceId } from './evidence-hash.ts';
import { assessContradictions, extractNumericClaims } from './contradiction.ts';
import { estimateConsensusError } from './consensus-error.ts';
import { applyLeakageControls, assertChronologicalResearchPolicy } from './leakage-control.ts';
import { computeLexicalToneFeatures } from './lexical-baseline.ts';
import { computeNoveltyFeatures } from './novelty.ts';
import { analyzeQuestionAnswerBlock } from './qa-analysis.ts';
import { parseEarningsTranscript } from './segmentation.ts';
import type {
  TranscriptIntelligenceAnalyzeRequest,
  TranscriptSemanticAnalysis,
} from './types.ts';

export class EarningsTranscriptIntelligenceService {
  analyze(request: TranscriptIntelligenceAnalyzeRequest): TranscriptSemanticAnalysis {
    assertChronologicalResearchPolicy(request.mode);
    const redacted = applyLeakageControls(request.transcript, request.mode);
    const segments = parseEarningsTranscript(redacted.transcript);
    const features = computeLexicalToneFeatures(segments);
    const answerQuality = analyzeQuestionAnswerBlock(segments);
    const novelty = request.comparables
      ? computeNoveltyFeatures({
          currentSegments: segments,
          comparables: request.comparables,
        })
      : null;
    const numericClaims = extractNumericClaims(segments);
    const contradictions = assessContradictions({
      claims: numericClaims,
      externalFacts: request.externalFacts,
    });
    const consensusError = estimateConsensusError({
      features,
      answerQuality,
      novelty,
    });

    const inputEvidenceHash = hashTranscriptEvidence({
      transcript: redacted.transcript,
      comparables: request.comparables,
      externalFacts: request.externalFacts,
      mode: request.mode,
    });

    const analysisId = shortEvidenceId([
      request.transcript.transcriptId,
      request.analyzedAt,
      inputEvidenceHash,
    ]);

    const outputPayload = Object.freeze({
      analysisId,
      segments,
      features,
      novelty,
      answerQuality,
      numericClaims,
      contradictions,
      consensusError,
    });

    const outputHash = hashTranscriptEvidence(outputPayload);

    return Object.freeze({
      analysisId,
      transcriptId: request.transcript.transcriptId,
      analyzedAt: request.analyzedAt,
      mode: request.mode,
      segments,
      features,
      novelty,
      answerQuality,
      numericClaims,
      contradictions,
      consensusError,
      baselineOnly: !request.mode.allowLlmEnrichment,
      llmProvenance: Object.freeze([]),
      inputEvidenceHash,
      outputHash,
    });
  }
}

export function analyzeEarningsTranscript(
  request: TranscriptIntelligenceAnalyzeRequest,
): TranscriptSemanticAnalysis {
  return new EarningsTranscriptIntelligenceService().analyze(request);
}
