import type { GrowFinancialAgentId, LifecycleStageStatus } from './taxonomy.ts';
import type { OpportunityCategory } from '../../growth/opportunity/taxonomy.ts';
import type { OpportunityDetectorKind } from '../../growth/opportunity/taxonomy.ts';

export type GrowAgentCapabilityStage = 'DISCOVER' | 'ANALYZE' | 'PROPOSE' | 'AUTHORIZE' | 'EXECUTE' | 'MONITOR';

export type GrowAgentCapabilityMatrixRow = {
  readonly agentId: GrowFinancialAgentId;
  readonly label: string;
  readonly opportunityCategories: readonly OpportunityCategory[];
  readonly detectors: readonly OpportunityDetectorKind[];
  readonly inputs: readonly string[];
  readonly dataSources: readonly string[];
  readonly analysis: string;
  readonly proposalType: string;
  readonly executionCapability: string;
  readonly providerDependency: string;
  readonly userAuthorizationRequired: true;
  readonly stages: Readonly<Record<GrowAgentCapabilityStage, LifecycleStageStatus>>;
  readonly liveProvider: LifecycleStageStatus;
  readonly regulatoryDependency: LifecycleStageStatus;
};

const SIMULATED = 'SIMULATED' as const;
const IMPLEMENTED = 'IMPLEMENTED' as const;
const PARTIAL = 'PARTIAL' as const;
const PROVIDER_GATED = 'PROVIDER_GATED' as const;
const REGULATORY_GATED = 'REGULATORY_GATED' as const;
const NOT_IMPLEMENTED = 'NOT_IMPLEMENTED' as const;

function row(
  agentId: GrowFinancialAgentId,
  label: string,
  categories: readonly OpportunityCategory[],
  detectors: readonly OpportunityDetectorKind[],
  extras: Partial<GrowAgentCapabilityMatrixRow> = {},
): GrowAgentCapabilityMatrixRow {
  return Object.freeze({
    agentId,
    label,
    opportunityCategories: categories,
    detectors,
    inputs: extras.inputs ?? Object.freeze(['PEG snapshot', 'mandate constraints', 'ledger positions']),
    dataSources: extras.dataSources ?? Object.freeze(['PEG', 'LEDGER_POSITION', 'MANDATE_GOAL']),
    analysis: extras.analysis ?? 'Deterministic detectors + suitability; AI explains only',
    proposalType: extras.proposalType ?? 'CASH_TRANSFER or INVESTMENT_BUY via GrowthPlan',
    executionCapability: extras.executionCapability ?? 'USER_CONFIRMATION_REQUIRED / PROVIDER_REQUIRED',
    providerDependency: extras.providerDependency ?? 'Sandbox investment provider for trades; none for pure cash planning',
    userAuthorizationRequired: true,
    stages: Object.freeze({
      DISCOVER: IMPLEMENTED,
      ANALYZE: IMPLEMENTED,
      PROPOSE: IMPLEMENTED,
      AUTHORIZE: IMPLEMENTED,
      EXECUTE: extras.stages?.EXECUTE ?? PROVIDER_GATED,
      MONITOR: extras.stages?.MONITOR ?? PARTIAL,
    }),
    liveProvider: extras.liveProvider ?? NOT_IMPLEMENTED,
    regulatoryDependency: extras.regulatoryDependency ?? REGULATORY_GATED,
  });
}

