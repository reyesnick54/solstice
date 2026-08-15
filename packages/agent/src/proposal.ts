import type { UtcInstant } from '../../domain/src/time.ts';
import type { AgentProposalId } from './ids.ts';

export const AGENT_PROPOSAL_KINDS = [
  'MANDATE_INTERPRETATION',
  'CANDIDATE_IDEA',
  'PLAN_EXPLANATION',
  'GOAL_EXPLANATION',
] as const;

export type AgentProposalKind = (typeof AGENT_PROPOSAL_KINDS)[number];

export const AGENT_IDEA_ACTIONS = [
  'REVIEW_SUBSCRIPTION',
  'REDUCE_FEE',
  'ALLOCATE_TO_EMERGENCY_RESERVE',
  'REDUCE_DEBT',
  'OPTIMIZE_PAYMENT_TIMING',
  'CAPTURE_REWARD',
  'MOVE_IDLE_CASH_BETWEEN_EXISTING_ELIGIBLE_ACCOUNTS',
  'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE',
] as const;

export type AgentIdeaAction = (typeof AGENT_IDEA_ACTIONS)[number];

/**
 * An AgentProposal is not a Kernel intent envelope. It cannot execute, post
 * journals, or issue signed execution authority.
 */
export type AgentProposal = {
  readonly proposalId: AgentProposalId;
  readonly kind: AgentProposalKind;
  readonly subjectId: string;
  readonly title: string;
  readonly rationale: string;
  readonly ideaAction?: AgentIdeaAction;
  readonly relatedRefs: readonly string[];
  readonly executable: false;
  readonly createdAt: UtcInstant;
};

export function freezeProposal(proposal: AgentProposal): AgentProposal {
  return Object.freeze({
    ...proposal,
    relatedRefs: Object.freeze([...proposal.relatedRefs]),
    executable: false,
  });
}
