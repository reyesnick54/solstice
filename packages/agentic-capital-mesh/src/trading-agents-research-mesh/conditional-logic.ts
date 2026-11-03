import type { InvestDebateState, RiskDebateState, TradingAgentsMeshRole } from './types.ts';

export type DebateRoute = 'BULL_RESEARCHER' | 'BEAR_RESEARCHER' | 'RESEARCH_MANAGER';
export type RiskRoute =
  | 'AGGRESSIVE_RISK_ANALYST'
  | 'CONSERVATIVE_RISK_ANALYST'
  | 'NEUTRAL_RISK_ANALYST'
  | 'PORTFOLIO_MANAGER';

export function shouldContinueInvestmentDebate(input: {
  readonly state: InvestDebateState;
  readonly maxDebateRounds: number;
}): DebateRoute {
  if (input.state.count >= 2 * input.maxDebateRounds) {
    return 'RESEARCH_MANAGER';
  }
  if (input.state.currentResponse.startsWith('Bull')) {
    return 'BEAR_RESEARCHER';
  }
  return 'BULL_RESEARCHER';
}

export function shouldContinueRiskDebate(input: {
  readonly state: RiskDebateState;
  readonly maxRiskDiscussRounds: number;
}): RiskRoute {
  if (input.state.count >= 3 * input.maxRiskDiscussRounds) {
    return 'PORTFOLIO_MANAGER';
  }
  if (input.state.latestSpeaker.startsWith('Aggressive')) {
    return 'CONSERVATIVE_RISK_ANALYST';
  }
  if (input.state.latestSpeaker.startsWith('Conservative')) {
    return 'NEUTRAL_RISK_ANALYST';
  }
  return 'AGGRESSIVE_RISK_ANALYST';
}

export function roleDisplayLabel(role: TradingAgentsMeshRole): string {
  switch (role) {
    case 'MARKET_ANALYST':
      return 'Market Analyst';
    case 'FUNDAMENTAL_ANALYST':
      return 'Fundamentals Analyst';
    case 'NEWS_ANALYST':
      return 'News Analyst';
    case 'SENTIMENT_ANALYST':
      return 'Sentiment Analyst';
    case 'TECHNICAL_ANALYST':
      return 'Technical Analyst';
    case 'BULL_RESEARCHER':
      return 'Bull Researcher';
    case 'BEAR_RESEARCHER':
      return 'Bear Researcher';
    case 'TRADER_RESEARCHER':
      return 'Trader Researcher';
    case 'AGGRESSIVE_RISK_ANALYST':
      return 'Aggressive Analyst';
    case 'CONSERVATIVE_RISK_ANALYST':
      return 'Conservative Analyst';
    case 'NEUTRAL_RISK_ANALYST':
      return 'Neutral Analyst';
    case 'RESEARCH_MANAGER':
      return 'Research Manager';
    case 'PORTFOLIO_MANAGER':
      return 'Portfolio Manager';
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
