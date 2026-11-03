import {
  FORBIDDEN_RESEARCH_AGENT_PERMISSIONS,
  RESEARCH_AGENT_PERMISSIONS,
  type ForbiddenResearchAgentPermission,
  type ResearchAgentPermission,
  type ResearchAgentPermissionKind,
} from './taxonomy.ts';

export type NativeResearchToolBinding = {
  readonly permission: ResearchAgentPermissionKind;
  readonly toolId: string;
  readonly operation: string;
  readonly mutatesFinancialState: boolean;
  readonly researchOnly: boolean;
};

const CATALOG: readonly NativeResearchToolBinding[] = Object.freeze([
  bind('READ_DATA', 'tool_market_snapshot', 'READ', false),
  bind('READ_DATA', 'tool_filing_lookup', 'READ', false),
  bind('RUN_ANALYSIS', 'tool_quant_analytics', 'ANALYZE', false),
  bind('RUN_BACKTEST', 'tool_quant_analytics', 'RUN_BACKTEST', false),
  bind('CREATE_MONITOR', 'tool_research_monitor', 'CREATE', false),
  bind('PROPOSE_STRATEGY', 'tool_strategy_proposal', 'PROPOSE', false),
  bind('REQUEST_RESEARCH', 'tool_research_request', 'REQUEST', false),
  bind('EXECUTE_ORDER', 'tool_brokerage', 'EXECUTE', true),
  bind('TRANSFER_FUNDS', 'tool_funding', 'TRANSFER', true),
  bind('DISABLE_RISK', 'tool_risk_limits', 'DISABLE', true),
  bind('DISABLE_COMPLIANCE', 'tool_compliance', 'DISABLE', true),
  bind('ENABLE_LIVE', 'tool_live_trading', 'ENABLE', true),
]);

function bind(
  permission: ResearchAgentPermissionKind,
  toolId: string,
  operation: string,
  mutatesFinancialState: boolean,
): NativeResearchToolBinding {
  const forbidden = (FORBIDDEN_RESEARCH_AGENT_PERMISSIONS as readonly string[]).includes(permission);
  return Object.freeze({
    permission,
    toolId,
    operation,
    mutatesFinancialState,
    researchOnly: !forbidden,
  });
}

export function listNativeResearchToolBindings(): readonly NativeResearchToolBinding[] {
  return CATALOG;
}

export function nativeToolBindingFor(
  toolId: string,
  operation: string,
): NativeResearchToolBinding | undefined {
  return CATALOG.find((row) => row.toolId === toolId && row.operation === operation);
}

export function isForbiddenResearchPermission(
  permission: ResearchAgentPermissionKind,
): permission is ForbiddenResearchAgentPermission {
  return (FORBIDDEN_RESEARCH_AGENT_PERMISSIONS as readonly string[]).includes(permission);
}

export function isAllowedResearchPermission(
  permission: ResearchAgentPermissionKind,
): permission is ResearchAgentPermission {
  return (RESEARCH_AGENT_PERMISSIONS as readonly string[]).includes(permission);
}
