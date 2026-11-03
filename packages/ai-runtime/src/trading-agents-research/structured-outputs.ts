import { err, ok, type Result } from '../../../domain/src/result.ts';

export const PORTFOLIO_RESEARCH_RATINGS = [
  'Buy',
  'Overweight',
  'Hold',
  'Underweight',
  'Sell',
] as const;

export type PortfolioResearchRating = (typeof PORTFOLIO_RESEARCH_RATINGS)[number];

export const TRADER_RESEARCH_ACTIONS = ['Buy', 'Hold', 'Sell'] as const;
export type TraderResearchAction = (typeof TRADER_RESEARCH_ACTIONS)[number];

export type ResearchManagerPlan = {
  readonly schema: 'sunrey.trading-agents-research.research-plan.v1';
  readonly recommendation: PortfolioResearchRating;
  readonly rationale: string;
  readonly strategicActions: string;
  readonly grantsExecutionAuthority: false;
  readonly issuesOrders: false;
};

export type TraderResearchProposal = {
  readonly schema: 'sunrey.trading-agents-research.trader-proposal.v1';
  readonly action: TraderResearchAction;
  readonly reasoning: string;
  readonly entryPrice: number | null;
  readonly stopLoss: number | null;
  readonly grantsExecutionAuthority: false;
  readonly issuesOrders: false;
};

export type PortfolioManagerResearchDecision = {
  readonly schema: 'sunrey.trading-agents-research.portfolio-decision.v1';
  readonly finalRating: PortfolioResearchRating;
  readonly finalDecision: string;
  readonly riskSummary: string;
  readonly grantsExecutionAuthority: false;
  readonly issuesOrders: false;
};

export type AnalystResearchReport = {
  readonly schema: 'sunrey.trading-agents-research.analyst-report.v1';
  readonly role: string;
  readonly thesis: string;
  readonly supportingEvidence: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly confidence: number;
  readonly timeHorizon: string;
  readonly grantsExecutionAuthority: false;
};

export type StructuredOutputFailure = {
  readonly code: 'SCHEMA_MISMATCH' | 'EXECUTION_AUTHORITY_FORBIDDEN' | 'ORDER_PATH_FORBIDDEN';
  readonly detail: string;
};

function forbidExecution(record: Record<string, unknown>): Result<true, StructuredOutputFailure> {
  if (record.grantsExecutionAuthority === true || record.issuesOrders === true) {
    return err({ code: 'EXECUTION_AUTHORITY_FORBIDDEN', detail: 'research structured output cannot execute' });
  }
  if (record.executes === true || record.submitOrder === true) {
    return err({ code: 'ORDER_PATH_FORBIDDEN', detail: 'order fields forbidden on research output' });
  }
  return ok(true);
}

export function validateResearchManagerPlan(value: unknown): Result<ResearchManagerPlan, StructuredOutputFailure> {
  if (!value || typeof value !== 'object') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'research plan must be an object' });
  }
  const record = value as Record<string, unknown>;
  const guard = forbidExecution(record);
  if (!guard.ok) return guard;
  if (record.schema !== 'sunrey.trading-agents-research.research-plan.v1') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'unexpected research plan schema' });
  }
  if (!PORTFOLIO_RESEARCH_RATINGS.includes(record.recommendation as PortfolioResearchRating)) {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'invalid recommendation rating' });
  }
  if (typeof record.rationale !== 'string' || typeof record.strategicActions !== 'string') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'rationale and strategicActions required' });
  }
  return ok(
    Object.freeze({
      schema: 'sunrey.trading-agents-research.research-plan.v1',
      recommendation: record.recommendation as PortfolioResearchRating,
      rationale: record.rationale,
      strategicActions: record.strategicActions,
      grantsExecutionAuthority: false as const,
      issuesOrders: false as const,
    }),
  );
}

