/**
 * OS12 — explicit agent tool permissions and model-agnostic research gateway.
 * Research agents never receive financial execution permissions.
 */

export const HELIOS_OS12_SCHEMA_VERSION = 'sunrey.helios.os12-agent-permission-gateway.v1' as const;

export const HELIOS_OS12_AGENT_PERMISSION_GATEWAY_QUALIFIED =
  'HELIOS_OS12_AGENT_PERMISSION_GATEWAY_QUALIFIED' as const;

export const HELIOS_OS12_AGENT_PERMISSION_GATEWAY_BLOCKED =
  'HELIOS_OS12_AGENT_PERMISSION_GATEWAY_BLOCKED' as const;

/** Explicit capability grants — must be enumerated, never inferred from prompts. */
export const AGENT_RESEARCH_PERMISSIONS = [
  'READ_MARKET_DATA',
  'READ_FUNDAMENTALS',
  'READ_MACRO',
  'RUN_BACKTEST',
  'CREATE_RESEARCH_MONITOR',
  'PROPOSE_STRATEGY',
  'REQUEST_ADDITIONAL_RESEARCH',
] as const;
export type AgentResearchPermission = (typeof AGENT_RESEARCH_PERMISSIONS)[number];

/** Never granted to research agents — financial or compliance bypass. */
export const FORBIDDEN_RESEARCH_AGENT_PERMISSIONS = [
  'EXECUTE_ORDER',
  'TRANSFER_FUNDS',
  'CHANGE_RISK_LIMITS',
  'DISABLE_COMPLIANCE',
  'ENABLE_LIVE_TRADING',
] as const;
export type ForbiddenResearchAgentPermission = (typeof FORBIDDEN_RESEARCH_AGENT_PERMISSIONS)[number];

export const AGENT_PERMISSION_KINDS = [
  ...AGENT_RESEARCH_PERMISSIONS,
  ...FORBIDDEN_RESEARCH_AGENT_PERMISSIONS,
] as const;
export type AgentPermissionKind = (typeof AGENT_PERMISSION_KINDS)[number];

export const AGENT_CAPABILITY_GRANT_STATES = ['ACTIVE', 'REVOKED', 'EXPIRED'] as const;
export type AgentCapabilityGrantState = (typeof AGENT_CAPABILITY_GRANT_STATES)[number];

export const AGENT_RESEARCH_SESSION_STATES = [
  'OPEN',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'CLOSED',
] as const;
export type AgentResearchSessionState = (typeof AGENT_RESEARCH_SESSION_STATES)[number];

export const MODEL_CAPABILITY_KINDS = [
  'TEXT_GENERATION',
  'STRUCTURED_OUTPUT',
  'TOOL_CALLING',
  'REASONING',
  'EMBEDDING',
] as const;
export type ModelCapabilityKind = (typeof MODEL_CAPABILITY_KINDS)[number];

export const RESEARCH_AUTOPILOT_KINDS = [
  'MACRO_MONITOR',
  'FUNDAMENTAL_DIGEST',
  'BACKTEST_WATCH',
  'STRATEGY_REVIEW',
  'CUSTOM_RESEARCH',
] as const;
export type ResearchAutopilotKind = (typeof RESEARCH_AUTOPILOT_KINDS)[number];

export const RESEARCH_AUTOPILOT_STATUSES = ['ACTIVE', 'PAUSED', 'CLOSED'] as const;
export type ResearchAutopilotStatus = (typeof RESEARCH_AUTOPILOT_STATUSES)[number];

export const AGENT_ACTION_AUDIT_KINDS = [
  'CAPABILITY_GRANT_ISSUED',
  'CAPABILITY_GRANT_REVOKED',
  'TOOL_PERMISSION_DENIED',
  'TOOL_PERMISSION_ALLOWED',
  'MODEL_INFERENCE',
  'MODEL_INFERENCE_FAILED',
  'AUTOPILOT_TICK',
  'AUTOPILOT_BLOCKED',
  'SESSION_OPENED',
  'SESSION_CLOSED',
  'RESEARCH_OUTCOME_ATTRIBUTED',
] as const;
export type AgentActionAuditKind = (typeof AGENT_ACTION_AUDIT_KINDS)[number];

export const TOOL_PERMISSION_OUTCOMES = ['ALLOWED', 'DENIED_NOT_GRANTED', 'DENIED_FORBIDDEN'] as const;
export type ToolPermissionOutcome = (typeof TOOL_PERMISSION_OUTCOMES)[number];

export const MODEL_GATEWAY_OUTCOMES = ['SUCCESS', 'FAILURE', 'CANCELLED'] as const;
export type ModelGatewayOutcome = (typeof MODEL_GATEWAY_OUTCOMES)[number];
