/** Assimilation reference — vendor/assimilation/tradingagents (Apache-2.0 upstream). */

export const TRADING_AGENTS_ASSIMILATION = Object.freeze({
  assimilationPath: 'vendor/assimilation/tradingagents',
  repository: 'TauricResearch/TradingAgents',
  license: 'Apache-2.0',
  referenceSha: 'c4544913a14ed3df5f1ed7b9e8483270ce20682a',
  nativeRuntime: 'typescript-only',
  forbiddenProductionRuntimes: Object.freeze(['langgraph', 'python-graph'] as const),
} as const);

export const TRADING_AGENTS_NATIVE_ROLE_MAP = Object.freeze({
  'tradingagents/agents/analysts/market_analyst.py': 'MARKET_ANALYST',
  'tradingagents/agents/analysts/fundamentals_analyst.py': 'FUNDAMENTAL_ANALYST',
  'tradingagents/agents/analysts/news_analyst.py': 'NEWS_ANALYST',
  'tradingagents/agents/analysts/sentiment_analyst.py': 'SENTIMENT_ANALYST',
  'tradingagents/graph/setup.py#technical_extension': 'TECHNICAL_ANALYST',
  'tradingagents/agents/researchers/bull_researcher.py': 'BULL_RESEARCHER',
  'tradingagents/agents/researchers/bear_researcher.py': 'BEAR_RESEARCHER',
  'tradingagents/agents/trader/trader.py': 'TRADER_RESEARCHER',
  'tradingagents/agents/risk_mgmt/aggressive_debator.py': 'AGGRESSIVE_RISK_ANALYST',
  'tradingagents/agents/risk_mgmt/conservative_debator.py': 'CONSERVATIVE_RISK_ANALYST',
  'tradingagents/agents/risk_mgmt/neutral_debator.py': 'NEUTRAL_RISK_ANALYST',
  'tradingagents/agents/managers/research_manager.py': 'RESEARCH_MANAGER',
  'tradingagents/agents/managers/portfolio_manager.py': 'PORTFOLIO_MANAGER',
  'tradingagents/memory/log.py': 'DECISION_MEMORY',
  'tradingagents/graph/setup.py': 'RESEARCH_STATE_GRAPH',
} as const satisfies Record<string, string>);
