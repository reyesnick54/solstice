import type { Clock } from '../../../config/src/clock.ts';
import { contentHash } from '../ids.ts';
import type { AgentMessage } from '../types.ts';
import { NativeToolCallAuditTrail } from './audit.ts';
import { compactConversationMessages, type CompactionBoundary } from './compaction.ts';
import { BoundedNativeAgentLoop, DEFAULT_NATIVE_AGENT_LOOP_LIMITS, type NativeAgentLoopLimits } from './loop.ts';
import { authorizeNativeResearchTool } from './permissions.ts';
import {
  activateNativeSessionTools,
  closeNativeAgentSession,
  InMemoryNativeAgentSessionStore,
  openNativeAgentSession,
  type NativeAgentCapabilityGrant,
  type NativeAgentSession,
} from './session.ts';

export type NativeAgentRuntimeOptions = {
  readonly clock: Clock;
  readonly sessions?: InMemoryNativeAgentSessionStore;
  readonly audit?: NativeToolCallAuditTrail;
  readonly loopLimits?: NativeAgentLoopLimits;
};

export type NativeToolInvocationResult = {
  readonly decision: ReturnType<typeof authorizeNativeResearchTool>;
  readonly auditId: string | null;
  readonly session: NativeAgentSession;
};

/**
 * Canonical SunRey native agent runtime (NATIVE11). Composes persistent sessions,
 * bounded loops, compaction, permission gating, and tool-call auditing.
 */
export class NativeAgentRuntimeService {
  readonly sessions: InMemoryNativeAgentSessionStore;
  readonly audit: NativeToolCallAuditTrail;
  private readonly clock: Clock;
  private readonly loopLimits: NativeAgentLoopLimits;
  private readonly loops = new Map<string, BoundedNativeAgentLoop>();
  private readonly compactionBySession = new Map<string, CompactionBoundary | null>();

  constructor(options: NativeAgentRuntimeOptions) {
    this.clock = options.clock;
    this.sessions = options.sessions ?? new InMemoryNativeAgentSessionStore();
    this.audit = options.audit ?? new NativeToolCallAuditTrail(options.clock);
    this.loopLimits = options.loopLimits ?? DEFAULT_NATIVE_AGENT_LOOP_LIMITS;
  }

  openSession(input: {
    readonly grant: NativeAgentCapabilityGrant;
    readonly sessionId: string;
    readonly conversationId?: string | null;
    readonly permittedToolIds: readonly string[];
    readonly initialActiveToolIds?: readonly string[];
  }): NativeAgentSession {
    const session = openNativeAgentSession({
      grant: input.grant,
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      permittedToolIds: input.permittedToolIds,
      activeToolIds: input.initialActiveToolIds,
      now: this.clock.now(),
    });
    this.sessions.put(session);
    this.loops.set(session.sessionId, new BoundedNativeAgentLoop(this.loopLimits));
    this.compactionBySession.set(session.sessionId, null);
    return session;
  }

  activateTools(sessionId: string, toolIds: readonly string[]): NativeAgentSession {
    const session = this.requireSession(sessionId);
    const next = activateNativeSessionTools({ session, toolIds, now: this.clock.now() });
    this.sessions.put(next);
    return next;
  }

  cancelSession(sessionId: string): NativeAgentSession {
    this.loops.get(sessionId)?.cancel();
    const session = this.requireSession(sessionId);
    const next = closeNativeAgentSession({ session, now: this.clock.now(), state: 'CANCELLED' });
    this.sessions.put(next);
    return next;
  }

  beginTurn(sessionId: string): ReturnType<BoundedNativeAgentLoop['beginTurn']> {
    const loop = this.requireLoop(sessionId);
    return loop.beginTurn();
  }

  compactSessionMessages(sessionId: string, messages: readonly AgentMessage[]) {
    const boundary = this.compactionBySession.get(sessionId) ?? null;
    const result = compactConversationMessages({ messages, priorBoundary: boundary });
    if (result.boundary) {
      this.compactionBySession.set(sessionId, result.boundary);
    }
    const session = this.requireSession(sessionId);
    const next = Object.freeze({
      ...session,
      compactionBoundary: result.boundary?.boundaryIndex ?? session.compactionBoundary,
      compactionSummary: result.boundary?.summary ?? session.compactionSummary,
      updatedAt: this.clock.now(),
    });
    this.sessions.put(next);
    return result;
  }

  invokeResearchTool(input: {
    readonly sessionId: string;
    readonly grant: NativeAgentCapabilityGrant;
    readonly toolId: string;
    readonly operation: string;
    readonly payload: Readonly<Record<string, unknown>>;
  }): NativeToolInvocationResult {
    const started = Date.now();
    const session = this.requireSession(input.sessionId);
    const loop = this.requireLoop(input.sessionId);
    const toolGate = loop.recordToolCall();
    if (!toolGate.ok) {
      const decision = authorizeNativeResearchTool({
        grant: input.grant,
        sessionActiveToolIds: session.activeToolIds,
        toolId: input.toolId,
        operation: input.operation,
      });
      return Object.freeze({
        decision: Object.freeze({ ...decision, outcome: 'DENIED_NOT_GRANTED', reason: `loop stopped: ${toolGate.reason}` }),
        auditId: null,
        session,
      });
    }

    const decision = authorizeNativeResearchTool({
      grant: input.grant,
      sessionActiveToolIds: session.activeToolIds,
      toolId: input.toolId,
      operation: input.operation,
    });
    const executed = decision.outcome === 'ALLOWED';
    const audit = this.audit.record({
      sessionId: session.sessionId,
      agentId: session.agentId,
      ownerId: session.ownerId,
      toolId: input.toolId,
      operation: input.operation,
      decision,
      executed,
      durationMs: Date.now() - started,
      inputHash: contentHash(input.payload),
    });

    const nextSession = Object.freeze({
      ...session,
      turnCount: session.turnCount + 1,
      updatedAt: this.clock.now(),
    });
    this.sessions.put(nextSession);

    return Object.freeze({
      decision,
      auditId: audit.auditId,
      session: nextSession,
    });
  }

  private requireSession(sessionId: string): NativeAgentSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`native agent session ${sessionId} not found`);
    }
    return session;
  }

  private requireLoop(sessionId: string): BoundedNativeAgentLoop {
    const loop = this.loops.get(sessionId);
    if (!loop) {
      throw new Error(`native agent loop for ${sessionId} not found`);
    }
    return loop;
  }
}
