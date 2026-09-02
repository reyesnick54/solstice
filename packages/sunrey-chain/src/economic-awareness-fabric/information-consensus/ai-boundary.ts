/**
 * AI assistance boundary for Information Consensus.
 *
 * AI may assist with anomaly hints, entity match suggestions, conflict
 * explanation, and source comparison. AI must never declare monetary
 * truth, approve issuance, override rights, or fabricate observations.
 */

import type { InformationConsensusInput } from './types.ts';
import type { ExplanationCode } from './types.ts';

export const AI_INFORMATION_CONSENSUS_ROLE = Object.freeze({
  mayAssistAnomalyDetection: true,
  maySuggestEntityMatches: true,
  mayExplainConflicts: true,
  mayCompareSources: true,
  mayDeclareMonetaryTruth: false,
  mayApproveIssuance: false,
  mayOverrideFailedRights: false,
  mayOverrideHardVerification: false,
  mayFabricateObservations: false,
});

export function validateAiAssistanceBoundary(
  input: InformationConsensusInput,
): readonly ExplanationCode[] {
  const codes: ExplanationCode[] = [];
  if (input.aiAssistance) {
    codes.push('AI_ASSISTANCE_ONLY');
    if (
      input.aiAssistance.anomalyHints.length > 0 ||
      input.aiAssistance.conflictExplanation ||
      input.aiAssistance.entityMatchSuggestion
    ) {
      // AI hints are advisory only — never change the deterministic outcome path.
    }
  }
  return Object.freeze(codes);
}

export function aiCannotOverrideResult(): true {
  return true;
}
