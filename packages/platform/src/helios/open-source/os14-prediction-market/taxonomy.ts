/**
 * HELIOS Open-Source Integration OS14 — prediction-market microstructure (research only).
 *
 * Paper / simulation / research. Does not grant Execution Authority or live wagering.
 */

export const HELIOS_OS14_PREDICTION_MARKET_SCHEMA = 'sunrey.helios.os14.prediction-market.v1' as const;
export const HELIOS_OS14_PREDICTION_MARKET_AUTHORITY = 'RESEARCH_ONLY' as const;
export const HELIOS_OS14_FEATURE_FABRIC_SCHEMA = 'sunrey.helios.os14.prediction-market.features.v1' as const;

export const PREDICTION_OUTCOME_SIDES = ['YES', 'NO'] as const;
export type PredictionOutcomeSide = (typeof PREDICTION_OUTCOME_SIDES)[number];

export const PREDICTION_MARKET_CATEGORIES = [
  'crypto',
  'economics',
  'politics',
  'sports',
  'science',
  'other',
] as const;
export type PredictionMarketCategory = (typeof PREDICTION_MARKET_CATEGORIES)[number];

export const PREDICTION_MARKET_RESOLUTION_STATES = [
  'OPEN',
  'CLOSED_PENDING_RESOLUTION',
  'RESOLVED',
  'VOID',
  'UNKNOWN',
] as const;
export type PredictionMarketResolutionState = (typeof PREDICTION_MARKET_RESOLUTION_STATES)[number];

export const PREDICTION_OBSERVATION_KINDS = [
  'market_summary',
  'order_book_snapshot',
  'microstructure_features',
  'probability_edge_research',
  'cross_market_link',
] as const;
export type PredictionObservationKind = (typeof PREDICTION_OBSERVATION_KINDS)[number];

export const RESEARCH_SIGNAL_KINDS = ['PROB_EDGE', 'IMBALANCE', 'LIQUIDITY', 'CROSS_OUTCOME'] as const;
export type ResearchSignalKind = (typeof RESEARCH_SIGNAL_KINDS)[number];

export const CROSS_OUTCOME_CONSISTENCY_CODES = [
  'COMPLEMENT_OK',
  'COMPLEMENT_DRIFT',
  'CROSSED_COMPLEMENT',
  'INSUFFICIENT_DEPTH',
] as const;
export type CrossOutcomeConsistencyCode = (typeof CROSS_OUTCOME_CONSISTENCY_CODES)[number];

export const HELIOS_OS14 = 'HELIOS_OS14' as const;
