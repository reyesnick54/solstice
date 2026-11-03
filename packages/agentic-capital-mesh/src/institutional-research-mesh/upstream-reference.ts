/**
 * Open-source integration reference — TradingAgents (Apache-2.0).
 * HELIOS remains canonical; this module does not import or embed upstream code.
 *
 * Reference: TauricResearch/TradingAgents @ c4544913a14ed3df5f1ed7b9e8483270ce20682a
 */

export const TRADING_AGENTS_UPSTREAM = Object.freeze({
  repository: 'TauricResearch/TradingAgents',
  license: 'Apache-2.0',
  referenceSha: 'c4544913a14ed3df5f1ed7b9e8483270ce20682a',
  referenceVersionNote: 'v0.7.1 merge baseline used for role-architecture inspection only',
} as const);

/** Maps upstream graph roles to HELIOS institutional research roles (reference-only). */
export const TRADING_AGENTS_ROLE_INSPIRATION = Object.freeze({
  'tradingagents/agents/analysts/fundamentals_analyst.py': 'FUNDAMENTAL_RESEARCH',
  'tradingagents/agents/analysts/market_analyst.py': 'TECHNICAL_RESEARCH',
  'tradingagents/agents/analysts/news_analyst.py': 'NEWS_RESEARCH',
  'tradingagents/agents/analysts/sentiment_analyst.py': 'SENTIMENT_RESEARCH',
  'tradingagents/dataflows/vendors/alpha_vantage/fundamentals.py': 'EARNINGS_RESEARCH',
  'tradingagents/dataflows/vendors/fred.py': 'MACRO_RESEARCH',
  'tradingagents/dataflows/router.py': 'FLOW_RESEARCH',
  'tradingagents/agents/researchers/bull_researcher.py': 'BULL_RESEARCH',
  'tradingagents/agents/researchers/bear_researcher.py': 'BEAR_RESEARCH',
  'tradingagents/agents/risk_mgmt/conservative_debator.py': 'RISK_RESEARCH',
  'tradingagents/agents/risk_mgmt/aggressive_debator.py': 'RISK_RESEARCH',
  'tradingagents/agents/risk_mgmt/neutral_debator.py': 'RISK_RESEARCH',
  'tradingagents/agents/trader/trader.py': 'EXECUTION_RESEARCH',
  'tradingagents/agents/managers/research_manager.py': 'RESEARCH_SYNTHESIS',
  'tradingagents/portfolio.py': 'OPTIONS_RESEARCH',
  'tradingagents/backtest.py': 'TECHNICAL_RESEARCH',
} as const satisfies Record<string, string>);
