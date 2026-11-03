import type { UtcInstant } from '../imports.ts';
import type { EvidenceReference } from '../research-mesh/types.ts';

export type ResearchManagerPlan = {
  readonly schema: 'sunrey.trading-agents-research.research-plan.v1';
  readonly recommendation: string;
  readonly rationale: string;
  readonly strategicActions: string;
  readonly grantsExecutionAuthority: false;
  readonly issuesOrders: false;
};

export type TraderResearchProposal = {
  readonly schema: 'sunrey.trading-agents-research.trader-proposal.v1';
  readonly action: string;
  readonly reasoning: string;
  readonly entryPrice: number | null;
  readonly stopLoss: number | null;
  readonly grantsExecutionAuthority: false;
  readonly issuesOrders: false;
};

export type PortfolioManagerResearchDecision = {
  readonly schema: 'sunrey.trading-agents-research.portfolio-decision.v1';
  readonly finalRating: string;
  readonly finalDecision: string;
  readonly riskSummary: string;
  readonly grantsExecutionAuthority: false;
  readonly issuesOrders: false;
};

export const TRADING_AGENTS_MESH_ROLES = [
  'MARKET_ANALYST',
  'FUNDAMENTAL_ANALYST',
  'NEWS_ANALYST',
  'SENTIMENT_ANALYST',
  'TECHNICAL_ANALYST',
  'BULL_RESEARCHER',
  'BEAR_RESEARCHER',
  'TRADER_RESEARCHER',
  'AGGRESSIVE_RISK_ANALYST',
  'CONSERVATIVE_RISK_ANALYST',
  'NEUTRAL_RISK_ANALYST',
  'RESEARCH_MANAGER',
  'PORTFOLIO_MANAGER',
] as const;

export type TradingAgentsMeshRole = (typeof TRADING_AGENTS_MESH_ROLES)[number];

export const ANALYST_MESH_ROLES = Object.freeze([
  'MARKET_ANALYST',
  'FUNDAMENTAL_ANALYST',
  'NEWS_ANALYST',
  'SENTIMENT_ANALYST',
  'TECHNICAL_ANALYST',
] as const satisfies readonly TradingAgentsMeshRole[]);

export const RESEARCH_STATE_GRAPH_NODES = [
  'START',
  'PARALLEL_ANALYSTS',
  'DECISION_MEMORY',
  'INVESTMENT_DEBATE',
  'RESEARCH_MANAGER',
  'TRADER_RESEARCHER',
  'RISK_DEBATE',
  'PORTFOLIO_MANAGER',
  'END',
] as const;

export type ResearchStateGraphNode = (typeof RESEARCH_STATE_GRAPH_NODES)[number];

export type ResearchStateGraphEdge = {
  readonly from: ResearchStateGraphNode | TradingAgentsMeshRole;
  readonly to: ResearchStateGraphNode | TradingAgentsMeshRole;
  readonly kind: 'SEQUENTIAL' | 'PARALLEL_FAN_OUT' | 'PARALLEL_JOIN' | 'CONDITIONAL';
  readonly label?: string;
};

export type InvestDebateState = {
  readonly bullHistory: string;
  readonly bearHistory: string;
  readonly history: string;
  readonly currentResponse: string;
  readonly count: number;
};

export type RiskDebateState = {
  readonly aggressiveHistory: string;
  readonly conservativeHistory: string;
  readonly neutralHistory: string;
  readonly history: string;
  readonly latestSpeaker: string;
  readonly currentAggressiveResponse: string;
  readonly currentConservativeResponse: string;
  readonly currentNeutralResponse: string;
  readonly count: number;
};

export type AnalystReportBundle = {
  readonly marketReport: string;
  readonly fundamentalReport: string;
  readonly newsReport: string;
  readonly sentimentReport: string;
  readonly technicalReport: string;
};

export type TradingAgentsResearchArtifact = {
  readonly artifactId: string;
  readonly role: TradingAgentsMeshRole;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly promptTemplateId: string;
  readonly promptTemplateVersion: string;
  readonly narrative: string;
  readonly structured:
    | ResearchManagerPlan
    | TraderResearchProposal
    | PortfolioManagerResearchDecision
    | null;
  readonly sourceEvidenceIds: readonly string[];
  readonly informationTime: UtcInstant;
  readonly grantsFinancialAuthority: false;
  readonly issuesOrders: false;
};

export type TradingAgentsResearchRequest = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly contextRef: string;
  readonly evidenceBundle: readonly EvidenceReference[];
  readonly instrumentHints?: readonly string[];
  readonly maxDebateRounds?: number;
  readonly maxRiskDiscussRounds?: number;
};

export type TradingAgentsResearchMeshRun = {
  readonly runId: string;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly analystReports: AnalystReportBundle;
  readonly investmentDebate: InvestDebateState;
  readonly riskDebate: RiskDebateState;
  readonly researchPlan: ResearchManagerPlan | null;
  readonly traderProposal: TraderResearchProposal | null;
  readonly portfolioDecision: PortfolioManagerResearchDecision | null;
  readonly pastContext: string;
  readonly memoryNote: string;
  readonly artifacts: readonly TradingAgentsResearchArtifact[];
  readonly stateGraphTrace: readonly ResearchStateGraphEdge[];
  readonly createdAt: UtcInstant;
  readonly completedAt: UtcInstant;
};

export type TradingAgentsResearchMeshFailure = {
  readonly code: 'VALIDATION_FAILED' | 'SUBJECT_MISMATCH' | 'DATA_ACCESS_REFUSED';
  readonly message: string;
};
