/**
 * HELIOS Multi-Asset M22 — order planning and execution tactic taxonomies.
 */

export const EXECUTION_TACTIC_METHODOLOGY_VERSION = 'helios-execution-tactic-v1' as const;

export const EXECUTION_ORDER_TYPES = [
  'MARKET',
  'LIMIT',
  'STOP',
  'STOP_LIMIT',
] as const;
export type ExecutionOrderType = (typeof EXECUTION_ORDER_TYPES)[number];

export const EXECUTION_TIME_IN_FORCE = ['DAY', 'GTC', 'IOC', 'FOK'] as const;
export type ExecutionTimeInForce = (typeof EXECUTION_TIME_IN_FORCE)[number];

export const EXECUTION_TACTIC_TYPES = [
  'PASSIVE_LIMIT',
  'AGGRESSIVE_LIMIT',
  'MARKET',
  'TWAP_SLICE',
  'VWAP_AWARE',
  'PARTICIPATION_RATE',
  'PARTIAL_FILL_CONTINUATION',
  'CANCEL_REPLACE',
] as const;
export type ExecutionTacticType = (typeof EXECUTION_TACTIC_TYPES)[number];

export const COST_CERTAINTY_LEVELS = ['KNOWN', 'ESTIMATED', 'INSUFFICIENT_DATA'] as const;
export type CostCertaintyLevel = (typeof COST_CERTAINTY_LEVELS)[number];

export const TACTIC_PLANNING_OUTCOMES = [
  'PLANNED',
  'DEGRADED',
  'REFUSED',
] as const;
export type TacticPlanningOutcome = (typeof TACTIC_PLANNING_OUTCOMES)[number];

export const TACTIC_REFUSAL_REASONS = [
  'ENVELOPE_EXPIRED',
  'ENVELOPE_INVALID',
  'STALE_MARKET_DATA',
  'EXECUTION_UNAVAILABLE',
  'PROVIDER_UNSUPPORTED_ORDER_TYPE',
  'PROVIDER_UNSUPPORTED_TIME_IN_FORCE',
  'INSUFFICIENT_LIQUIDITY',
  'MAX_SLIPPAGE_EXCEEDED',
  'CAPITAL_CONSTRAINT',
  'TACTIC_EXPIRED',
  'ZERO_REMAINING_QUANTITY',
  'RESEARCH_RECOMMENDATION_REJECTED',
] as const;
export type TacticRefusalReason = (typeof TACTIC_REFUSAL_REASONS)[number];
