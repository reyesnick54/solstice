/**
 * NATIVE11 research-agent permissions. Grants are explicit; prompts cannot widen them.
 */

export const RESEARCH_AGENT_PERMISSIONS = [
  'READ_DATA',
  'RUN_ANALYSIS',
  'RUN_BACKTEST',
  'CREATE_MONITOR',
  'PROPOSE_STRATEGY',
  'REQUEST_RESEARCH',
] as const;
export type ResearchAgentPermission = (typeof RESEARCH_AGENT_PERMISSIONS)[number];

export const FORBIDDEN_RESEARCH_AGENT_PERMISSIONS = [
  'TRANSFER_FUNDS',
  'EXECUTE_ORDER',
  'DISABLE_RISK',
  'DISABLE_COMPLIANCE',
  'ENABLE_LIVE',
] as const;
export type ForbiddenResearchAgentPermission = (typeof FORBIDDEN_RESEARCH_AGENT_PERMISSIONS)[number];

export const RESEARCH_AGENT_PERMISSION_KINDS = [
  ...RESEARCH_AGENT_PERMISSIONS,
  ...FORBIDDEN_RESEARCH_AGENT_PERMISSIONS,
] as const;
export type ResearchAgentPermissionKind = (typeof RESEARCH_AGENT_PERMISSION_KINDS)[number];

export const NATIVE_AGENT_SESSION_STATES = [
  'OPEN',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'CLOSED',
] as const;
export type NativeAgentSessionState = (typeof NATIVE_AGENT_SESSION_STATES)[number];

export const TOOL_PERMISSION_OUTCOMES = ['ALLOWED', 'DENIED_NOT_GRANTED', 'DENIED_FORBIDDEN'] as const;
export type ToolPermissionOutcome = (typeof TOOL_PERMISSION_OUTCOMES)[number];

export const NATIVE_AGENT_LOOP_STOP_REASONS = [
  'TURN_LIMIT',
  'CANCELLED',
  'TOOL_LOOP',
  'COMPLETED',
] as const;
export type NativeAgentLoopStopReason = (typeof NATIVE_AGENT_LOOP_STOP_REASONS)[number];
