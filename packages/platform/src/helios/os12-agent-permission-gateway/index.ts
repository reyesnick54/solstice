export { HELIOS_OS12_SERIS_UPSTREAM } from './upstream-attribution.ts';

export {
  HELIOS_OS12_SCHEMA_VERSION,
  HELIOS_OS12_AGENT_PERMISSION_GATEWAY_QUALIFIED,
  HELIOS_OS12_AGENT_PERMISSION_GATEWAY_BLOCKED,
  AGENT_RESEARCH_PERMISSIONS,
  FORBIDDEN_RESEARCH_AGENT_PERMISSIONS,
  AGENT_PERMISSION_KINDS,
  AGENT_CAPABILITY_GRANT_STATES,
  AGENT_RESEARCH_SESSION_STATES,
  MODEL_CAPABILITY_KINDS,
  RESEARCH_AUTOPILOT_KINDS,
  RESEARCH_AUTOPILOT_STATUSES,
  AGENT_ACTION_AUDIT_KINDS,
  TOOL_PERMISSION_OUTCOMES,
  MODEL_GATEWAY_OUTCOMES,
  type AgentResearchPermission,
  type ForbiddenResearchAgentPermission,
  type AgentPermissionKind,
  type AgentCapabilityGrantState,
  type AgentResearchSessionState,
  type ModelCapabilityKind,
  type ResearchAutopilotKind,
  type ResearchAutopilotStatus,
  type AgentActionAuditKind,
  type ToolPermissionOutcome,
  type ModelGatewayOutcome,
} from './taxonomy.ts';

export {
  asAgentCapabilityGrantId,
  asAgentResearchSessionId,
  asAgentActionAuditId,
  asResearchAutopilotId,
  newAgentCapabilityGrantId,
  newAgentResearchSessionId,
  newAgentActionAuditId,
  newResearchAutopilotId,
  type AgentCapabilityGrantId,
  type AgentResearchSessionId,
  type AgentActionAuditId,
  type ResearchAutopilotId,
} from './ids.ts';

export type {
  AgentCapabilityGrant,
  AgentToolPermission,
  AgentResearchSession,
  ModelCapability,
  ModelCostProfile,
  ModelInferenceTelemetry,
  AgentActionAudit,
  ResearchAutopilotStrategy,
  ToolPermissionDecision,
  ModelGatewayInferRequest,
  ModelGatewayInferResult,
  ModelInferencePort,
  Os12StoreSnapshot,
} from './types.ts';

export {
  listResearchToolPermissions,
  toolPermissionFor,
  isForbiddenPermission,
  isResearchPermission,
  defaultResearchAgentPermissions,
  forbiddenPermissionsForResearchAgents,
} from './permission-catalog.ts';

export { authorizeAgentToolPermission } from './tool-permission.ts';
export {
  createAgentCapabilityGrant,
  revokeAgentCapabilityGrant,
  type CreateAgentCapabilityGrantInput,
} from './grants.ts';
export {
  openAgentResearchSession,
  activateSessionTools,
  closeAgentResearchSession,
} from './research-session.ts';
export {
  DEFAULT_SIMULATION_MODEL_CAPABILITIES,
  DEFAULT_MODEL_COST_PROFILES,
  resolveModelCapability,
  resolveModelCostProfile,
  estimateInferenceCostMicros,
} from './model-profiles.ts';
export {
  ModelProviderGateway,
  attachResearchOutcomeAttribution,
  type ModelProviderGatewayOptions,
} from './model-gateway.ts';
export { createResearchAutopilotStrategy, tickResearchAutopilot } from './autopilot.ts';
export { recordAgentActionAudit } from './audit.ts';
export { InMemoryOs12AgentPermissionStore } from './store.ts';
export {
  HeliosOs12AgentPermissionGatewayService,
  type HeliosOs12AgentPermissionGatewayOptions,
  type Os12ServiceFailure,
} from './service.ts';
export {
  assessOs12AgentPermissionGatewayQualification,
  type Os12QualificationReport,
} from './qualification.ts';
export { createSimulationModelInferencePort } from './simulation-inference.ts';
