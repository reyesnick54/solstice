import type { UtcInstant } from '../../domain/src/time.ts';
import { deterministicProposalId } from './ids.ts';
import type { AgentRuntimePorts } from './ports.ts';
import { freezeProposal, type AgentProposal } from './proposal.ts';

/**
 * Agent may suggest candidate ideas. Deterministic Growth Orchestrator
 * decides constraint satisfaction, calculations, and ranking.
 */
export function generateCandidateIdeas(ports: AgentRuntimePorts, now: UtcInstant): readonly AgentProposal[] {
  const ideas: AgentProposal[] = [];
  const subject = ports.context.subjectId;
  if (ports.context.obligationLabels.some((label) => /subscription|stream|netflix|spotify/i.test(label))) {
    ideas.push(
      freezeProposal({
        proposalId: deterministicProposalId('REVIEW_SUBSCRIPTION', subject),
        kind: 'CANDIDATE_IDEA',
        subjectId: subject,
        title: 'Review recurring subscription',
        rationale: 'A recurring subscription appears in economic context and may be unused.',
        ideaAction: 'REVIEW_SUBSCRIPTION',
        relatedRefs: ports.context.obligationLabels,
        executable: false,
        createdAt: now,
      }),
    );
  }
  if (ports.context.debtLabels.length > 0) {
    ideas.push(
      freezeProposal({
        proposalId: deterministicProposalId('REDUCE_DEBT', subject),
        kind: 'CANDIDATE_IDEA',
        subjectId: subject,
        title: 'Evaluate expensive debt reduction',
        rationale: 'Known debt is present. Agent suggests evaluation only.',
        ideaAction: 'REDUCE_DEBT',
        relatedRefs: ports.context.debtLabels,
        executable: false,
        createdAt: now,
      }),
    );
  }
  if (ports.context.goalLabels.some((label) => /emergency/i.test(label))) {
    ideas.push(
      freezeProposal({
        proposalId: deterministicProposalId('ALLOCATE_RESERVE', subject),
        kind: 'CANDIDATE_IDEA',
        subjectId: subject,
        title: 'Allocate surplus toward emergency reserve',
        rationale: 'An emergency-reserve goal is present.',
        ideaAction: 'ALLOCATE_TO_EMERGENCY_RESERVE',
        relatedRefs: ports.context.goalLabels,
        executable: false,
        createdAt: now,
      }),
    );
  }
  ideas.push(
    freezeProposal({
      proposalId: deterministicProposalId('REVIEW_INVESTMENT', subject),
      kind: 'CANDIDATE_IDEA',
      subjectId: subject,
      title: 'Review future investment opportunity',
      rationale: 'Investment execution is not implemented. This remains a review placeholder.',
      ideaAction: 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE',
      relatedRefs: Object.freeze([]),
      executable: false,
      createdAt: now,
    }),
  );
  return Object.freeze(ideas);
}
