import type { UtcInstant } from '../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import {
  AGENT_ESCALATION_KINDS,
  AGENT_KILL_SWITCH_SCOPES,
  type AgentEscalationKind,
  type AgentKillSwitchScope,
} from './taxonomy.ts';

export type AgentMetricName =
  | 'requests'
  | 'conversations'
  | 'model_calls'
  | 'model_latency_ms'
  | 'tool_calls'
  | 'tool_latency_ms'
  | 'tool_failures'
  | 'proposal_creations'
  | 'approvals'
  | 'execution_outcomes'
  | 'structured_output_failures'
  | 'policy_blocks'
  | 'injection_detections'
  | 'model_fallbacks'
  | 'token_usage'
  | 'estimated_cost_minor'
  | 'agent_errors';

export type AgentMetricSample = {
  readonly name: AgentMetricName;
  readonly value: number;
  readonly labels: Readonly<Record<string, string>>;
  readonly at: UtcInstant;
};

const FORBIDDEN_LABEL_KEYS = new Set(['prompt', 'message', 'password', 'token', 'pan', 'cvv', 'secret', 'kyc']);

export class AgentOperationsTelemetry {
  private readonly samples: AgentMetricSample[] = [];

  record(name: AgentMetricName, value: number, at: UtcInstant, labels: Readonly<Record<string, string>> = {}): void {
    for (const key of Object.keys(labels)) {
      if (FORBIDDEN_LABEL_KEYS.has(key.toLowerCase())) {
        throw new Error('metric labels cannot carry sensitive content');
      }
    }
    this.samples.push(Object.freeze({ name, value, labels: Object.freeze({ ...labels }), at }));
  }

  snapshot(): Readonly<Record<AgentMetricName, number>> {
    const totals = emptyTotals();
    for (const sample of this.samples) {
      totals[sample.name] += sample.value;
    }
    return Object.freeze(totals);
  }

  samplesSafe(): readonly AgentMetricSample[] {
    return Object.freeze([...this.samples]);
  }
}

function emptyTotals(): Record<AgentMetricName, number> {
  return {
    requests: 0,
    conversations: 0,
    model_calls: 0,
    model_latency_ms: 0,
    tool_calls: 0,
    tool_latency_ms: 0,
    tool_failures: 0,
    proposal_creations: 0,
    approvals: 0,
    execution_outcomes: 0,
    structured_output_failures: 0,
    policy_blocks: 0,
    injection_detections: 0,
    model_fallbacks: 0,
    token_usage: 0,
    estimated_cost_minor: 0,
    agent_errors: 0,
  };
}

export type AgentSpanName =
  | 'frontend_request'
  | 'agent'
  | 'model_gateway'
  | 'tool'
  | 'domain'
  | 'proposal'
  | 'approval'
  | 'execution_authority'
  | 'provider'
  | 'ledger_evidence';

export type AgentSpan = {
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly correlationId: string;
  readonly name: AgentSpanName;
  readonly startedAt: UtcInstant;
  readonly endedAt: UtcInstant | null;
  readonly attributes: Readonly<Record<string, string>>;
};

export class AgentTraceRecorder {
  private readonly spans: AgentSpan[] = [];

  start(input: {
    readonly correlationId: string;
    readonly name: AgentSpanName;
    readonly at: UtcInstant;
    readonly parentSpanId?: string | null;
    readonly attributes?: Readonly<Record<string, string>>;
  }): AgentSpan {
    const span: AgentSpan = Object.freeze({
      spanId: `span_${this.spans.length + 1}_${input.name}`,
      parentSpanId: input.parentSpanId ?? null,
      correlationId: input.correlationId,
      name: input.name,
      startedAt: input.at,
      endedAt: null,
      attributes: Object.freeze({ ...(input.attributes ?? {}) }),
    });
    this.spans.push(span);
    return span;
  }

  end(spanId: string, at: UtcInstant): void {
    const index = this.spans.findIndex((row) => row.spanId === spanId);
    if (index >= 0) {
      const current = this.spans[index];
      if (current) {
        this.spans[index] = Object.freeze({ ...current, endedAt: at });
      }
    }
  }

