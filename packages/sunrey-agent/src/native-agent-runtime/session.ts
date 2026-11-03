import type { UtcInstant } from '../../../domain/src/time.ts';
import type { NativeAgentSessionState, ResearchAgentPermission } from './taxonomy.ts';

export type NativeAgentCapabilityGrant = {
  readonly grantId: string;
  readonly ownerId: string;
  readonly agentId: string;
  readonly permissions: readonly ResearchAgentPermission[];
  readonly state: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly createdAt: UtcInstant;
};

export type NativeAgentSession = {
  readonly sessionId: string;
  readonly grantId: string;
  readonly ownerId: string;
  readonly agentId: string;
  readonly conversationId: string | null;
  readonly state: NativeAgentSessionState;
  readonly permittedToolIds: readonly string[];
  readonly activeToolIds: readonly string[];
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly turnCount: number;
  readonly compactionBoundary: number;
  readonly compactionSummary: string | null;
  readonly grantsExecutionAuthority: false;
};

export function openNativeAgentSession(input: {
  readonly grant: NativeAgentCapabilityGrant;
  readonly sessionId: string;
  readonly conversationId?: string | null;
  readonly permittedToolIds: readonly string[];
  readonly activeToolIds?: readonly string[];
  readonly now: UtcInstant;
}): NativeAgentSession {
  if (input.grant.state !== 'ACTIVE') {
    throw new Error('cannot open native agent session without an active grant');
  }
  return Object.freeze({
    sessionId: input.sessionId,
    grantId: input.grant.grantId,
    ownerId: input.grant.ownerId,
    agentId: input.grant.agentId,
    conversationId: input.conversationId ?? null,
    state: 'OPEN',
    permittedToolIds: Object.freeze([...input.permittedToolIds]),
    activeToolIds: Object.freeze([...(input.activeToolIds ?? [])]),
    createdAt: input.now,
    updatedAt: input.now,
    turnCount: 0,
    compactionBoundary: 0,
    compactionSummary: null,
    grantsExecutionAuthority: false,
  });
}

/** Seris-style per-session tool activation without widening the grant. */
export function activateNativeSessionTools(input: {
  readonly session: NativeAgentSession;
  readonly toolIds: readonly string[];
  readonly now: UtcInstant;
}): NativeAgentSession {
  const allowed = new Set(input.session.permittedToolIds);
  const active = [...input.session.activeToolIds];
  for (const toolId of input.toolIds) {
    if (!allowed.has(toolId)) {
      throw new Error(`tool ${toolId} is not permitted for this native agent session`);
    }
    if (!active.includes(toolId)) {
      active.push(toolId);
    }
  }
  return Object.freeze({
    ...input.session,
    state: input.session.state === 'OPEN' ? 'RUNNING' : input.session.state,
    activeToolIds: Object.freeze(active),
    updatedAt: input.now,
  });
}

export function closeNativeAgentSession(input: {
  readonly session: NativeAgentSession;
  readonly now: UtcInstant;
  readonly state?: 'COMPLETED' | 'CLOSED' | 'CANCELLED';
}): NativeAgentSession {
  return Object.freeze({
    ...input.session,
    state: input.state ?? 'CLOSED',
    updatedAt: input.now,
  });
}

export class InMemoryNativeAgentSessionStore {
  private readonly sessions = new Map<string, NativeAgentSession>();

  put(session: NativeAgentSession): void {
    this.sessions.set(session.sessionId, session);
  }

  get(sessionId: string): NativeAgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  listForAgent(agentId: string): readonly NativeAgentSession[] {
    return Object.freeze([...this.sessions.values()].filter((row) => row.agentId === agentId));
  }
}
