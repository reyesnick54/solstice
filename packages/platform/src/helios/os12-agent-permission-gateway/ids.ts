import { randomUUID } from 'node:crypto';

export type AgentCapabilityGrantId = string & { readonly __brand: 'AgentCapabilityGrantId' };
export type AgentResearchSessionId = string & { readonly __brand: 'AgentResearchSessionId' };
export type AgentActionAuditId = string & { readonly __brand: 'AgentActionAuditId' };
export type ResearchAutopilotId = string & { readonly __brand: 'ResearchAutopilotId' };

export function asAgentCapabilityGrantId(value: string): AgentCapabilityGrantId {
  return value as AgentCapabilityGrantId;
}

export function asAgentResearchSessionId(value: string): AgentResearchSessionId {
  return value as AgentResearchSessionId;
}

export function asAgentActionAuditId(value: string): AgentActionAuditId {
  return value as AgentActionAuditId;
}

export function asResearchAutopilotId(value: string): ResearchAutopilotId {
  return value as ResearchAutopilotId;
}

export function newAgentCapabilityGrantId(prefix = 'acg'): AgentCapabilityGrantId {
  return asAgentCapabilityGrantId(`${prefix}_${randomUUID()}`);
}

export function newAgentResearchSessionId(prefix = 'ars'): AgentResearchSessionId {
  return asAgentResearchSessionId(`${prefix}_${randomUUID()}`);
}

export function newAgentActionAuditId(prefix = 'aaa'): AgentActionAuditId {
  return asAgentActionAuditId(`${prefix}_${randomUUID()}`);
}

export function newResearchAutopilotId(prefix = 'rap'): ResearchAutopilotId {
  return asResearchAutopilotId(`${prefix}_${randomUUID()}`);
}
