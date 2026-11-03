import { HELIOS_NATIVE13_PROBABILITY_EDGE_RULE_ID } from './constants.ts';
import type { ProbabilityEdgeDecision, ProbabilityEdgeEvaluateInput } from './types.ts';

export function evaluateProbabilityEdgeStrategy(input: ProbabilityEdgeEvaluateInput): ProbabilityEdgeDecision {
  const mid = input.yesBook.midMinor;
  if (mid === null) {
    return Object.freeze({
      ruleId: HELIOS_NATIVE13_PROBABILITY_EDGE_RULE_ID,
      action: 'HOLD',
      edgeMinor: null,
      reason: 'MISSING_MID',
    });
  }
  const edge = input.fairProbMinor - mid;
  if (edge >= input.minEdgeMinor) {
    return Object.freeze({
      ruleId: HELIOS_NATIVE13_PROBABILITY_EDGE_RULE_ID,
      action: 'BUY_YES',
      edgeMinor: edge,
      reason: 'POSITIVE_EDGE',
    });
  }
  if (-edge >= input.minEdgeMinor) {
    return Object.freeze({
      ruleId: HELIOS_NATIVE13_PROBABILITY_EDGE_RULE_ID,
      action: 'SELL_YES',
      edgeMinor: edge,
      reason: 'NEGATIVE_EDGE',
    });
  }
  return Object.freeze({
    ruleId: HELIOS_NATIVE13_PROBABILITY_EDGE_RULE_ID,
    action: 'HOLD',
    edgeMinor: edge,
    reason: 'EDGE_BELOW_THRESHOLD',
  });
}