  byCorrelation(correlationId: string): readonly AgentSpan[] {
    return Object.freeze(this.spans.filter((row) => row.correlationId === correlationId));
  }
}

export type AgentCostLimits = {
  readonly maxModelCallsPerTurn: number;
  readonly maxToolCallsPerTurn: number;
  readonly maxContextChars: number;
  readonly maxResponseChars: number;
  readonly perUserTurnsPerMinute: number;
  readonly agentBudgetMinor: bigint;
};

export const DEFAULT_AGENT_COST_LIMITS: AgentCostLimits = Object.freeze({
  maxModelCallsPerTurn: 2,
  maxToolCallsPerTurn: 8,
  maxContextChars: 12_000,
  maxResponseChars: 4_000,
  perUserTurnsPerMinute: 20,
  agentBudgetMinor: 50_000n,
});

export type CostDenial = {
  readonly ok: false;
  readonly code: 'COST_LIMIT' | 'RATE_LIMIT' | 'BUDGET_EXCEEDED' | 'CONTEXT_LIMIT';
  readonly detail: string;
  readonly degradeTo: 'TEMPORARILY_UNAVAILABLE' | 'READ_ONLY_TOOLS';
};

export function enforceCostLimits(input: {
  readonly limits: AgentCostLimits;
  readonly modelCallsThisTurn: number;
  readonly toolCallsThisTurn: number;
  readonly contextChars: number;
  readonly turnsThisMinute: number;
  readonly spentMinor: bigint;
}): Result<true, CostDenial> {
  if (input.modelCallsThisTurn > input.limits.maxModelCallsPerTurn) {
    return err({
      ok: false,
      code: 'COST_LIMIT',
      detail: 'max model calls per turn exceeded',
      degradeTo: 'TEMPORARILY_UNAVAILABLE',
    });
  }
  if (input.toolCallsThisTurn > input.limits.maxToolCallsPerTurn) {
    return err({
      ok: false,
      code: 'COST_LIMIT',
      detail: 'max tool calls per turn exceeded',
      degradeTo: 'READ_ONLY_TOOLS',
    });
  }
  if (input.contextChars > input.limits.maxContextChars) {
    return err({
      ok: false,
      code: 'CONTEXT_LIMIT',
      detail: 'max context size exceeded',
      degradeTo: 'TEMPORARILY_UNAVAILABLE',
    });
  }
  if (input.turnsThisMinute > input.limits.perUserTurnsPerMinute) {
    return err({
      ok: false,
      code: 'RATE_LIMIT',
      detail: 'per-user rate limit exceeded',
      degradeTo: 'TEMPORARILY_UNAVAILABLE',
    });
  }
  if (input.spentMinor > input.limits.agentBudgetMinor) {
    return err({
      ok: false,
      code: 'BUDGET_EXCEEDED',
      detail: 'Agent budget exhausted',
      degradeTo: 'TEMPORARILY_UNAVAILABLE',
    });
  }
  return ok(true);
}

export type AgentKillSwitch = {
  readonly switchId: string;
  readonly scope: AgentKillSwitchScope;
  readonly targetId: string | null;
  readonly actorId: string;
  readonly reason: string;
  readonly at: UtcInstant;
  readonly disablesOrdinaryAccountAccess: false;
};

export class AgentKillSwitchBoard {
  private readonly switches: AgentKillSwitch[] = [];

  engage(input: Omit<AgentKillSwitch, 'disablesOrdinaryAccountAccess'>): AgentKillSwitch {
    const record: AgentKillSwitch = Object.freeze({ ...input, disablesOrdinaryAccountAccess: false });
    this.switches.push(record);
    return record;
  }

  clear(switchId: string, actorId: string, at: UtcInstant): void {
    const index = this.switches.findIndex((row) => row.switchId === switchId);
    if (index >= 0) {
      this.switches.splice(index, 1);
      this.switches.push(
        Object.freeze({
          switchId: `${switchId}:cleared`,
          scope: 'ALL_AGENT_USAGE',
          targetId: switchId,
          actorId,
          reason: 'cleared',
          at,
          disablesOrdinaryAccountAccess: false,
        }),
      );
    }
  }

