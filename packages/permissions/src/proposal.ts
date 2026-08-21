import { randomUUID } from 'node:crypto';

import { isExpired, type Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { transitionApproval, type ApprovalState, type ApprovalTransitionFailure } from './approval.ts';
import type { PolicyDecisionRef } from './decision.ts';

export type ExecutionProposalAmount = {
  readonly minorUnits: string;
  readonly currency: string;
  readonly assetId: string | null;
};

export type ExecutionProposalResource = {
  readonly kind: string;
  readonly id: string;
};

export type ExecutionProposal = {
  readonly proposalId: string;
  readonly requesterSubjectId: string;
  readonly requesterActorId: string;
  readonly humanRequesterId: string;
  readonly agentActorId: string | null;
  readonly agentMandateId: string | null;
  readonly actionType: string;
  readonly capability: string;
  readonly resources: readonly ExecutionProposalResource[];
  readonly amount: ExecutionProposalAmount | null;
  readonly destination: string | null;
  readonly riskComplianceRef: string | null;
  readonly createdAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly requiredApprovals: readonly string[];
  readonly authenticationRequirement: string;
  readonly policyDecisionRef: PolicyDecisionRef | null;
  readonly idempotencyKey: string;
  readonly requestId: string;
  readonly correlationId: string | null;
  readonly state: ApprovalState;
  readonly executionAuthorityId: string | null;
};

export type ProposalFailure = ApprovalTransitionFailure | {
  readonly code: 'PROPOSAL_NOT_FOUND' | 'PROPOSAL_EXPIRED' | 'IDEMPOTENCY_CONFLICT';
  readonly message: string;
};

export class InMemoryProposalStore {
  private readonly byId = new Map<string, ExecutionProposal>();
  private readonly byIdempotency = new Map<string, string>();

  get(proposalId: string): ExecutionProposal | undefined {
    return this.byId.get(proposalId);
  }

  getByIdempotency(idempotencyKey: string): ExecutionProposal | undefined {
    const id = this.byIdempotency.get(idempotencyKey);
    return id ? this.byId.get(id) : undefined;
  }

  put(proposal: ExecutionProposal): void {
    this.byId.set(proposal.proposalId, proposal);
    this.byIdempotency.set(proposal.idempotencyKey, proposal.proposalId);
  }

  list(): readonly ExecutionProposal[] {
    return [...this.byId.values()];
  }
}

export function createExecutionProposal(input: {
  readonly requesterSubjectId: string;
  readonly requesterActorId: string;
  readonly humanRequesterId: string;
  readonly agentActorId?: string | null;
  readonly agentMandateId?: string | null;
  readonly actionType: string;
  readonly capability: string;
  readonly resources: readonly ExecutionProposalResource[];
  readonly amount?: ExecutionProposalAmount | null;
  readonly destination?: string | null;
  readonly riskComplianceRef?: string | null;
  readonly createdAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly requiredApprovals?: readonly string[];
  readonly authenticationRequirement: string;
  readonly idempotencyKey: string;
  readonly requestId: string;
  readonly correlationId?: string | null;
}): ExecutionProposal {
  return Object.freeze({
    proposalId: `prp_${randomUUID()}`,
    requesterSubjectId: input.requesterSubjectId,
    requesterActorId: input.requesterActorId,
    humanRequesterId: input.humanRequesterId,
    agentActorId: input.agentActorId ?? null,
    agentMandateId: input.agentMandateId ?? null,
    actionType: input.actionType,
    capability: input.capability,
    resources: Object.freeze([...input.resources]),
    amount: input.amount ?? null,
    destination: input.destination ?? null,
    riskComplianceRef: input.riskComplianceRef ?? null,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    requiredApprovals: Object.freeze([...(input.requiredApprovals ?? [])]),
    authenticationRequirement: input.authenticationRequirement,
    policyDecisionRef: null,
    idempotencyKey: input.idempotencyKey,
    requestId: input.requestId,
    correlationId: input.correlationId ?? null,
    state: 'DRAFT',
    executionAuthorityId: null,
  });
}

export function advanceProposal(
  proposal: ExecutionProposal,
  next: ApprovalState,
  clock: Clock,
  patch: Partial<Pick<ExecutionProposal, 'policyDecisionRef' | 'executionAuthorityId'>> = {},
): Result<ExecutionProposal, ProposalFailure> {
  if (isExpired(proposal.expiresAt, clock.now()) && next !== 'EXPIRED') {
    return err({ code: 'PROPOSAL_EXPIRED', message: 'proposal has expired' });
  }
  const moved = transitionApproval(proposal.state, next);
  if (!moved.ok) {
    return err(moved.error);
  }
  return ok(
    Object.freeze({
      ...proposal,
      ...patch,
      state: moved.state,
    }),
  );
}