export function validateTraderResearchProposal(
  value: unknown,
): Result<TraderResearchProposal, StructuredOutputFailure> {
  if (!value || typeof value !== 'object') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'trader proposal must be an object' });
  }
  const record = value as Record<string, unknown>;
  const guard = forbidExecution(record);
  if (!guard.ok) return guard;
  if (record.schema !== 'sunrey.trading-agents-research.trader-proposal.v1') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'unexpected trader proposal schema' });
  }
  if (!TRADER_RESEARCH_ACTIONS.includes(record.action as TraderResearchAction)) {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'invalid trader research action' });
  }
  if (typeof record.reasoning !== 'string') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'reasoning required' });
  }
  const entryPrice = record.entryPrice === null || record.entryPrice === undefined ? null : Number(record.entryPrice);
  const stopLoss = record.stopLoss === null || record.stopLoss === undefined ? null : Number(record.stopLoss);
  if (entryPrice !== null && Number.isNaN(entryPrice)) {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'entryPrice must be numeric or null' });
  }
  if (stopLoss !== null && Number.isNaN(stopLoss)) {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'stopLoss must be numeric or null' });
  }
  return ok(
    Object.freeze({
      schema: 'sunrey.trading-agents-research.trader-proposal.v1',
      action: record.action as TraderResearchAction,
      reasoning: record.reasoning,
      entryPrice,
      stopLoss,
      grantsExecutionAuthority: false as const,
      issuesOrders: false as const,
    }),
  );
}

export function validatePortfolioManagerResearchDecision(
  value: unknown,
): Result<PortfolioManagerResearchDecision, StructuredOutputFailure> {
  if (!value || typeof value !== 'object') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'portfolio decision must be an object' });
  }
  const record = value as Record<string, unknown>;
  const guard = forbidExecution(record);
  if (!guard.ok) return guard;
  if (record.schema !== 'sunrey.trading-agents-research.portfolio-decision.v1') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'unexpected portfolio decision schema' });
  }
  if (!PORTFOLIO_RESEARCH_RATINGS.includes(record.finalRating as PortfolioResearchRating)) {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'invalid final rating' });
  }
  if (typeof record.finalDecision !== 'string' || typeof record.riskSummary !== 'string') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'finalDecision and riskSummary required' });
  }
  return ok(
    Object.freeze({
      schema: 'sunrey.trading-agents-research.portfolio-decision.v1',
      finalRating: record.finalRating as PortfolioResearchRating,
      finalDecision: record.finalDecision,
      riskSummary: record.riskSummary,
      grantsExecutionAuthority: false as const,
      issuesOrders: false as const,
    }),
  );
}

export function validateAnalystResearchReport(value: unknown): Result<AnalystResearchReport, StructuredOutputFailure> {
  if (!value || typeof value !== 'object') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'analyst report must be an object' });
  }
  const record = value as Record<string, unknown>;
  const guard = forbidExecution(record);
  if (!guard.ok) return guard;
  if (record.schema !== 'sunrey.trading-agents-research.analyst-report.v1') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'unexpected analyst report schema' });
  }
  if (typeof record.thesis !== 'string' || typeof record.role !== 'string') {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'thesis and role required' });
  }
  const confidence = Number(record.confidence);
  if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    return err({ code: 'SCHEMA_MISMATCH', detail: 'confidence must be 0-1' });
  }
  return ok(
    Object.freeze({
      schema: 'sunrey.trading-agents-research.analyst-report.v1',
      role: record.role,
      thesis: record.thesis,
      supportingEvidence: Object.freeze(Array.isArray(record.supportingEvidence) ? record.supportingEvidence.map(String) : []),
      contradictingEvidence: Object.freeze(
        Array.isArray(record.contradictingEvidence) ? record.contradictingEvidence.map(String) : [],
      ),
      confidence,
      timeHorizon: typeof record.timeHorizon === 'string' ? record.timeHorizon : 'UNKNOWN',
      grantsExecutionAuthority: false as const,
    }),
  );
}
