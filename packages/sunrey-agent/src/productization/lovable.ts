import { LOVABLE_AGENT_UI_COMPONENTS, type LovableAgentUiComponent } from './taxonomy.ts';

export type LovableAgentContractEntry = {
  readonly component: LovableAgentUiComponent;
  readonly backendPath: string;
  readonly methods: readonly string[];
  readonly supported: true;
  readonly notes: string;
};

export const LOVABLE_AGENT_CONTRACT: readonly LovableAgentContractEntry[] = Object.freeze([
  entry('AGENT_HOME', '/api/v1/agent', ['GET'], 'Agent home and availability'),
  entry('CHAT', '/api/v1/agent/conversations/{id}/messages', ['POST'], 'Turn-based chat'),
  entry('STREAMING', '/api/v1/agent/conversations/{id}/stream', ['GET'], 'Token and tool-progress events'),
  entry('TOOL_PROGRESS', '/api/v1/agent/conversations/{id}/stream', ['GET'], 'Typed tool progress events'),
  entry('RICH_FINANCIAL_CARDS', '/api/v1/agent/actions', ['GET'], 'Grounded financial cards'),
  entry('GROWTH_PROPOSALS', '/api/v1/agent/actions', ['GET', 'POST'], 'Growth proposal cards'),
  entry('PAYMENT_PROPOSALS', '/api/v1/agent/actions', ['GET', 'POST'], 'Payment proposal cards'),
  entry('FX_PROPOSALS', '/api/v1/agent/actions', ['GET', 'POST'], 'FX proposal cards'),
  entry('EXCHANGE_PROPOSALS', '/api/v1/agent/actions', ['GET', 'POST'], 'Exchange proposal cards'),
  entry('APPROVAL', '/api/v1/agent/actions/{id}/approve', ['POST'], 'Human approval only'),
  entry('STEP_UP', '/api/v1/agent/actions/{id}/step-up', ['POST'], 'Step-up challenge'),
  entry('EXECUTION_STATUS', '/api/v1/agent/actions/{id}', ['GET'], 'Domain-sourced status'),
  entry('ACTION_CENTER', '/api/v1/agent/actions', ['GET'], 'Pending and historical actions'),
  entry('MEMORY_PREFERENCES', '/api/v1/agent/memory', ['GET', 'POST'], 'Eligible preferences only'),
  entry('AGENT_SETTINGS', '/api/v1/agent/settings', ['GET', 'PATCH'], 'Pause, model, jurisdiction'),
  entry('PAUSE_REVOKE', '/api/v1/agent/pause', ['POST'], 'Pause or revoke Agent, not accounts'),
  entry('ERROR_DEGRADED_STATES', '/api/v1/agent', ['GET'], 'temporarily unavailable without breaking Money'),
]);

function entry(
  component: LovableAgentUiComponent,
  backendPath: string,
  methods: readonly string[],
  notes: string,
): LovableAgentContractEntry {
  return Object.freeze({ component, backendPath, methods, supported: true as const, notes });
}

export function lovableComponentsSupported(): readonly LovableAgentUiComponent[] {
  return LOVABLE_AGENT_UI_COMPONENTS;
}
