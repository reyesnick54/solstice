import {
  AGENT_RESEARCH_PERMISSIONS,
  FORBIDDEN_RESEARCH_AGENT_PERMISSIONS,
  type AgentPermissionKind,
  type AgentResearchPermission,
  type ForbiddenResearchAgentPermission,
} from './taxonomy.ts';
import type { AgentToolPermission } from './types.ts';

const RESEARCH_TOOL_CATALOG: readonly AgentToolPermission[] = Object.freeze([
  perm('READ_MARKET_DATA', 'tool_market_observation', 'READ', false),
  perm('READ_FUNDAMENTALS', 'tool_filing_lookup', 'READ', false),
  perm('READ_FUNDAMENTALS', 'tool_document_search', 'READ', false),
  perm('READ_MACRO', 'tool_economic_data_search', 'READ', false),
  perm('READ_MACRO', 'tool_economic_calendar', 'READ', false),
  perm('RUN_BACKTEST', 'tool_quant_analytics', 'RUN_BACKTEST', false),
  perm('CREATE_RESEARCH_MONITOR', 'tool_research_monitor', 'CREATE', false),
  perm('PROPOSE_STRATEGY', 'tool_strategy_proposal', 'PROPOSE', false),
  perm('REQUEST_ADDITIONAL_RESEARCH', 'tool_research_request', 'REQUEST', false),
  perm('EXECUTE_ORDER', 'tool_brokerage', 'EXECUTE', true),
  perm('TRANSFER_FUNDS', 'tool_funding', 'TRANSFER', true),
  perm('CHANGE_RISK_LIMITS', 'tool_risk_limits', 'MUTATE', true),
  perm('DISABLE_COMPLIANCE', 'tool_compliance', 'DISABLE', true),
  perm('ENABLE_LIVE_TRADING', 'tool_live_trading', 'ENABLE', true),
]);

function perm(
  permission: AgentPermissionKind,
  toolId: string,
  operation: string,
  mutatesFinancialState: boolean,
): AgentToolPermission {
  const forbidden = (FORBIDDEN_RESEARCH_AGENT_PERMISSIONS as readonly string[]).includes(permission);
  return Object.freeze({
    permission,
    toolId,
    operation,
    requiresExplicitGrant: true,
    mutatesFinancialState,
    researchOnly: !forbidden,
  });
}

export function listResearchToolPermissions(): readonly AgentToolPermission[] {
  return RESEARCH_TOOL_CATALOG;
}

export function toolPermissionFor(
  toolId: string,
  operation: string,
): AgentToolPermission | undefined {
  return RESEARCH_TOOL_CATALOG.find((row) => row.toolId === toolId && row.operation === operation);
}

export function isForbiddenPermission(
  permission: AgentPermissionKind,
): permission is ForbiddenResearchAgentPermission {
  return (FORBIDDEN_RESEARCH_AGENT_PERMISSIONS as readonly string[]).includes(permission);
}

export function isResearchPermission(
  permission: AgentPermissionKind,
): permission is AgentResearchPermission {
  return (AGENT_RESEARCH_PERMISSIONS as readonly string[]).includes(permission);
}

export function defaultResearchAgentPermissions(): readonly AgentResearchPermission[] {
  return AGENT_RESEARCH_PERMISSIONS;
}

export function forbiddenPermissionsForResearchAgents(): readonly ForbiddenResearchAgentPermission[] {
  return FORBIDDEN_RESEARCH_AGENT_PERMISSIONS;
}
