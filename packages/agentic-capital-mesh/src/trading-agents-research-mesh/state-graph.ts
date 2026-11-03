import type { ResearchStateGraphEdge } from './types.ts';

export const CANONICAL_TRADING_AGENTS_STATE_GRAPH: readonly ResearchStateGraphEdge[] = Object.freeze([
  Object.freeze({ from: 'START', to: 'PARALLEL_ANALYSTS', kind: 'PARALLEL_FAN_OUT' }),
  Object.freeze({ from: 'START', to: 'DECISION_MEMORY', kind: 'PARALLEL_FAN_OUT' }),
  Object.freeze({ from: 'PARALLEL_ANALYSTS', to: 'INVESTMENT_DEBATE', kind: 'PARALLEL_JOIN' }),
  Object.freeze({ from: 'DECISION_MEMORY', to: 'INVESTMENT_DEBATE', kind: 'PARALLEL_JOIN' }),
  Object.freeze({ from: 'BULL_RESEARCHER', to: 'BEAR_RESEARCHER', kind: 'CONDITIONAL', label: 'debate_continue' }),
  Object.freeze({ from: 'BEAR_RESEARCHER', to: 'BULL_RESEARCHER', kind: 'CONDITIONAL', label: 'debate_continue' }),
  Object.freeze({ from: 'INVESTMENT_DEBATE', to: 'RESEARCH_MANAGER', kind: 'CONDITIONAL', label: 'debate_complete' }),
  Object.freeze({ from: 'RESEARCH_MANAGER', to: 'TRADER_RESEARCHER', kind: 'SEQUENTIAL' }),
  Object.freeze({ from: 'TRADER_RESEARCHER', to: 'RISK_DEBATE', kind: 'SEQUENTIAL' }),
  Object.freeze({ from: 'AGGRESSIVE_RISK_ANALYST', to: 'CONSERVATIVE_RISK_ANALYST', kind: 'CONDITIONAL', label: 'risk_continue' }),
  Object.freeze({ from: 'CONSERVATIVE_RISK_ANALYST', to: 'NEUTRAL_RISK_ANALYST', kind: 'CONDITIONAL', label: 'risk_continue' }),
  Object.freeze({ from: 'RISK_DEBATE', to: 'PORTFOLIO_MANAGER', kind: 'CONDITIONAL', label: 'risk_complete' }),
  Object.freeze({ from: 'PORTFOLIO_MANAGER', to: 'END', kind: 'SEQUENTIAL' }),
]);
