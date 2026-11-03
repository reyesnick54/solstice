import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { AgentCapabilityGrant } from './types.ts';
import type { AgentResearchSession } from './types.ts';
import { newAgentResearchSessionId, type AgentCapabilityGrantId, type AgentResearchSessionId } from './ids.ts';

export function openAgentResearchSession(input: {
  readonly grant: AgentCapabilityGrant;
  readonly permittedToolIds: readonly string[];
  readonly activeToolIds?: readonly string[];
  readonly modelProviderRef?: string | null;
  readonly modelId?: string | null;
  readonly modelVersion?: string | null;
  readonly now: UtcInstant;
  readonly sessionId?: AgentResearchSessionId;
}): AgentResearchSession {
  if (input.grant.state !== 'ACTIVE') {
    throw new Error('cannot open research session without an active capability grant');
  }
  const sessionId = input.sessionId ?? newAgentResearchSessionId();
  return Object.freeze({
    sessionId,
    grantId: input.grant.grantId,
    customerId: input.grant.customerId,
    workOrderId: input.grant.workOrderId,
    state: 'OPEN',
    activeToolIds: Object.freeze([...(input.activeToolIds ?? [])]),
    permittedToolIds: Object.freeze([...input.permittedToolIds]),
    modelProviderRef: input.modelProviderRef ?? null,
    modelId: input.modelId ?? null,
    modelVersion: input.modelVersion ?? null,
    createdAt: input.now,
    updatedAt: input.now,
    closedAt: null,
    researchOutcomeRef: null,
    grantsExecutionAuthority: false,
  });
}

/** Seris-style per-session tool activation without widening the grant. */
export function activateSessionTools(input: {
  readonly session: AgentResearchSession;
  readonly toolIds: readonly string[];
  readonly now: UtcInstant;
}): AgentResearchSession {
  const allowed = new Set(input.session.permittedToolIds);
  const active: string[] = [];
  for (const toolId of input.toolIds) {
    if (!allowed.has(toolId)) {
      throw new Error(`tool ${toolId} is not permitted for this research session`);
    }
    active.push(toolId);
  }
  return Object.freeze({
    ...input.session,
    state: input.session.state === 'OPEN' ? 'RUNNING' : input.session.state,
    activeToolIds: Object.freeze([...new Set([...input.session.activeToolIds, ...active])]),
    updatedAt: input.now,
  });
}

export function closeAgentResearchSession(input: {
  readonly session: AgentResearchSession;
  readonly now: UtcInstant;
  readonly researchOutcomeRef?: string | null;
}): AgentResearchSession {
  return Object.freeze({
    ...input.session,
    state: 'CLOSED',
    closedAt: input.now,
    updatedAt: input.now,
    researchOutcomeRef: input.researchOutcomeRef ?? input.session.researchOutcomeRef,
  });
}

export function sessionCustomerBinding(
  session: AgentResearchSession,
  customerId: CustomerId,
): boolean {
  return session.customerId === customerId;
}

export function sessionGrantBinding(
  session: AgentResearchSession,
  grantId: AgentCapabilityGrantId,
): boolean {
  return session.grantId === grantId;
}

export function sessionWorkOrderBinding(
  session: AgentResearchSession,
  workOrderId: EconomicWorkOrderId | null,
): boolean {
  return session.workOrderId === workOrderId;
}
