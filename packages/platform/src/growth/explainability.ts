import type { GrowthActionCandidate, ActionExplanation, GrowthPlan } from './types.ts';

export function explainCandidate(
  candidate: GrowthActionCandidate,
  rejected: readonly GrowthActionCandidate[],
): ActionExplanation {
  const canExecuteToday =
    candidate.executionCapability === 'KERNEL_AUTHORIZATION_REQUIRED' ||
    candidate.executionCapability === 'USER_CONFIRMATION_REQUIRED';
  return {
    actionId: candidate.actionId,
    whyThis: candidate.title,
    whyNow: candidate.assumptions[0] ?? 'Current PEG facts and the active mandate support review now.',
    supportedGoal: candidate.supportingGoalIds[0] ?? 'no_specific_goal',
    supportingFacts: candidate.supportingFactRefs,
    mandateRule: candidate.mandateEvaluation.satisfied
      ? 'Active hard constraints are satisfied.'
      : candidate.mandateEvaluation.notes.join(' '),
    rejectedAlternatives: rejected
      .filter((item) => item.actionId !== candidate.actionId)
      .slice(0, 3)
      .map((item) => `${item.action}: ${item.mandateEvaluation.notes[0] ?? item.title}`),
    whatCouldGoWrong: candidate.expectedEffect.kind === 'UNCERTAIN_MARKET_OUTCOME'
      ? 'Market outcomes are uncertain and not promised.'
      : 'Facts may change; a stale plan must be recomputed.',
    requiresConfirmation: candidate.userConfirmationRequired,
    canExecuteToday:
      canExecuteToday &&
      candidate.action !== 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE' &&
      candidate.action !== 'INVESTMENT_ACCOUNT_AVAILABLE' &&
      candidate.action !== 'PAPER_INVESTMENT_REVIEW_AVAILABLE'
        ? true
        : false,
  };
}

export function explainPlan(plan: GrowthPlan): readonly ActionExplanation[] {
  const rejected = plan.rejectedCandidates.map((item) => item.candidate);
  return Object.freeze(plan.orderedProposedActions.map((item) => explainCandidate(item, rejected)));
}
