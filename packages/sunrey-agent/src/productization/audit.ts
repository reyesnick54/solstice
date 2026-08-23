import type { UtcInstant } from '../../../domain/src/time.ts';

export type AgentAuditPackage = {
  readonly auditId: string;
  readonly createdAt: UtcInstant;
  readonly conversationId: string | null;
  readonly agentId: string | null;
  readonly modelRef: string | null;
  readonly policyRef: string;
  readonly toolIds: readonly string[];
  readonly proposalId: string | null;
  readonly approvalId: string | null;
  readonly kernelDecision: string | null;
  readonly executionAuthorityRef: string | null;
  readonly providerRef: string | null;
  readonly ledgerJournalId: string | null;
  readonly outcome: string;
  readonly hiddenReasoningIncluded: false;
};

export function buildAgentAuditPackage(input: {
  readonly auditId: string;
  readonly createdAt: UtcInstant;
  readonly conversationId?: string | null;
  readonly agentId?: string | null;
  readonly modelRef?: string | null;
  readonly policyRef: string;
  readonly toolIds?: readonly string[];
  readonly proposalId?: string | null;
  readonly approvalId?: string | null;
  readonly kernelDecision?: string | null;
  readonly executionAuthorityRef?: string | null;
  readonly providerRef?: string | null;
  readonly ledgerJournalId?: string | null;
  readonly outcome: string;
}): AgentAuditPackage {
  return Object.freeze({
    auditId: input.auditId,
    createdAt: input.createdAt,
    conversationId: input.conversationId ?? null,
    agentId: input.agentId ?? null,
    modelRef: input.modelRef ?? null,
    policyRef: input.policyRef,
    toolIds: Object.freeze([...(input.toolIds ?? [])]),
    proposalId: input.proposalId ?? null,
    approvalId: input.approvalId ?? null,
    kernelDecision: input.kernelDecision ?? null,
    executionAuthorityRef: input.executionAuthorityRef ?? null,
    providerRef: input.providerRef ?? null,
    ledgerJournalId: input.ledgerJournalId ?? null,
    outcome: input.outcome,
    hiddenReasoningIncluded: false,
  });
}