export const GROW_FINANCIAL_AGENT_MATRIX: readonly GrowAgentCapabilityMatrixRow[] = Object.freeze([
  row('savings', 'Savings / recurring contribution', ['RECURRING_SAVING', 'GOAL_FUNDING'], ['RECURRING_SURPLUS', 'GOAL_FUNDING_GAP'], {
    proposalType: 'RECURRING_CONTRIBUTION',
    executionCapability: 'KERNEL_GATED',
    stages: { DISCOVER: IMPLEMENTED, ANALYZE: IMPLEMENTED, PROPOSE: IMPLEMENTED, AUTHORIZE: IMPLEMENTED, EXECUTE: SIMULATED, MONITOR: IMPLEMENTED },
  }),
  row('cash_optimization', 'Cash optimization', ['CASH_OPTIMIZATION', 'EMERGENCY_RESERVE'], ['EXCESS_IDLE_CASH', 'INSUFFICIENT_RESERVE'], {
    proposalType: 'CASH_TRANSFER',
    executionCapability: 'KERNEL_GATED',
    stages: { DISCOVER: IMPLEMENTED, ANALYZE: IMPLEMENTED, PROPOSE: IMPLEMENTED, AUTHORIZE: IMPLEMENTED, EXECUTE: SIMULATED, MONITOR: IMPLEMENTED },
  }),
  row('investment', 'Investment allocation', ['INVESTMENT_ALLOCATION'], ['UNINVESTED_INVESTMENT_CASH', 'MARKET_RESEARCH_CANDIDATE'], {
    dataSources: Object.freeze(['PEG', 'PORTFOLIO_FACTS', 'PUBLIC_MARKET_RESEARCH']),
    proposalType: 'INVESTMENT_BUY',
    executionCapability: 'PROVIDER_REQUIRED',
    providerDependency: 'Sandbox INVESTMENT.PAPER_ORDER provider; live broker not connected',
    stages: { DISCOVER: IMPLEMENTED, ANALYZE: IMPLEMENTED, PROPOSE: IMPLEMENTED, AUTHORIZE: IMPLEMENTED, EXECUTE: PROVIDER_GATED, MONITOR: PARTIAL },
  }),
  row('debt', 'Debt optimization', ['DEBT_OPTIMIZATION'], [], {
    inputs: Object.freeze(['PEG obligations', 'rate catalog']),
    analysis: 'Detector scaffold only',
    stages: { DISCOVER: PARTIAL, ANALYZE: PARTIAL, PROPOSE: NOT_IMPLEMENTED, AUTHORIZE: NOT_IMPLEMENTED, EXECUTE: NOT_IMPLEMENTED, MONITOR: NOT_IMPLEMENTED },
  }),
  row('income_opportunity', 'Income allocation', ['INCOME_ALLOCATION'], ['RECURRING_SURPLUS'], {
    stages: { DISCOVER: PARTIAL, ANALYZE: IMPLEMENTED, PROPOSE: IMPLEMENTED, AUTHORIZE: IMPLEMENTED, EXECUTE: PROVIDER_GATED, MONITOR: PARTIAL },
  }),
  row('subscription_savings', 'Subscription / expense savings', ['EXPENSE_OPTIMIZATION'], ['HIGH_FEES'], {
    stages: { DISCOVER: IMPLEMENTED, ANALYZE: IMPLEMENTED, PROPOSE: PARTIAL, AUTHORIZE: IMPLEMENTED, EXECUTE: NOT_IMPLEMENTED, MONITOR: PARTIAL },
  }),
  row('resource_exposure', 'Resource / physical economy exposure', ['CURRENCY_OPTIMIZATION'], ['CURRENCY_CONCENTRATION'], {
    dataSources: Object.freeze(['PEG', 'EXTERNAL_DATA_WAVE5']),
    analysis: 'Physical-economy context flags only; no trade execution',
    executionCapability: 'UNAVAILABLE',
    stages: { DISCOVER: PARTIAL, ANALYZE: PARTIAL, PROPOSE: NOT_IMPLEMENTED, AUTHORIZE: NOT_IMPLEMENTED, EXECUTE: NOT_IMPLEMENTED, MONITOR: PARTIAL },
  }),
  row('real_estate', 'Real estate savings context', ['GOAL_FUNDING'], ['GOAL_FUNDING_GAP'], {
    dataSources: Object.freeze(['PEG', 'REAL_ESTATE_CONTEXT']),
    proposalType: 'GOAL_FUNDING plan component',
    stages: { DISCOVER: PARTIAL, ANALYZE: PARTIAL, PROPOSE: PARTIAL, AUTHORIZE: IMPLEMENTED, EXECUTE: NOT_IMPLEMENTED, MONITOR: PARTIAL },
  }),
  row('travel_savings', 'Travel savings goals', ['GOAL_FUNDING'], ['GOAL_FUNDING_GAP'], {
    dataSources: Object.freeze(['PEG', 'TRAVEL_CONTEXT']),
    stages: { DISCOVER: PARTIAL, ANALYZE: PARTIAL, PROPOSE: PARTIAL, AUTHORIZE: IMPLEMENTED, EXECUTE: NOT_IMPLEMENTED, MONITOR: PARTIAL },
  }),
  row('portfolio_monitoring', 'Portfolio monitoring / rebalance proposals', ['PORTFOLIO_REBALANCE', 'DIVERSIFICATION'], ['PORTFOLIO_DRIFT', 'PORTFOLIO_CONCENTRATION'], {
    dataSources: Object.freeze(['PORTFOLIO_FACTS', 'LEDGER_POSITION']),
    proposalType: 'INVESTMENT_BUY/SELL proposal after drift threshold',
    executionCapability: 'PROVIDER_REQUIRED',
    stages: { DISCOVER: IMPLEMENTED, ANALYZE: IMPLEMENTED, PROPOSE: IMPLEMENTED, AUTHORIZE: IMPLEMENTED, EXECUTE: PROVIDER_GATED, MONITOR: IMPLEMENTED },
  }),
]);

