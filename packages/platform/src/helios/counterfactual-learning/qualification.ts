import { digestCandidateActionSetContent, digestDecisionContext } from './seal.ts';
import type { DecisionEpisode } from './types.ts';
import {
  HELIOS_CF01_DECISION_LEDGER_BLOCKED,
  HELIOS_CF01_DECISION_LEDGER_QUALIFIED,
  HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA,
} from './taxonomy.ts';

export type Cf01QualificationResult = {
  readonly qualified: boolean;
  readonly marker: typeof HELIOS_CF01_DECISION_LEDGER_QUALIFIED | typeof HELIOS_CF01_DECISION_LEDGER_BLOCKED;
  readonly findings: readonly string[];
};

/**
 * Structural gate for CF01 records — research simulation only; does not certify strategy merit.
 */
export function evaluateCf01DecisionLedgerQualification(episode: DecisionEpisode): Cf01QualificationResult {
  const findings: string[] = [];
  if (episode.schema !== HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA) {
    findings.push('SCHEMA_MISMATCH');
  }
  if (episode.seal === null) {
    findings.push('EPISODE_NOT_SEALED');
  }
  const ctxT = Date.parse(episode.context.decisionTime);
  if (Number.isNaN(ctxT)) {
    findings.push('DECISION_TIME_UNPARSEABLE');
  }
  const expectedCtxDigest = digestDecisionContext(episode.context);
  if (episode.evidence.contextDigest !== expectedCtxDigest) {
    findings.push('CONTEXT_DIGEST_MISMATCH');
  }
  const candidateIds = new Set(episode.candidateSet.candidates.map((c) => c.candidateId));
  const setDigest = episode.candidateSet.contentDigest;
  const expectedSetDigest = digestCandidateActionSetContent({
    setId: episode.candidateSet.setId,
    candidates: episode.candidateSet.candidates.map((c) => ({
      candidateId: c.candidateId,
      actionClass: c.actionClass,
      parametersDigest: c.parametersDigest,
    })),
  });
  if (setDigest !== expectedSetDigest) {
    findings.push('CANDIDATE_SET_DIGEST_MISMATCH');
  }
  if (episode.candidateSet.candidates.length === 0 && setDigest.length > 0) {
    findings.push('CANDIDATE_SET_DIGEST_PRESENT_WITHOUT_CANDIDATES');
  }
  if (
    episode.chosenAction.candidateId !== null &&
    episode.chosenAction.source === 'CHOICE' &&
    !candidateIds.has(episode.chosenAction.candidateId)
  ) {
    findings.push('CHOSEN_CANDIDATE_NOT_IN_SET');
  }
  if (episode.evidence.contextDigest.length === 0) {
    findings.push('MISSING_CONTEXT_DIGEST');
  }
  const qualified = findings.length === 0;
  return Object.freeze({
    qualified,
    marker: qualified ? HELIOS_CF01_DECISION_LEDGER_QUALIFIED : HELIOS_CF01_DECISION_LEDGER_BLOCKED,
    findings: Object.freeze([...findings]),
  });
}
