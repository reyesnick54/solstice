import type { ExistingToolAuditRow } from './types.ts';

/**
 * Phase F Prompt 3 audit of existing agent tool surfaces.
 * Domain agent-tool.ts files remain specialized adapters, not a second registry.
 */
export const EXISTING_AGENT_TOOL_AUDIT: readonly ExistingToolAuditRow[] = Object.freeze([
  {
    path: 'packages/sunrey-agent/src/tools/registry.ts',
    name: 'AgentToolRegistry',
    classification: 'CANONICAL',
    notes: 'One registry for approved Financial Agent tools.',
  },
  {
    path: 'packages/sunrey-agent/src/grow-tools.ts',
    name: 'GROW_AGENT_TOOL_NAMES / invokeGrowAgentTool',
    classification: 'INCOMPLETE',
    notes: 'Phase E hook names without schema, mandate, budget, or evidence. Absorbed by the registry.',
  },
  {
    path: 'packages/sunrey-agent/src/growth-tools.ts',
    name: 'GrowthToolPort helpers',
    classification: 'CANONICAL',
    notes: 'Specialized Growth Plan / proposal id guards. Runtime calls grow ports; this stays the fabrication fence.',
  },
  {
    path: 'packages/sunrey-exchange/src/agent-tool.ts',
    name: 'SubjectScopedSunReyExchangeTool',
    classification: 'CANONICAL',
    notes: 'Read-only market explanation. place/cancel/halt/settle remain AGENT_CANNOT_EXECUTE.',
  },
  {
    path: 'packages/custody/src/agent-tool.ts',
    name: 'SubjectScopedCustodyTool',
    classification: 'CANONICAL',
    notes: 'Explain-only refusal. Withdrawal uses createWithdrawalProposal, not custody initiateWithdrawal.',
  },
  {
    path: 'packages/consent/src/agent-tool.ts',
    name: 'PurposeScopedVaultTool',
    classification: 'CANONICAL',
    notes: 'Derived income read. Raw receipts stay out of scope.',
  },
  {
    path: 'packages/sunrey-coin/src/agent-tool.ts',
    name: 'SubjectScopedSunReyCoinTool',
    classification: 'CANONICAL',
    notes: 'Position/eligibility explanation. No issue/transfer/burn.',
  },
  {
    path: 'packages/sunrey-chain/src/native-assets/client-surface.ts',
    name: 'authorizeAgentNativeEconomyAction',
    classification: 'CANONICAL',
    notes: 'Read-only native economy. Agent cannot mint, burn, or modify policy.',
  },
  {
    path: 'packages/clean-room/src/agent-tool.ts',
    name: 'SubjectScopedCleanRoomTool',
    classification: 'SIMULATION',
    notes: 'Own-aggregate only. Not a product Financial Agent tool.',
  },
  {
    path: 'packages/information-market/src/agent-tool.ts',
    name: 'SubjectScopedInformationMarketTool',
    classification: 'CANONICAL',
    notes: 'Structural refusals including addBeneficiary.',
  },
  {
    path: 'packages/market-surveillance/src/agent-tool.ts',
    name: 'SubjectScopedSurveillanceTool',
    classification: 'CANONICAL',
    notes: 'Refuse-all. Agents are not surveillance operators.',
  },
  {
    path: 'packages/ai-runtime/src/tools.ts',
    name: 'RefuseExecuteToolIntentBroker',
    classification: 'CANONICAL',
    notes: 'Inference-plane intents only. Preparation still requires ProposalGate.',
  },
  {
    path: 'packages/sunrey-agent/src/budget.ts',
    name: 'evaluateBudget',
    classification: 'CANONICAL',
    notes: 'Mandate budget. Tool runtime rejects over-limit proposals before the model presents them.',
  },
  {
    path: 'packages/sunrey-agent/src/gate.ts',
    name: 'ProposalGate',
    classification: 'CANONICAL',
    notes: 'Proposal conversion only. Tools never requestExecution.',
  },
  {
    path: 'packages/sunrey-agent/src/mobile.ts',
    name: 'replayedApproval / signingIntentSummary',
    classification: 'CANONICAL',
    notes: 'Human approval path. Not a tool that spends.',
  },
  {
    path: 'packages/agent-tools',
    name: 'packages/agent-tools',
    classification: 'DEPRECATED',
    notes: 'Forbidden alias. Do not create.',
  },
  {
    path: 'packages/tool-runtime',
    name: 'packages/tool-runtime',
    classification: 'DEPRECATED',
    notes: 'Forbidden alias. Runtime lives under packages/sunrey-agent/src/tools.',
  },
]);
