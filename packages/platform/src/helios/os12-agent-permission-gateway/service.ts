import type { Clock } from '../../../../config/src/clock.ts';
import type { CustomerId } from '../../../../domain/src/customer.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import { recordAgentActionAudit } from './audit.ts';
import { createResearchAutopilotStrategy, tickResearchAutopilot } from './autopilot.ts';
import { createAgentCapabilityGrant, revokeAgentCapabilityGrant, type CreateAgentCapabilityGrantInput } from './grants.ts';
import { ModelProviderGateway } from './model-gateway.ts';
import {
  activateSessionTools,
  closeAgentResearchSession,
  openAgentResearchSession,
} from './research-session.ts';
import { InMemoryOs12AgentPermissionStore } from './store.ts';
import { authorizeAgentToolPermission } from './tool-permission.ts';
import type {
  AgentActionAudit,
  AgentCapabilityGrant,
  AgentResearchSession,
  ModelGatewayInferRequest,
  ModelGatewayInferResult,
  ModelInferencePort,
  ResearchAutopilotStrategy,
  ToolPermissionDecision,
} from './types.ts';
import type { AgentCapabilityGrantId, AgentResearchSessionId, ResearchAutopilotId } from './ids.ts';
import type { ResearchAutopilotKind } from './taxonomy.ts';

export type Os12ServiceFailure = {
  readonly code: 'NOT_FOUND' | 'CUSTOMER_MISMATCH' | 'INVALID_STATE';
  readonly message: string;
};

export type HeliosOs12AgentPermissionGatewayOptions = {
  readonly clock: Clock;
  readonly store?: InMemoryOs12AgentPermissionStore;
  readonly inference: ModelInferencePort;
};

export class HeliosOs12AgentPermissionGatewayService {
  private readonly clock: Clock;
  private readonly store: InMemoryOs12AgentPermissionStore;
  private readonly modelGateway: ModelProviderGateway;

  constructor(options: HeliosOs12AgentPermissionGatewayOptions) {
    this.clock = options.clock;
    this.store = options.store ?? new InMemoryOs12AgentPermissionStore();
    this.modelGateway = new ModelProviderGateway({
      clock: options.clock,
      inference: options.inference,
    });
  }

  issueGrant(input: Omit<CreateAgentCapabilityGrantInput, 'now'>): AgentCapabilityGrant {
    const grant = createAgentCapabilityGrant({ ...input, now: this.clock.now() });
    this.store.putGrant(grant);
    this.store.appendAudit(
      recordAgentActionAudit({
        kind: 'CAPABILITY_GRANT_ISSUED',
        customerId: grant.customerId,
        grantId: grant.grantId,
        workOrderId: grant.workOrderId,
        detail: `issued research grant to ${grant.agentLabel}`,
        payload: Object.freeze({ permissionCount: grant.permissions.length }),
        now: this.clock.now(),
      }),
    );
    return grant;
  }

