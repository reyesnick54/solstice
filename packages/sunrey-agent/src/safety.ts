import { err, ok, type Result } from '../../domain/src/result.ts';
import { clientDenial, type ClientDenial, type PrincipalKind } from '../../identity/src/index.ts';
import { approvalSatisfied } from './policy.ts';
import type { AgentTransactionProposal, UserAgentMandate } from './types.ts';

export type AgentSafetyActors = {
  readonly humanRequesterId: string;
  readonly agentActorId: string;
  readonly mandateId: string;
  readonly proposalId: string;
  readonly approverId: string;
  readonly approverKind: PrincipalKind;
};

/**
 * Common Agent safety boundary. An Agent principal is never treated as
 * the human user. Human requester, Agent actor, mandate, proposal, and
 * required human approval stay separate.
 */
export function assertAgentCannotSelfApprove(
  actors: AgentSafetyActors,
): Result<true, ClientDenial> {
  if (actors.approverKind === 'AGENT') {
    return err(clientDenial('AGENT_CANNOT_SELF_APPROVE'));
  }
  if (actors.approverId === actors.agentActorId) {
    return err(clientDenial('AGENT_CANNOT_SELF_APPROVE'));
  }
  if (!actors.humanRequesterId || actors.humanRequesterId === actors.agentActorId) {
    return err(clientDenial('AGENT_CANNOT_SELF_APPROVE'));
  }
  return ok(true);
}

export function evaluateAgentHumanApproval(input: {
  readonly mandate: UserAgentMandate;
  readonly proposal: AgentTransactionProposal;
  readonly humanApproved: boolean;
  readonly actors: AgentSafetyActors;
}): Result<true, ClientDenial> {
  const boundary = assertAgentCannotSelfApprove(input.actors);
  if (!boundary.ok) {
    return boundary;
  }
  const approval = approvalSatisfied({
    mandate: input.mandate,
    proposal: input.proposal,
    humanApproved: input.humanApproved,
  });
  if (!approval.ok) {
    return err(clientDenial('APPROVAL_REQUIRED'));
  }
  return ok(true);
}
