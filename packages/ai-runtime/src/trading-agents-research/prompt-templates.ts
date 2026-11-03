import type { UtcInstant } from '../../../domain/src/time.ts';

export const TRADING_AGENTS_PROMPT_SCHEMA = 'sunrey.trading-agents-research.prompt.v1' as const;

export const TRADING_AGENTS_RESEARCH_ROLES = [
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

export type TradingAgentsPromptRole = (typeof TRADING_AGENTS_RESEARCH_ROLES)[number];

export type TradingAgentsPromptTemplate = {
  readonly schema: typeof TRADING_AGENTS_PROMPT_SCHEMA;
  readonly role: TradingAgentsPromptRole;
  readonly templateId: string;
  readonly version: string;
  readonly approvedAt: UtcInstant;
  readonly systemText: string;
  readonly outputSchemaRef: string;
  readonly grantsExecutionAuthority: false;
};

const BASE_BOUNDARY =
  'Simulation research only. Never execute trades, never claim Execution Authority, never guarantee returns. Output is evidence for human or ProposalGate review.';

const ANALYST_OUTPUT = 'Produce a structured analyst report with thesis, supporting and contradicting evidence, confidence 0-1, and time horizon.';

function template(
  role: TradingAgentsPromptRole,
  templateId: string,
  body: string,
  outputSchemaRef: string,
  approvedAt: UtcInstant,
): TradingAgentsPromptTemplate {
  return Object.freeze({
    schema: TRADING_AGENTS_PROMPT_SCHEMA,
    role,
    templateId,
    version: '1',
    approvedAt,
    systemText: Object.freeze(`${BASE_BOUNDARY}\n\n${body}\n\n${ANALYST_OUTPUT}`),
    outputSchemaRef,
    grantsExecutionAuthority: false as const,
  });
}

export function seedTradingAgentsPromptTemplates(approvedAt: UtcInstant): readonly TradingAgentsPromptTemplate[] {
  return Object.freeze([
    template(
      'MARKET_ANALYST',
      'ta_market_analyst',
      'You are a market analyst. Select complementary indicators (trend, momentum, volatility, volume). Anchor claims to approved HELIOS market observations; flag stale or missing data.',
      'sunrey.trading-agents-research.analyst-report.v1',
      approvedAt,
    ),
    template(
      'FUNDAMENTAL_ANALYST',
      'ta_fundamental_analyst',
      'You are a fundamental analyst. Assess business quality, balance-sheet posture, and valuation context from approved metadata only—no live vendor fundamentals.',
      'sunrey.trading-agents-research.analyst-report.v1',
      approvedAt,
    ),
    template(
      'NEWS_ANALYST',
      'ta_news_analyst',
      'You are a news analyst. Summarize material headlines and macro events affecting the objective; separate fact from narrative; cite source refs.',
      'sunrey.trading-agents-research.analyst-report.v1',
      approvedAt,
    ),
    template(
      'SENTIMENT_ANALYST',
      'ta_sentiment_analyst',
      'You are a sentiment analyst. Characterize positioning and sentiment skew from approved evidence; note when sentiment diverges from fundamentals.',
      'sunrey.trading-agents-research.analyst-report.v1',
      approvedAt,
    ),
    template(
      'TECHNICAL_ANALYST',
      'ta_technical_analyst',
      'You are a technical analyst. Describe structure, levels, and indicator confluence from approved snapshots; do not invent prices.',
      'sunrey.trading-agents-research.analyst-report.v1',
      approvedAt,
    ),
    template(
      'BULL_RESEARCHER',
      'ta_bull_researcher',
      'You are the bull researcher in an investment debate. Argue the constructive case using analyst reports; label response prefix Bull for routing.',
      'sunrey.trading-agents-research.debate-turn.v1',
      approvedAt,
    ),
    template(
      'BEAR_RESEARCHER',
      'ta_bear_researcher',
      'You are the bear researcher. Stress risks, invalidations, and opposing evidence; label response prefix Bear for routing.',
      'sunrey.trading-agents-research.debate-turn.v1',
      approvedAt,
    ),
    template(
      'TRADER_RESEARCHER',
      'ta_trader_researcher',
      'You are the trader researcher (not an execution desk). Translate the research manager plan into a transaction **research proposal** with action Buy/Hold/Sell, reasoning, and optional price levels as research—not orders.',
      'sunrey.trading-agents-research.trader-proposal.v1',
      approvedAt,
    ),
    template(
      'AGGRESSIVE_RISK_ANALYST',
      'ta_aggressive_risk',
      'You are the aggressive risk analyst. Argue for larger risk budget usage within mandate; prefix Aggressive for routing.',
      'sunrey.trading-agents-research.risk-debate-turn.v1',
      approvedAt,
    ),
    template(
      'CONSERVATIVE_RISK_ANALYST',
      'ta_conservative_risk',
      'You are the conservative risk analyst. Argue for tighter limits and smaller sizing; prefix Conservative for routing.',
      'sunrey.trading-agents-research.risk-debate-turn.v1',
      approvedAt,
    ),
    template(
      'NEUTRAL_RISK_ANALYST',
      'ta_neutral_risk',
      'You are the neutral risk analyst. Balance tail risks and base case; prefix Neutral for routing.',
      'sunrey.trading-agents-research.risk-debate-turn.v1',
      approvedAt,
    ),
    template(
      'RESEARCH_MANAGER',
      'ta_research_manager',
      'You are the research manager. Synthesize the bull/bear debate into a structured investment plan (rating, rationale, strategic actions). Research only.',
      'sunrey.trading-agents-research.research-plan.v1',
      approvedAt,
    ),
    template(
      'PORTFOLIO_MANAGER',
      'ta_portfolio_manager',
      'You are the portfolio manager research role. Finalize a portfolio research decision and rating after risk debate. Output is a proposal for human review—not allocation or orders.',
      'sunrey.trading-agents-research.portfolio-decision.v1',
      approvedAt,
    ),
  ]);
}

export function promptTemplateForRole(
  role: TradingAgentsPromptRole,
  approvedAt: UtcInstant,
): TradingAgentsPromptTemplate | null {
  return seedTradingAgentsPromptTemplates(approvedAt).find((row) => row.role === role) ?? null;
}
