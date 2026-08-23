import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type UserAgentId = Brand<string, 'UserAgentId'>;
export type UserAgentMandateId = Brand<string, 'UserAgentMandateId'>;
export type AgentProposalRefId = Brand<string, 'AgentProposalRefId'>;
export type AgentExecutionRequestId = Brand<string, 'AgentExecutionRequestId'>;
export type AgentApprovalId = Brand<string, 'AgentApprovalId'>;
export type AgentRevocationId = Brand<string, 'AgentRevocationId'>;
export type AgentReceiptId = Brand<string, 'AgentReceiptId'>;
export type AgentSafetyEventId = Brand<string, 'AgentSafetyEventId'>;
export type MandatePolicyVersion = Brand<number, 'MandatePolicyVersion'>;
export type AgentConversationId = Brand<string, 'AgentConversationId'>;
export type AgentMessageId = Brand<string, 'AgentMessageId'>;
export type AgentMemoryId = Brand<string, 'AgentMemoryId'>;
export type AgentRuntimeEventId = Brand<string, 'AgentRuntimeEventId'>;

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex');
}

export function asUserAgentId(value: string): UserAgentId {
  if (value.length === 0) {
    throw new TypeError('UserAgentId must be non-empty');
  }
  return brandAs<string, 'UserAgentId'>(value);
}

export function asUserAgentMandateId(value: string): UserAgentMandateId {
  if (value.length === 0) {
    throw new TypeError('UserAgentMandateId must be non-empty');
  }
  return brandAs<string, 'UserAgentMandateId'>(value);
}

export function asAgentProposalRefId(value: string): AgentProposalRefId {
  if (value.length === 0) {
    throw new TypeError('AgentProposalRefId must be non-empty');
  }
  return brandAs<string, 'AgentProposalRefId'>(value);
}

export function asAgentExecutionRequestId(value: string): AgentExecutionRequestId {
  if (value.length === 0) {
    throw new TypeError('AgentExecutionRequestId must be non-empty');
  }
  return brandAs<string, 'AgentExecutionRequestId'>(value);
}

export function asAgentApprovalId(value: string): AgentApprovalId {
  if (value.length === 0) {
    throw new TypeError('AgentApprovalId must be non-empty');
  }
  return brandAs<string, 'AgentApprovalId'>(value);
}

export function asAgentRevocationId(value: string): AgentRevocationId {
  if (value.length === 0) {
    throw new TypeError('AgentRevocationId must be non-empty');
  }
  return brandAs<string, 'AgentRevocationId'>(value);
}

export function asAgentReceiptId(value: string): AgentReceiptId {
  if (value.length === 0) {
    throw new TypeError('AgentReceiptId must be non-empty');
  }
  return brandAs<string, 'AgentReceiptId'>(value);
}

export function asAgentSafetyEventId(value: string): AgentSafetyEventId {
  if (value.length === 0) {
    throw new TypeError('AgentSafetyEventId must be non-empty');
  }
  return brandAs<string, 'AgentSafetyEventId'>(value);
}

export function asAgentConversationId(value: string): AgentConversationId {
  if (value.length === 0) {
    throw new TypeError('AgentConversationId must be non-empty');
  }
  return brandAs<string, 'AgentConversationId'>(value);
}

export function asAgentMessageId(value: string): AgentMessageId {
  if (value.length === 0) {
    throw new TypeError('AgentMessageId must be non-empty');
  }
  return brandAs<string, 'AgentMessageId'>(value);
}

export function asAgentMemoryId(value: string): AgentMemoryId {
  if (value.length === 0) {
    throw new TypeError('AgentMemoryId must be non-empty');
  }
  return brandAs<string, 'AgentMemoryId'>(value);
}

export function asAgentRuntimeEventId(value: string): AgentRuntimeEventId {
  if (value.length === 0) {
    throw new TypeError('AgentRuntimeEventId must be non-empty');
  }
  return brandAs<string, 'AgentRuntimeEventId'>(value);
}

export function asMandatePolicyVersion(value: number): MandatePolicyVersion {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError('MandatePolicyVersion must be a positive integer');
  }
  return brandAs<number, 'MandatePolicyVersion'>(value);
}

export function mandateIdFor(ownerId: string, agentId: string, version: number): UserAgentMandateId {
  return asUserAgentMandateId(`uam_${digest(`mandate:${ownerId}:${agentId}:${String(version)}`).slice(0, 24)}`);
}

export function agentIdFor(ownerId: string, label: string): UserAgentId {
  return asUserAgentId(`uag_${digest(`agent:${ownerId}:${label}`).slice(0, 24)}`);
}

export function proposalIdFor(mandateId: string, contentHash: string): AgentProposalRefId {
  return asAgentProposalRefId(`apr_${digest(`proposal:${mandateId}:${contentHash}`).slice(0, 24)}`);
}

export function executionRequestIdFor(proposalHash: string, mandateHash: string): AgentExecutionRequestId {
  return asAgentExecutionRequestId(`aer_${digest(`exec:${proposalHash}:${mandateHash}`).slice(0, 24)}`);
}

export function approvalIdFor(proposalId: string, actorId: string, at: string): AgentApprovalId {
  return asAgentApprovalId(`aap_${digest(`approval:${proposalId}:${actorId}:${at}`).slice(0, 24)}`);
}

export function revocationIdFor(scope: string, targetId: string, at: string): AgentRevocationId {
  return asAgentRevocationId(`arv_${digest(`revoke:${scope}:${targetId}:${at}`).slice(0, 24)}`);
}

export function receiptIdFor(requestId: string, outcome: string): AgentReceiptId {
  return asAgentReceiptId(`arc_${digest(`receipt:${requestId}:${outcome}`).slice(0, 24)}`);
}

export function safetyEventIdFor(kind: string, mandateId: string, at: string): AgentSafetyEventId {
  return asAgentSafetyEventId(`ase_${digest(`safety:${kind}:${mandateId}:${at}`).slice(0, 24)}`);
}

export function conversationIdFor(ownerId: string, agentId: string, title: string, at: string): AgentConversationId {
  return asAgentConversationId(`acv_${digest(`conversation:${ownerId}:${agentId}:${title}:${at}`).slice(0, 24)}`);
}

export function messageIdFor(conversationId: string, role: string, at: string, content: string): AgentMessageId {
  return asAgentMessageId(`amg_${digest(`message:${conversationId}:${role}:${at}:${content}`).slice(0, 24)}`);
}

export function memoryIdFor(agentId: string, ownerId: string, category: string, content: string): AgentMemoryId {
  return asAgentMemoryId(`amm_${digest(`memory:${agentId}:${ownerId}:${category}:${content}`).slice(0, 24)}`);
}

export function runtimeEventIdFor(kind: string, targetId: string, at: string): AgentRuntimeEventId {
  return asAgentRuntimeEventId(`are_${digest(`runtime:${kind}:${targetId}:${at}`).slice(0, 24)}`);
}

export function contentHash(value: unknown): string {
  return digest(canonicalJson(value));
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (typeof item === 'bigint') {
        out[key] = item.toString();
      } else {
        out[key] = sortValue(item);
      }
    }
    return out;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}