  blocked(input: {
    readonly modelId?: string;
    readonly toolId?: string;
    readonly financialProposal?: boolean;
    readonly jurisdiction?: string;
    readonly agentId?: string;
  }): AgentKillSwitch | null {
    for (const row of this.switches) {
      if (row.reason === 'cleared') {
        continue;
      }
      if (row.scope === 'ALL_AGENT_USAGE') {
        return row;
      }
      if (row.scope === 'MODEL' && input.modelId && row.targetId === input.modelId) {
        return row;
      }
      if (row.scope === 'TOOL' && input.toolId && row.targetId === input.toolId) {
        return row;
      }
      if (row.scope === 'FINANCIAL_PROPOSAL_TOOLS' && input.financialProposal) {
        return row;
      }
      if (row.scope === 'JURISDICTION' && input.jurisdiction && row.targetId === input.jurisdiction) {
        return row;
      }
      if (row.scope === 'SPECIFIC_AGENT' && input.agentId && row.targetId === input.agentId) {
        return row;
      }
    }
    return null;
  }

  auditLog(): readonly AgentKillSwitch[] {
    return Object.freeze([...this.switches]);
  }
}

export function killSwitchScopeKnown(scope: string): scope is AgentKillSwitchScope {
  return (AGENT_KILL_SWITCH_SCOPES as readonly string[]).includes(scope);
}

export type DegradedMode = {
  readonly gatewayAvailable: boolean;
  readonly agentUiStatus: 'AVAILABLE' | 'TEMPORARILY_UNAVAILABLE';
  readonly ordinaryApisAvailable: true;
  readonly moneyBackendIntact: true;
  readonly exchangeBackendIntact: true;
  readonly unavailableToolIds: readonly string[];
};

export function evaluateDegradedMode(input: {
  readonly gatewayAvailable: boolean;
  readonly unavailableToolIds?: readonly string[];
}): DegradedMode {
  return Object.freeze({
    gatewayAvailable: input.gatewayAvailable,
    agentUiStatus: input.gatewayAvailable ? 'AVAILABLE' : 'TEMPORARILY_UNAVAILABLE',
    ordinaryApisAvailable: true,
    moneyBackendIntact: true,
    exchangeBackendIntact: true,
    unavailableToolIds: Object.freeze([...(input.unavailableToolIds ?? [])]),
  });
}

export type AgentEscalation = {
  readonly escalationId: string;
  readonly kind: AgentEscalationKind;
  readonly ownerUserId: string;
  readonly conversationId: string | null;
  readonly summary: string;
  readonly agentResolved: false;
  readonly requiresAuthorizedStaff: true;
  readonly createdAt: UtcInstant;
};

export function openEscalation(input: {
  readonly escalationId: string;
  readonly kind: AgentEscalationKind;
  readonly ownerUserId: string;
  readonly conversationId: string | null;
  readonly summary: string;
  readonly createdAt: UtcInstant;
}): AgentEscalation {
  if (!(AGENT_ESCALATION_KINDS as readonly string[]).includes(input.kind)) {
    throw new Error('unknown escalation kind');
  }
  return Object.freeze({
    ...input,
    agentResolved: false,
    requiresAuthorizedStaff: true,
  });
}

export type LatencyBudgetName =
  | 'first_streaming_token'
  | 'simple_financial_question'
  | 'peg_lookup'
  | 'payment_proposal'
  | 'fx_proposal'
  | 'growth_proposal'
  | 'portfolio_explanation';

export type LatencyObservation = {
  readonly name: LatencyBudgetName;
  readonly elapsedMs: number;
  readonly environment: 'simulation';
  readonly productionSlaClaimed: false;
};

export function observeLatency(name: LatencyBudgetName, startedMs: number, endedMs: number): LatencyObservation {
  return Object.freeze({
    name,
    elapsedMs: Math.max(0, endedMs - startedMs),
    environment: 'simulation',
    productionSlaClaimed: false,
  });
}
