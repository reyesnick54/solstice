import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { EconomicWorkOrderId } from '../ids.ts';
import type {
  AgentActionAuditKind,
  AgentCapabilityGrantState,
  AgentPermissionKind,
  AgentResearchPermission,
  AgentResearchSessionState,
  ForbiddenResearchAgentPermission,
  ModelCapabilityKind,
  ModelGatewayOutcome,
  ResearchAutopilotKind,
  ResearchAutopilotStatus,
  ToolPermissionOutcome,
} from './taxonomy.ts';
import type {
  AgentActionAuditId,
  AgentCapabilityGrantId,
  AgentResearchSessionId,
  ResearchAutopilotId,
} from './ids.ts';

export type AgentCapabilityGrant = {
  readonly grantId: AgentCapabilityGrantId;
  readonly customerId: CustomerId;
  readonly workOrderId: EconomicWorkOrderId | null;
  readonly agentLabel: string;
  readonly permissions: readonly AgentResearchPermission[];
  readonly forbiddenPermissions: readonly ForbiddenResearchAgentPermission[];
  readonly state: AgentCapabilityGrantState;
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly revokedAt: UtcInstant | null;
  readonly revocable: true;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
};

export type AgentToolPermission = {
  readonly permission: AgentPermissionKind;
  readonly toolId: string;
  readonly operation: string;
  readonly requiresExplicitGrant: true;
  readonly mutatesFinancialState: boolean;
  readonly researchOnly: boolean;
};

export type AgentResearchSession = {
  readonly sessionId: AgentResearchSessionId;
  readonly grantId: AgentCapabilityGrantId;
  readonly customerId: CustomerId;
  readonly workOrderId: EconomicWorkOrderId | null;
  readonly state: AgentResearchSessionState;
  readonly activeToolIds: readonly string[];
  readonly permittedToolIds: readonly string[];
  readonly modelProviderRef: string | null;
  readonly modelId: string | null;
  readonly modelVersion: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly closedAt: UtcInstant | null;
  readonly researchOutcomeRef: string | null;
  readonly grantsExecutionAuthority: false;
};

export type ModelCapability = {
  readonly capabilityId: string;
  readonly providerRef: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly kinds: readonly ModelCapabilityKind[];
  readonly contextWindowTokens: number;
  readonly supportsToolCalling: boolean;
  readonly simulationOnly: true;
  readonly mayIssueExecutionAuthority: false;
};

export type ModelCostProfile = {
  readonly profileId: string;
  readonly providerRef: string;
  readonly modelId: string;
  readonly inputMicrosPer1kTokens: bigint;
  readonly outputMicrosPer1kTokens: bigint;
  readonly toolCallMicros: bigint;
  readonly currency: 'USD';
};

export type ModelInferenceTelemetry = {
  readonly model: string;
  readonly modelVersion: string;
  readonly latencyMs: number;
  readonly costMicros: bigint;
  readonly contextTokens: number;
  readonly toolCalls: number;
  readonly failures: number;
  readonly retries: number;
  readonly outcome: ModelGatewayOutcome;
  readonly researchSessionId: AgentResearchSessionId | null;
  readonly workOrderId: EconomicWorkOrderId | null;
  readonly researchOutcomeRef: string | null;
  readonly recordedAt: UtcInstant;
  readonly providerGrantsExecutionAuthority: false;
};

export type AgentActionAudit = {
  readonly auditId: AgentActionAuditId;
  readonly kind: AgentActionAuditKind;
  readonly customerId: CustomerId;
  readonly sessionId: AgentResearchSessionId | null;
  readonly grantId: AgentCapabilityGrantId | null;
  readonly workOrderId: EconomicWorkOrderId | null;
  readonly detail: string;
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
  readonly recordedAt: UtcInstant;
};

export type ResearchAutopilotStrategy = {
  readonly autopilotId: ResearchAutopilotId;
  readonly grantId: AgentCapabilityGrantId;
  readonly sessionId: AgentResearchSessionId;
  readonly kind: ResearchAutopilotKind;
  readonly status: ResearchAutopilotStatus;
  readonly intervalMs: number;
  readonly permittedPermissions: readonly AgentResearchPermission[];
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly lastRunAt: UtcInstant | null;
  readonly runCount: number;
  readonly authorizesFinancialExecution: false;
};

export type ToolPermissionDecision = {
  readonly outcome: ToolPermissionOutcome;
  readonly permission: AgentPermissionKind;
  readonly toolId: string;
  readonly operation: string;
  readonly reason: string;
};

export type ModelGatewayInferRequest = {
  readonly sessionId: AgentResearchSessionId;
  readonly grantId: AgentCapabilityGrantId;
  readonly providerRef: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly promptTokens: number;
  readonly maxOutputTokens: number;
  readonly toolCallsRequested: number;
  readonly researchOutcomeRef: string | null;
};

export type ModelGatewayInferResult =
  | {
      readonly ok: true;
      readonly telemetry: ModelInferenceTelemetry;
      readonly outputText: string;
    }
  | {
      readonly ok: false;
      readonly telemetry: ModelInferenceTelemetry;
      readonly code: string;
      readonly message: string;
    };

/** Provider-neutral inference port — wire from @solstice/ai-runtime AiModelGateway at composition root. */
export type ModelInferencePort = {
  readonly infer: (input: {
    readonly providerRef: string;
    readonly modelId: string;
    readonly modelVersion: string;
    readonly promptTokens: number;
    readonly maxOutputTokens: number;
  }) =>
    | { readonly ok: true; readonly outputText: string; readonly latencyMs: number; readonly outputTokens: number }
    | { readonly ok: false; readonly code: string; readonly message: string; readonly latencyMs: number };
};

export type Os12StoreSnapshot = {
  readonly grants: readonly AgentCapabilityGrant[];
  readonly sessions: readonly AgentResearchSession[];
  readonly audits: readonly AgentActionAudit[];
  readonly telemetries: readonly ModelInferenceTelemetry[];
  readonly autopilots: readonly ResearchAutopilotStrategy[];
};
