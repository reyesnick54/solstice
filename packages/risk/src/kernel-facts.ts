import { DECISION_RANK, type DecisionStatus } from '../../permissions/src/decision.ts';
import type { InvestmentRiskKernelFacts, RiskOutcome } from './types.ts';

export function kernelStatusFromRiskOutcome(outcome: RiskOutcome): DecisionStatus {
  if (outcome === 'BLOCK') {
    return 'BLOCK';
  }
  if (outcome === 'INSUFFICIENT_DATA') {
    return 'DEFER';
  }
  if (outcome === 'REQUIRE_REVIEW') {
    return 'REQUIRE_MANUAL_REVIEW';
  }
  return 'ALLOW';
}

export function escalateWithInvestmentRisk(
  current: DecisionStatus,
  facts: InvestmentRiskKernelFacts | undefined,
): { readonly status: DecisionStatus; readonly reason: string } {
  if (!facts) {
    return { status: current, reason: 'no investment-risk facts on this intent' };
  }
  const next = kernelStatusFromRiskOutcome(facts.outcome);
  const status = DECISION_RANK[next] > DECISION_RANK[current] ? next : current;
  return {
    status,
    reason: `investment risk ${facts.outcome} assessment ${facts.assessmentId} model ${facts.modelVersion}`,
  };
}
