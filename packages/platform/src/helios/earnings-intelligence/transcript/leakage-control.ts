import { hashTranscriptEvidence } from './evidence-hash.ts';
import type {
  LlmInferenceProvenance,
  LlmLeakageMode,
  PointInTimeEarningsTranscript,
  TranscriptAnalysisMode,
} from './types.ts';

export type RedactedTranscriptView = {
  readonly transcript: PointInTimeEarningsTranscript;
  readonly redacted: boolean;
  readonly leakageMode: LlmLeakageMode;
};

export function applyLeakageControls(
  transcript: PointInTimeEarningsTranscript,
  mode: TranscriptAnalysisMode,
): RedactedTranscriptView {
  if (!mode.redactCompanyIdentifiers && mode.leakageMode === 'CHRONOLOGICALLY_SAFE_MODEL') {
    return Object.freeze({
      transcript,
      redacted: false,
      leakageMode: mode.leakageMode,
    });
  }

  const redactedSegments = transcript.segments.map((segment) =>
    Object.freeze({
      ...segment,
      text: segment.text
        .replace(/\b[A-Z]{1,5}\b/g, '[TICKER]')
        .replace(/\b(?:Inc\.|Corp\.|Corporation|Company)\b/gi, '[COMPANY]'),
    }),
  );

  return Object.freeze({
    transcript: Object.freeze({
      ...transcript,
      companyTicker: mode.redactCompanyIdentifiers ? null : transcript.companyTicker,
      companyName: mode.redactCompanyIdentifiers ? null : transcript.companyName,
      segments: Object.freeze(redactedSegments),
    }),
    redacted: mode.redactCompanyIdentifiers,
    leakageMode: mode.leakageMode,
  });
}

export function buildLlmProvenance(input: {
  readonly mode: TranscriptAnalysisMode;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly trainingCutoff: string | null;
  readonly promptVersion: string;
  readonly inputPayload: unknown;
  readonly outputPayload: unknown;
}): LlmInferenceProvenance {
  return Object.freeze({
    modelName: input.modelName,
    modelVersion: input.modelVersion,
    trainingCutoff: input.trainingCutoff,
    promptVersion: input.promptVersion,
    inputEvidenceHash: hashTranscriptEvidence(input.inputPayload),
    outputHash: hashTranscriptEvidence(input.outputPayload),
    leakageMode: input.mode.leakageMode,
    webToolsDisabled: true,
  });
}

export function assertChronologicalResearchPolicy(mode: TranscriptAnalysisMode): void {
  if (mode.leakageMode === 'NON_CAUSAL_RESEARCH_ONLY' && mode.allowLlmEnrichment) {
    throw new Error('NON_CAUSAL_RESEARCH_ONLY forbids LLM enrichment without explicit policy.');
  }
}
