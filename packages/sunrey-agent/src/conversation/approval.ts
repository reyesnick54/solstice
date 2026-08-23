import type { UtcInstant } from '../../../domain/src/time.ts';
import { approvalIdFor } from '../ids.ts';
import { assertAgentCannotSelfApprove } from '../safety.ts';
import type { ConversationRefusal } from './types.ts';
import type { ConversationalAction, ConversationActor, HumanApprovalRecord } from './types.ts';

export const HIGH_IMPACT_ACKNOWLEDGEMENTS = [
  'amount',
  'destination',
  'asset',
  'fees',
  'risk',
] as const;

export function recordHumanApproval(input: {
  readonly action: ConversationalAction;
  readonly actor: ConversationActor;
  readonly now: UtcInstant;
  readonly acknowledgements: readonly string[];
  readonly conversationalYes?: boolean;
}): { readonly ok: true; readonly approval: HumanApprovalRecord } | ConversationRefusal {
  if (input.actor.kind !== 'HUMAN') {
    return refuse('APPROVAL_REQUIRES_HUMAN', 'Approval must originate from an authenticated human. The Agent cannot create this event.');
  }
  const boundary = assertAgentCannotSelfApprove({
    humanRequesterId: input.actor.subjectId,
    agentActorId: `agent:${input.action.conversationId}`,
    mandateId: input.action.actionId,
    proposalId: input.action.proposal?.proposalId ?? 'none',
    approverId: input.actor.actorId,
    approverKind: 'HUMAN',
  });
  if (!boundary.ok) {
    return refuse('AGENT_CANNOT_SELF_APPROVE', 'The Agent cannot approve this action.');
  }
  if (input.action.subjectId !== input.actor.subjectId) {
    return refuse('RESOURCE_NOT_OWNED', 'You can only approve your own actions.');
  }
  if (!input.action.proposal) {
    return refuse('SLOT_REQUIRED', 'There is no server-issued proposal to approve.');
  }
  if (input.action.status === 'APPROVED' || input.action.status === 'PROCESSING' || input.action.status === 'SUBMITTED' || input.action.status === 'COMPLETED') {
    return refuse('PROPOSAL_ALREADY_APPROVED', 'Approved terms cannot be mutated or re-approved as a new Agent event.');
  }
  if (input.action.proposal.requiresStepUp && input.actor.authenticationAssurance !== 'STEP_UP_SATISFIED') {
    return refuse('STEP_UP_REQUIRED', 'Additional verification is required. Complete the SunRey passkey or MFA flow. Do not type secrets in chat.');
  }
  if (input.action.proposal.requiresAcknowledgements) {
    if (input.conversationalYes) {
      return refuse('ACKNOWLEDGEMENT_REQUIRED', 'A conversational “Sure.” is not enough for this high-impact action. Confirm amount, destination, asset, fees, and risk on the Action Card.');
    }
    const missing = HIGH_IMPACT_ACKNOWLEDGEMENTS.filter((item) => !input.acknowledgements.includes(item));
    if (missing.length > 0) {
      return refuse('ACKNOWLEDGEMENT_REQUIRED', `Explicit acknowledgement required for: ${missing.join(', ')}.`);
    }
  }
  return {
    ok: true,
    approval: Object.freeze({
      approvalId: approvalIdFor(input.action.proposal.proposalId, input.actor.actorId, input.now),
      actionId: input.action.actionId,
      proposalId: input.action.proposal.proposalId,
      proposalVersion: input.action.proposal.version,
      userId: input.actor.actorId,
      sessionId: input.actor.sessionId,
      deviceId: input.actor.deviceId,
      timestamp: input.now,
      authenticationAssurance: input.actor.authenticationAssurance,
      acknowledgements: Object.freeze([...input.acknowledgements]),
      originatedFromAgent: false,
      actorKind: 'HUMAN',
    }),
  };
}

function refuse(code: ConversationRefusal['code'], message: string): ConversationRefusal {
  return Object.freeze({
    ok: false,
    code,
    message,
    agentIsApprover: false,
    productionMoneyMovement: false,
  });
}
