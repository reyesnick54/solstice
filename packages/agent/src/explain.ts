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

export function explainPortfolio(input: {
  readonly subjectId: string;
  readonly holdings: readonly string[];
  readonly now: UtcInstant;
}): AgentProposal {
  return freezeProposal({
    proposalId: deterministicProposalId('EXPLAIN_PORTFOLIO', input.subjectId),
    kind: 'PLAN_EXPLANATION',
    subjectId: input.subjectId,
    title: 'Portfolio explanation',
    rationale:
      input.holdings.length === 0
        ? 'No investment holdings are available to explain.'
        : `Holdings: ${input.holdings.join('; ')}. Unrealized marks are not withdrawable cash.`,
    relatedRefs: input.holdings,
    executable: false,
    createdAt: input.now,
  });
}

export function explainPerformance(input: {
  readonly subjectId: string;
  readonly realizedNote: string;
  readonly unrealizedNote: string;
  readonly now: UtcInstant;
}): AgentProposal {
  return freezeProposal({
    proposalId: deterministicProposalId('EXPLAIN_PERFORMANCE', input.subjectId),
    kind: 'PLAN_EXPLANATION',
    subjectId: input.subjectId,
    title: 'Performance explanation',
    rationale: `${input.realizedNote} ${input.unrealizedNote} This is not tax advice and not a guaranteed return.`,
    relatedRefs: Object.freeze([]),
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
