import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import type { HeliosResearchDataSnapshot } from '../institutional-research-mesh/data-context.ts';
import type {
  AnalystReportBundle,
  InvestDebateState,
  PortfolioManagerResearchDecision,
  ResearchManagerPlan,
  RiskDebateState,
  TradingAgentsMeshRole,
  TradingAgentsResearchArtifact,
  TraderResearchProposal,
} from './types.ts';
import { roleDisplayLabel } from './conditional-logic.ts';

type RunnerContext = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly informationTime: UtcInstant;
  readonly data: HeliosResearchDataSnapshot;
  readonly analystReports: AnalystReportBundle;
  readonly investmentDebate: InvestDebateState;
  readonly riskDebate: RiskDebateState;
  readonly researchPlan: ResearchManagerPlan | null;
  readonly pastContext: string;
  readonly promptTemplateId: string;
  readonly promptTemplateVersion: string;
};

function artifactId(role: TradingAgentsMeshRole, workOrderId: string): string {
  return `tara_${role.toLowerCase()}_${createHash('sha256').update(`${workOrderId}:${role}`).digest('hex').slice(0, 14)}`;
}

function baseArtifact(
  ctx: RunnerContext,
  role: TradingAgentsMeshRole,
  narrative: string,
  structured: TradingAgentsResearchArtifact['structured'],
): TradingAgentsResearchArtifact {
  return Object.freeze({
    artifactId: artifactId(role, ctx.workOrderId),
    role,
    workOrderId: ctx.workOrderId,
    subjectId: ctx.subjectId,
    promptTemplateId: ctx.promptTemplateId,
    promptTemplateVersion: ctx.promptTemplateVersion,
    narrative,
    structured,
    sourceEvidenceIds: Object.freeze(ctx.data.evidenceBundle.map((row) => row.evidenceId)),
    informationTime: ctx.informationTime,
    grantsFinancialAuthority: false as const,
    issuesOrders: false as const,
  });
}

export function runAnalystRole(
  ctx: RunnerContext,
  role: TradingAgentsMeshRole,
  reportKey: keyof AnalystReportBundle,
): { readonly reportLine: string; readonly artifact: TradingAgentsResearchArtifact } {
  const market = ctx.data.reads.getMarketSnapshot;
  const mandate = ctx.data.reads.getMandate;
  const thesis = `${roleDisplayLabel(role)} review of "${ctx.objective}" using approved HELIOS reads (simulation).`;
  const reportLine = `${thesis} Market snapshot present: ${market ? 'yes' : 'no'}. Mandate bound: ${mandate ? 'yes' : 'no'}.`;
  const artifact = baseArtifact(ctx, role, reportLine, null);
  return Object.freeze({ reportLine, artifact });
}

export function runBullResearcher(ctx: RunnerContext): TradingAgentsResearchArtifact {
  const narrative = `Bull: Constructive case for "${ctx.objective}" with ${ctx.analystReports.marketReport.slice(0, 80)}…`;
  return baseArtifact(ctx, 'BULL_RESEARCHER', narrative, null);
}

export function runBearResearcher(ctx: RunnerContext): TradingAgentsResearchArtifact {
  const narrative = `Bear: Stress-test "${ctx.objective}"; highlight stale evidence and mandate constraints.`;
  return baseArtifact(ctx, 'BEAR_RESEARCHER', narrative, null);
}

export function runResearchManager(ctx: RunnerContext): {
  readonly plan: ResearchManagerPlan;
  readonly artifact: TradingAgentsResearchArtifact;
} {
  const bullWins = ctx.investmentDebate.bullHistory.length >= ctx.investmentDebate.bearHistory.length;
  const plan: ResearchManagerPlan = Object.freeze({
    schema: 'sunrey.trading-agents-research.research-plan.v1',
    recommendation: bullWins ? 'Overweight' : 'Hold',
    rationale: `Synthesis after bull/bear debate (${ctx.investmentDebate.count} turns). Past context: ${ctx.pastContext ? 'present' : 'none'}.`,
    strategicActions: 'Research-only sizing guidance for desk review; no automatic execution.',
    grantsExecutionAuthority: false as const,
    issuesOrders: false as const,
  });
  const artifact = baseArtifact(
    ctx,
    'RESEARCH_MANAGER',
    `Research Manager plan: ${plan.recommendation} — ${plan.rationale}`,
    plan,
  );
  return Object.freeze({ plan, artifact });
}

export function runTraderResearcher(ctx: RunnerContext, plan: ResearchManagerPlan): {
  readonly proposal: TraderResearchProposal;
  readonly artifact: TradingAgentsResearchArtifact;
} {
  const action = plan.recommendation === 'Sell' || plan.recommendation === 'Underweight' ? 'Sell' : plan.recommendation === 'Hold' ? 'Hold' : 'Buy';
  const proposal: TraderResearchProposal = Object.freeze({
    schema: 'sunrey.trading-agents-research.trader-proposal.v1',
    action,
    reasoning: `Trader researcher translates plan "${plan.recommendation}" into a transaction research proposal—not an order.`,
    entryPrice: null,
    stopLoss: null,
    grantsExecutionAuthority: false as const,
    issuesOrders: false as const,
  });
  const artifact = baseArtifact(
    ctx,
    'TRADER_RESEARCHER',
    `${proposal.action} research proposal: ${proposal.reasoning}`,
    proposal,
  );
  return Object.freeze({ proposal, artifact });
}

export function runRiskAnalyst(
  ctx: RunnerContext,
  role: 'AGGRESSIVE_RISK_ANALYST' | 'CONSERVATIVE_RISK_ANALYST' | 'NEUTRAL_RISK_ANALYST',
): TradingAgentsResearchArtifact {
  const tone =
    role === 'AGGRESSIVE_RISK_ANALYST'
      ? 'Aggressive: accept higher tracking error within mandate.'
      : role === 'CONSERVATIVE_RISK_ANALYST'
        ? 'Conservative: prioritize drawdown control and cash buffer.'
        : 'Neutral: balance tail risk with base-case upside.';
  return baseArtifact(ctx, role, `${tone} Objective: ${ctx.objective}`, null);
}

export function runPortfolioManager(
  ctx: RunnerContext,
  proposal: TraderResearchProposal,
): { readonly decision: PortfolioManagerResearchDecision; readonly artifact: TradingAgentsResearchArtifact } {
  const decision: PortfolioManagerResearchDecision = Object.freeze({
    schema: 'sunrey.trading-agents-research.portfolio-decision.v1',
    finalRating: proposal.action === 'Sell' ? 'Underweight' : proposal.action === 'Buy' ? 'Overweight' : 'Hold',
    finalDecision: `Portfolio manager research decision after risk debate (${ctx.riskDebate.count} turns).`,
    riskSummary: ctx.riskDebate.history.slice(-400) || 'Risk debate produced no additional narrative.',
    grantsExecutionAuthority: false as const,
    issuesOrders: false as const,
  });
  const artifact = baseArtifact(
    ctx,
    'PORTFOLIO_MANAGER',
    `${decision.finalRating}: ${decision.finalDecision}`,
    decision,
  );
  return Object.freeze({ decision, artifact });
}
