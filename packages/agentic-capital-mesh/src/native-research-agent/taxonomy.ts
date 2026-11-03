/**
 * Capital Mesh research specialists — explicit tool permissions (NATIVE11).
 * Mesh nodes propose only; they never receive execution permissions.
 */

export const MESH_RESEARCH_AGENT_PERMISSIONS = [
  'READ_DATA',
  'RUN_ANALYSIS',
  'RUN_BACKTEST',
  'CREATE_MONITOR',
  'PROPOSE_STRATEGY',
  'REQUEST_RESEARCH',
] as const;
export type MeshResearchAgentPermission = (typeof MESH_RESEARCH_AGENT_PERMISSIONS)[number];

export const MESH_FORBIDDEN_RESEARCH_PERMISSIONS = [
  'TRANSFER_FUNDS',
  'EXECUTE_ORDER',
  'DISABLE_RISK',
  'DISABLE_COMPLIANCE',
  'ENABLE_LIVE',
] as const;
export type MeshForbiddenResearchPermission = (typeof MESH_FORBIDDEN_RESEARCH_PERMISSIONS)[number];

export const MESH_RESEARCH_TOOL_IDS = Object.freeze({
  READ_DATA: 'mesh_read_data',
  RUN_ANALYSIS: 'mesh_run_analysis',
  RUN_BACKTEST: 'mesh_run_backtest',
  CREATE_MONITOR: 'mesh_create_monitor',
  PROPOSE_STRATEGY: 'mesh_propose_strategy',
  REQUEST_RESEARCH: 'mesh_request_research',
} as const);