export function growAgentById(agentId: GrowFinancialAgentId): GrowAgentCapabilityMatrixRow | undefined {
  return GROW_FINANCIAL_AGENT_MATRIX.find((item) => item.agentId === agentId);
}

export function deriveCapabilityMatrixJson(): {
  readonly schema: 'sunrey.grow.agent-capability-matrix.v1';
  readonly generatedAt: string;
  readonly environment: 'simulation';
  readonly agents: readonly GrowAgentCapabilityMatrixRow[];
} {
  return Object.freeze({
    schema: 'sunrey.grow.agent-capability-matrix.v1',
    generatedAt: new Date().toISOString(),
    environment: 'simulation',
    agents: GROW_FINANCIAL_AGENT_MATRIX,
  });
}

export type GrowBuildStatusRow = {
  readonly subsystem: string;
  readonly status: LifecycleStageStatus;
  readonly note: string;
};

export const GROW_BUILD_STATUS: readonly GrowBuildStatusRow[] = Object.freeze([
  { subsystem: 'Opportunity discovery', status: IMPLEMENTED, note: 'PEG detectors + ranking in packages/platform/src/growth/opportunity' },
  { subsystem: 'Opportunity normalization', status: IMPLEMENTED, note: 'FinancialOpportunity lifecycle model' },
  { subsystem: 'Deterministic analysis', status: IMPLEMENTED, note: 'Money-based calculators; AI explains only' },
  { subsystem: 'Financial proposal generation', status: IMPLEMENTED, note: 'GrowLifecycleService + Consumer BFF' },
  { subsystem: 'Proposal immutability / versioning', status: IMPLEMENTED, note: 'contentHash + supersede on material change' },
  { subsystem: 'Compliance / suitability checkpoint', status: IMPLEMENTED, note: 'Kernel + suitability gates before execution' },
  { subsystem: 'User authorization', status: IMPLEMENTED, note: 'Step-up + approval binds proposal version/hash' },
  { subsystem: 'Agent mandates (recurring)', status: IMPLEMENTED, note: 'Bounded mandates; EACH_OCCURRENCE_REVALIDATED' },
  { subsystem: 'Investment execution (sandbox)', status: SIMULATED, note: 'Kernel-gated InvestmentsService + sandbox provider' },
  { subsystem: 'Investment execution (live)', status: PROVIDER_GATED, note: 'No live broker connected; stops at PROVIDER_REQUIRED' },
  { subsystem: 'Portfolio monitoring', status: PARTIAL, note: 'Drift detection creates opportunities; no auto-trade' },
  { subsystem: 'Outcome attribution', status: IMPLEMENTED, note: 'Projected vs realized separation enforced' },
  { subsystem: 'Audit trail', status: IMPLEMENTED, note: 'Evidence Vault + grow audit event kinds' },
  { subsystem: 'AI credential isolation', status: IMPLEMENTED, note: 'Agent cannot access signing/provider secrets' },
  { subsystem: 'Debt optimization agent', status: NOT_IMPLEMENTED, note: 'Category reserved; detectors incomplete' },
]);