  revokeGrant(grantId: AgentCapabilityGrantId, customerId: CustomerId): Result<AgentCapabilityGrant, Os12ServiceFailure> {
    const grant = this.store.getGrant(grantId);
    if (!grant) {
      return err({ code: 'NOT_FOUND', message: 'grant not found' });
    }
    if (grant.customerId !== customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'grant belongs to another customer' });
    }
    const revoked = revokeAgentCapabilityGrant(grant, this.clock.now());
    this.store.putGrant(revoked);
    this.store.appendAudit(
      recordAgentActionAudit({
        kind: 'CAPABILITY_GRANT_REVOKED',
        customerId,
        grantId,
        workOrderId: revoked.workOrderId,
        detail: 'revoked research capability grant',
        now: this.clock.now(),
      }),
    );
    return ok(revoked);
  }

  openSession(input: {
    readonly grantId: AgentCapabilityGrantId;
    readonly customerId: CustomerId;
    readonly permittedToolIds: readonly string[];
    readonly modelProviderRef?: string | null;
    readonly modelId?: string | null;
    readonly modelVersion?: string | null;
  }): Result<AgentResearchSession, Os12ServiceFailure> {
    const grant = this.store.getGrant(input.grantId);
    if (!grant) {
      return err({ code: 'NOT_FOUND', message: 'grant not found' });
    }
    if (grant.customerId !== input.customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'grant belongs to another customer' });
    }
    const session = openAgentResearchSession({
      grant,
      permittedToolIds: input.permittedToolIds,
      modelProviderRef: input.modelProviderRef,
      modelId: input.modelId,
      modelVersion: input.modelVersion,
      now: this.clock.now(),
    });
    this.store.putSession(session);
    this.store.appendAudit(
      recordAgentActionAudit({
        kind: 'SESSION_OPENED',
        customerId: input.customerId,
        sessionId: session.sessionId,
        grantId: grant.grantId,
        workOrderId: session.workOrderId,
        detail: 'opened persistent research session',
        now: this.clock.now(),
      }),
    );
    return ok(session);
  }

  activateTools(
    sessionId: AgentResearchSessionId,
    customerId: CustomerId,
    toolIds: readonly string[],
  ): Result<AgentResearchSession, Os12ServiceFailure> {
    const session = this.store.getSession(sessionId);
    if (!session) {
      return err({ code: 'NOT_FOUND', message: 'session not found' });
    }
    if (session.customerId !== customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'session belongs to another customer' });
    }
    try {
      const updated = activateSessionTools({ session, toolIds, now: this.clock.now() });
      this.store.putSession(updated);
      return ok(updated);
    } catch (error) {
      return err({
        code: 'INVALID_STATE',
        message: error instanceof Error ? error.message : 'tool activation failed',
      });
    }
  }

  authorizeTool(
    grantId: AgentCapabilityGrantId,
    customerId: CustomerId,
    toolId: string,
    operation: string,
    sessionId?: AgentResearchSessionId,
  ): ToolPermissionDecision {
    const grant = this.store.getGrant(grantId);
    if (!grant || grant.customerId !== customerId) {
      return Object.freeze({
        outcome: 'DENIED_NOT_GRANTED',
        permission: 'REQUEST_ADDITIONAL_RESEARCH',
        toolId,
        operation,
        reason: 'grant missing or customer mismatch',
      });
    }
    const decision = authorizeAgentToolPermission({ grant, toolId, operation });
    this.store.appendAudit(
      recordAgentActionAudit({
        kind: decision.outcome === 'ALLOWED' ? 'TOOL_PERMISSION_ALLOWED' : 'TOOL_PERMISSION_DENIED',
        customerId,
        sessionId: sessionId ?? null,
        grantId,
        workOrderId: grant.workOrderId,
        detail: decision.reason,
        payload: Object.freeze({
          toolId,
          operation,
          outcome: decision.outcome,
        }),
        now: this.clock.now(),
      }),
    );
    return decision;
  }

  infer(request: ModelGatewayInferRequest): ModelGatewayInferResult {
    const session = this.store.getSession(request.sessionId);
    const grant = this.store.getGrant(request.grantId);
    const workOrderId = session?.workOrderId ?? grant?.workOrderId ?? null;
    const customerId = session?.customerId ?? grant?.customerId;
    const result = this.modelGateway.infer(request, workOrderId);
    this.store.appendTelemetry(result.telemetry);
    if (customerId) {
      this.store.appendAudit(
        recordAgentActionAudit({
          kind: result.ok ? 'MODEL_INFERENCE' : 'MODEL_INFERENCE_FAILED',
          customerId,
          sessionId: request.sessionId,
          grantId: request.grantId,
          workOrderId,
          detail: result.ok ? 'model inference succeeded' : result.message,
          payload: Object.freeze({
            model: request.modelId,
            modelVersion: request.modelVersion,
            latencyMs: result.telemetry.latencyMs,
            costMicros: String(result.telemetry.costMicros),
            toolCalls: result.telemetry.toolCalls,
            retries: result.telemetry.retries,
          }),
          now: this.clock.now(),
        }),
      );
      if (result.ok && request.researchOutcomeRef) {
        this.store.appendAudit(
          recordAgentActionAudit({
            kind: 'RESEARCH_OUTCOME_ATTRIBUTED',
            customerId,
            sessionId: request.sessionId,
            grantId: request.grantId,
            workOrderId,
            detail: 'research outcome attributed to model invocation',
            payload: Object.freeze({ researchOutcomeRef: request.researchOutcomeRef }),
            now: this.clock.now(),
          }),
        );
      }
    }
    return result;
  }

  registerAutopilot(input: {
    readonly grantId: AgentCapabilityGrantId;
    readonly sessionId: AgentResearchSessionId;
    readonly customerId: CustomerId;
    readonly kind: ResearchAutopilotKind;
    readonly intervalMs: number;
  }): Result<ResearchAutopilotStrategy, Os12ServiceFailure> {
    const grant = this.store.getGrant(input.grantId);
    const session = this.store.getSession(input.sessionId);
    if (!grant || !session) {
      return err({ code: 'NOT_FOUND', message: 'grant or session not found' });
    }
    if (grant.customerId !== input.customerId || session.customerId !== input.customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'customer mismatch' });
    }
    try {
      const strategy = createResearchAutopilotStrategy({
        grant,
        session,
        kind: input.kind,
        intervalMs: input.intervalMs,
        now: this.clock.now(),
      });
      this.store.putAutopilot(strategy);
      return ok(strategy);
    } catch (error) {
      return err({
        code: 'INVALID_STATE',
        message: error instanceof Error ? error.message : 'autopilot registration failed',
      });
    }
  }

  runAutopilotTick(
    autopilotId: ResearchAutopilotId,
    customerId: CustomerId,
    requestedPermission: string,
  ): Result<ResearchAutopilotStrategy, Os12ServiceFailure> {
    const strategy = this.store.getAutopilot(autopilotId);
    if (!strategy) {
      return err({ code: 'NOT_FOUND', message: 'autopilot not found' });
    }
    const grant = this.store.getGrant(strategy.grantId);
    if (!grant || grant.customerId !== customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'grant missing or customer mismatch' });
    }
    const tick = tickResearchAutopilot({
      strategy,
      grant,
      now: this.clock.now(),
      requestedPermission,
    });
    if (!tick.result.ok) {
      this.store.appendAudit(
        recordAgentActionAudit({
          kind: 'AUTOPILOT_BLOCKED',
          customerId,
          sessionId: strategy.sessionId,
          grantId: strategy.grantId,
          workOrderId: grant.workOrderId,
          detail: tick.result.message,
          now: this.clock.now(),
        }),
      );
      return err({ code: 'INVALID_STATE', message: tick.result.message });
    }
    this.store.putAutopilot(tick.strategy);
    this.store.appendAudit(
      recordAgentActionAudit({
        kind: 'AUTOPILOT_TICK',
        customerId,
        sessionId: strategy.sessionId,
        grantId: strategy.grantId,
        workOrderId: grant.workOrderId,
        detail: tick.result.summary,
        now: this.clock.now(),
      }),
    );
    return ok(tick.strategy);
  }

  closeSession(
    sessionId: AgentResearchSessionId,
    customerId: CustomerId,
    researchOutcomeRef?: string | null,
  ): Result<AgentResearchSession, Os12ServiceFailure> {
    const session = this.store.getSession(sessionId);
    if (!session) {
      return err({ code: 'NOT_FOUND', message: 'session not found' });
    }
    if (session.customerId !== customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'session belongs to another customer' });
    }
    const closed = closeAgentResearchSession({
      session,
      now: this.clock.now(),
      researchOutcomeRef,
    });
    this.store.putSession(closed);
    this.store.appendAudit(
      recordAgentActionAudit({
        kind: 'SESSION_CLOSED',
        customerId,
        sessionId,
        grantId: closed.grantId,
        workOrderId: closed.workOrderId,
        detail: 'closed research session',
        now: this.clock.now(),
      }),
    );
    return ok(closed);
  }

  listAudits(): readonly AgentActionAudit[] {
    return this.store.listAudits();
  }

  snapshot() {
    return this.store.snapshot();
  }
}
