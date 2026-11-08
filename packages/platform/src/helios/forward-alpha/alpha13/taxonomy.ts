/**
 * HELIOS Forward Alpha — ALPHA13 multi-strategy portfolio forward evidence.
 * Simulation / research qualification only; does not move customer capital.
 */

export const HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_SCHEMA =
  'sunrey.helios.forward_alpha.alpha13.v1' as const;

export const STRATEGY_INTERACTION_KINDS = [
  'OVERLAPPING_POSITION',
  'OFFSETTING_TRADE',
  'DUPLICATE_EXPOSURE',
  'EXECUTION_COMPETITION',
  'RISK_LIMIT_BINDING',
  'CORRELATED_RETURN',
] as const;

export type StrategyInteractionKind = (typeof STRATEGY_INTERACTION_KINDS)[number];

export const ALPHA_BREADTH_CLASSIFICATIONS = [
  'MANY_INDEPENDENT_EDGES',
  'MIXED_INDEPENDENCE',
  'ONE_EDGE_MANY_EXPRESSIONS',
] as const;

export type AlphaBreadthClassification = (typeof ALPHA_BREADTH_CLASSIFICATIONS)[number];

export const HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_QUALIFIED =
  'HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_QUALIFIED' as const;

export const HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_BLOCKED =
  'HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_BLOCKED' as const;

/** Pearson correlation above this (×10_000) treats return series as correlated expressions of one edge. */
export const ALPHA13_HIGH_RETURN_CORRELATION_SCALE = 8_500;

/** Position weight overlap (bps of portfolio) on the same instrument triggers overlap detection. */
export const ALPHA13_POSITION_OVERLAP_NOTIFY_BPS = 500;
