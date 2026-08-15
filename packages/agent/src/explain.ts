import type { UtcInstant } from '../../domain/src/time.ts';
import { deterministicProposalId } from './ids.ts';
import { freezeProposal, type AgentProposal } from './proposal.ts';

export function explainGoals(input: {
  readonly subjectId: string;
  readonly goalSummaries: readonly string[];
  readonly now: UtcInstant;
}): AgentProposal {
  return freezeProposal({
    proposalId: deterministicProposalId('EXPLAIN_GOALS', input.subjectId),
    kind: 'GOAL_EXPLANATION',
    subjectId: input.subjectId,
    title: 'Goal explanation',
    rationale:
      input.goalSummaries.length === 0
        ? 'No compiled goals are available to explain.'
        : `Recorded goals: ${input.goalSummaries.join('; ')}. Achievement is not promised.`,
    relatedRefs: input.goalSummaries,
    executable: false,
    createdAt: input.now,
  });
}

export function explainPlan(input: {
  readonly subjectId: string;
  readonly planSummary: string;
  readonly now: UtcInstant;
}): AgentProposal {
  return freezeProposal({
    proposalId: deterministicProposalId('EXPLAIN_PLAN', input.subjectId),
    kind: 'PLAN_EXPLANATION',
    subjectId: input.subjectId,
    title: 'Plan explanation',
    rationale: input.planSummary,
    relatedRefs: Object.freeze([]),
    executable: false,
    createdAt: input.now,
  });
}

export function explainEconomicValue(input: {
  readonly subjectId: string;
  readonly valueSummary: string;
  readonly now: UtcInstant;
}): AgentProposal {
  return freezeProposal({
    proposalId: deterministicProposalId('EXPLAIN_VALUE', input.subjectId),
    kind: 'VALUE_EXPLANATION',
    subjectId: input.subjectId,
    title: 'Economic value explanation',
    rationale: `${input.valueSummary} The agent translates PEVE output; it does not calculate authoritative values or set scores.`,
    relatedRefs: Object.freeze([]),
    executable: false,
    createdAt: input.now,
  });
}
