import type { ForwardAlphaDecisionFailureCode } from './taxonomy.ts';
import type { ForwardAlphaDecisionIntegrityInput, ForwardAlphaDecisionIntegrityResult } from './types.ts';
import {
  assertCannotRelabelBacktestAsForward,
  assertCannotRelabelHistoricalReplayAsForward,
  lanePermitsForwardDecision,
} from './lane-separation.ts';

export function evaluateForwardAlphaDecisionIntegrity(
  input: ForwardAlphaDecisionIntegrityInput,
): ForwardAlphaDecisionIntegrityResult {
  const failures: ForwardAlphaDecisionFailureCode[] = [];

  if (Date.parse(input.decisionAt) >= Date.parse(input.earliestOutcomeKnowableAt)) {
    failures.push('OUTCOME_KNOWABLE_BEFORE_DECISION');
  }

  if (!input.immutableAfterSeal || Date.parse(input.sealedAt) > Date.parse(input.decisionAt)) {
    failures.push('DECISION_NOT_SEALED');
  }

  if (!input.strategyVersionFrozen) {
    failures.push('STRATEGY_VERSION_NOT_FROZEN');
  }

  if (!input.featureVersionsKnown) {
    failures.push('FEATURE_VERSIONS_UNKNOWN');
  }

  if (!input.marketDataChronological) {
    failures.push('MARKET_DATA_NOT_CHRONOLOGICAL');
  }

  if (input.outcomeAttachedAt !== null && Date.parse(input.outcomeAttachedAt) < Date.parse(input.sealedAt)) {
    failures.push('OUTCOME_ATTACHED_BEFORE_SEAL');
  }

  if (input.attemptedRelabelFromLane !== null) {
    const ok = assertCannotRelabelBacktestAsForward({
      fromLane: input.attemptedRelabelFromLane,
      toLane: input.evidenceLane,
    });
    if (!ok) {
      failures.push('LANE_RELABEL_FORBIDDEN');
    }
  }

  if (!assertCannotRelabelHistoricalReplayAsForward(input.syntheticHistoricalReplay)) {
    failures.push('LANE_RELABEL_FORBIDDEN');
  }

  const forwardLane = lanePermitsForwardDecision(input.evidenceLane);
  const qualifiesAsForward = failures.length === 0 && forwardLane;

  return Object.freeze({
    qualifiesAsForward,
    failures: Object.freeze(failures),
  });
}
