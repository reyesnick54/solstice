/**
 * Wave 6 — AI role boundary for Human Economic Valuation (PEVE).
 *
 * AI may assist classification, explanation, anomaly detection, and
 * evidence summarization. AI-generated assessment cannot directly become
 * the canonical PEVE monetary input unless a governed deterministic
 * methodology explicitly permits that architecture (none do today).
 */

export const PEVE_AI_ROLE = Object.freeze({
  mayClassifyContribution: true,
  mayExplainValuation: true,
  mayDetectAnomalies: true,
  maySummarizeEvidence: true,
  maySetCanonicalPeveMonetaryInput: false,
  mayAuthorizeValuation: false,
  mayOverrideMethodology: false,
  mayEnterBlockchainConsensus: false,
  finalValuationAuthority: false,
});

export type AiPeveAssistRequest = {
  readonly task: 'CLASSIFY' | 'EXPLAIN' | 'ANOMALY_DETECT' | 'SUMMARIZE_EVIDENCE';
  readonly contributionId: string;
  readonly evidenceDigest: string;
  readonly modelOutputDigest?: string;
};

export type AiPeveAssistResult = {
  readonly advisoryOnly: true;
  readonly becomesCanonicalPeveInput: false;
  readonly becomesMintAmount: false;
  readonly becomesSunReyQuantity: false;
  readonly task: AiPeveAssistRequest['task'];
  readonly explanationRef: string | null;
};

export function refuseAiCanonicalPeveInput(reason: string): {
  readonly ok: false;
  readonly code: 'AI_OUTPUT_CANNOT_SET_PEVE';
  readonly message: string;
} {
  return Object.freeze({
    ok: false,
    code: 'AI_OUTPUT_CANNOT_SET_PEVE',
    message: reason,
  });
}

export function aiPeveAssist(request: AiPeveAssistRequest): AiPeveAssistResult {
  return Object.freeze({
    advisoryOnly: true,
    becomesCanonicalPeveInput: false,
    becomesMintAmount: false,
    becomesSunReyQuantity: false,
    task: request.task,
    explanationRef: request.modelOutputDigest ? `advisory.${request.modelOutputDigest}` : null,
  });
}
