import type { Clock } from '../../../config/src/clock.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { contentHash } from '../ids.ts';
import type { UserAgentMandateEngine } from '../engine.ts';
import { authorizeToolCall } from './authorization.ts';
import { createCanonicalToolRegistry } from './catalog.ts';
import { ToolEvidenceRecorder } from './evidence.ts';
import { handleTool } from './handlers.ts';
import { DEFAULT_TURN_LIMITS, ToolLoopGuard, type TurnLimits } from './loop-guard.ts';
import type { AgentToolDomainPorts } from './ports.ts';
import { AgentToolRegistry } from './registry.ts';
import { redactToolInput, validateToolInput } from './schema.ts';
import type { AgentToolResult, StructuredToolCall, ToolSession } from './types.ts';

export type AgentToolRuntimeOptions = {
  readonly engine: UserAgentMandateEngine;
  readonly ports: AgentToolDomainPorts;
  readonly clock: Clock;
  readonly vault?: EvidenceVault;
  readonly registry?: AgentToolRegistry;
  readonly limits?: TurnLimits;
};

/**
 * MODEL → STRUCTURED TOOL CALL → TOOL RUNTIME → VALIDATION → MANDATE →
 * AUTHORIZATION → CANONICAL DOMAIN SERVICE → STRUCTURED TOOL RESULT → MODEL
 *
 * The model cannot invent API calls, query databases, import privileged
 * services, or access Ledger / provider credentials.
 */
export class AgentToolRuntime {
  readonly registry: AgentToolRegistry;
  private readonly engine: UserAgentMandateEngine;
  private readonly ports: AgentToolDomainPorts;
  private readonly clock: Clock;
  private readonly evidence: ToolEvidenceRecorder;
  private readonly guards = new Map<string, ToolLoopGuard>();
  private readonly limits: TurnLimits;

  constructor(options: AgentToolRuntimeOptions) {
    this.engine = options.engine;
    this.ports = options.ports;
    this.clock = options.clock;
    this.registry = options.registry ?? createCanonicalToolRegistry();
    this.limits = options.limits ?? DEFAULT_TURN_LIMITS;
    this.evidence = new ToolEvidenceRecorder(options.vault ?? new EvidenceVault(options.clock), options.clock);
  }

  invoke(session: ToolSession, call: StructuredToolCall): AgentToolResult {
    const startedAt = this.clock.now();
    const startedMs = Date.now();
    const tool = this.registry.get(call.toolId);
    if (!tool) {
      return this.finish(session, call, startedAt, startedMs, {
        status: 'FAILED',
        toolId: call.toolId,
        version: call.version ?? 'unknown',
        executed: false,
        payload: {},
        rendering: null,
        error: {
          code: 'UNKNOWN_TOOL',
          safeMessage: 'That tool is not an approved SunRey tool.',
          inventingNumbersForbidden: true,
        },
        proposalId: null,
        workflowId: null,
      }, 'UNKNOWN_TOOL');
    }
    if (call.version && call.version !== tool.version) {
      return this.finish(session, call, startedAt, startedMs, {
        status: 'NOT_ELIGIBLE',
        toolId: tool.toolId,
        version: tool.version,
        executed: false,
        payload: {},
        rendering: null,
        error: {
          code: 'TOOL_VERSION_NOT_APPROVED',
          safeMessage: 'That tool version is not the approved financial semantics version.',
          inventingNumbersForbidden: true,
        },
        proposalId: null,
        workflowId: null,
      }, 'TOOL_VERSION_NOT_APPROVED');
    }
    const validated = validateToolInput(tool.inputSchema, call.input);
    if (!validated.ok) {
      return this.finish(session, call, startedAt, startedMs, {
        status: 'FAILED',
        toolId: tool.toolId,
        version: tool.version,
        executed: false,
        payload: {},
        rendering: null,
        error: { code: validated.code, safeMessage: validated.detail, inventingNumbersForbidden: true },
        proposalId: null,
        workflowId: null,
      }, validated.code);
    }
    const guard = this.guardFor(session);
    const loop = guard.inspect({ ...call, input: validated.value }, tool.createsProposal);
    if (!loop.ok) {
      return this.finish(session, call, startedAt, startedMs, {
        status: 'FAILED',
        toolId: tool.toolId,
        version: tool.version,
        executed: false,
        payload: {},
        rendering: null,
        error: { code: loop.code, safeMessage: loop.safeMessage, inventingNumbersForbidden: true },
        proposalId: null,
        workflowId: null,
      }, loop.code);
    }
    const agent = this.engine.getAgent(session.agentId);
    const mandate = this.engine.getMandate(session.mandateId);
    const authorized = authorizeToolCall({
      tool,
      session,
      agent,
      mandate,
      rationale: typeof validated.value.purpose === 'string' ? validated.value.purpose : undefined,
    });
    if (!authorized.ok || !mandate) {
      return this.finish(session, call, startedAt, startedMs, {
        status: authorized.ok ? 'NOT_ELIGIBLE' : authorized.status,
        toolId: tool.toolId,
        version: tool.version,
        executed: false,
        payload: {},
        rendering: null,
        error: {
          code: authorized.ok ? 'MISSING_MANDATE' : authorized.code,
          safeMessage: authorized.ok ? 'A valid mandate is required.' : authorized.safeMessage,
          inventingNumbersForbidden: true,
        },
        proposalId: null,
        workflowId: null,
      }, authorized.ok ? 'MISSING_MANDATE' : authorized.code);
    }
    const handled = handleTool({
      engine: this.engine,
      ports: this.ports,
      session,
      mandate,
      tool,
      input: validated.value,
      correlationId: session.correlationId,
    });
    const durationMs = Date.now() - startedMs;
    if (durationMs > tool.timeoutMs && handled.workflowId === null && handled.status === 'SUCCESS') {
      return this.finish(session, call, startedAt, startedMs, {
        ...handled,
        status: 'ACTION_REQUIRED',
        workflowId: `wf_${contentHash({ tool: tool.toolId, turn: session.turnId }).slice(0, 16)}`,
        payload: Object.freeze({
          ...handled.payload,
          timeout: true,
          note: 'long-running work returned a workflow id rather than holding inference open',
        }),
      }, 'TIMEOUT_WORKFLOW');
    }
    return this.finish(session, call, startedAt, startedMs, handled, 'AUTHORIZED');
  }

  private guardFor(session: ToolSession): ToolLoopGuard {
    const existing = this.guards.get(session.turnId);
    if (existing) {
      return existing;
    }
    const created = new ToolLoopGuard(this.limits);
    this.guards.set(session.turnId, created);
    return created;
  }

  private finish(
    session: ToolSession,
    call: StructuredToolCall,
    startedAt: ToolSession['now'],
    startedMs: number,
    result: Omit<AgentToolResult, 'durationMs' | 'correlationId'>,
    authorizationResult: string,
  ): AgentToolResult {
    const durationMs = Date.now() - startedMs;
    const complete: AgentToolResult = Object.freeze({
      ...result,
      durationMs,
      correlationId: session.correlationId,
    });
    this.evidence.seal({
      session,
      toolId: result.toolId,
      toolVersion: result.version,
      inputHash: contentHash(call.input),
      redactedInput: redactToolInput(call.input),
      authorizationResult,
      resultStatus: complete.status,
      resultReference: complete.proposalId ?? complete.correlationId,
      startedAt,
      durationMs,
    });
    return complete;
  }
}

export function createAgentToolRuntime(options: AgentToolRuntimeOptions): AgentToolRuntime {
  return new AgentToolRuntime(options);
}
