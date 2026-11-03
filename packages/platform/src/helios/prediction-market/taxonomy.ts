/**
 * HELIOS Native Prediction Market Engine — taxonomy (NATIVE13).
 * Research and paper simulation only; no live Polymarket trading authority.
 */

export const HELIOS_PREDICTION_MARKET_SCHEMA = 'sunrey.helios.prediction-market.v1' as const;
export const HELIOS_PREDICTION_MARKET_AUTHORITY = 'REFERENCE_AND_PAPER_RESEARCH' as const;

/** Probability prices use 10_000 minor units = 100% (1.00 USD notional per share). */
export const PREDICTION_PROBABILITY_SCALE = 10_000n as const;

export const PREDICTION_INSTRUMENT_KINDS = [
  'prediction_event',
  'prediction_market',
  'outcome_contract',
  'yes_no_contract',
] as const;
export type PredictionInstrumentKind = (typeof PREDICTION_INSTRUMENT_KINDS)[number];

export const PREDICTION_OUTCOME_SIDES = ['YES', 'NO'] as const;
export type PredictionOutcomeSide = (typeof PREDICTION_OUTCOME_SIDES)[number];

export const PREDICTION_MARKET_STATUSES = [
  'ACTIVE',
  'CLOSED',
  'RESOLVED',
  'ARCHIVED',
  'UNKNOWN',
] as const;
export type PredictionMarketStatus = (typeof PREDICTION_MARKET_STATUSES)[number];

export const PREDICTION_RESOLUTION_STATUSES = [
  'UNRESOLVED',
  'RESOLVED_YES',
  'RESOLVED_NO',
  'VOID',
  'DISPUTED',
] as const;
export type PredictionResolutionStatus = (typeof PREDICTION_RESOLUTION_STATUSES)[number];

export const PREDICTION_FEATURE_KEYS = [
  'pm.best_bid',
  'pm.best_ask',
  'pm.mid',
  'pm.spread',
  'pm.spread_bps',
  'pm.bid_depth',
  'pm.ask_depth',
  'pm.book_imbalance',
  'pm.volume_24h',
  'pm.time_to_expiry_hours',
  'pm.yes_implied_prob',
  'pm.no_implied_prob',
  'pm.complement_gap',
] as const;
export type PredictionFeatureKey = (typeof PREDICTION_FEATURE_KEYS)[number];

export const PREDICTION_EXECUTION_TWIN_MODES = ['PAPER_SIMULATION', 'SHADOW_RESEARCH'] as const;
export type PredictionExecutionTwinMode = (typeof PREDICTION_EXECUTION_TWIN_MODES)[number];

export const HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_QUALIFIED =
  'HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_QUALIFIED' as const;
export const HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_BLOCKED =
  'HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_BLOCKED' as const;

export const POLYMARKET_RESEARCH_PROVIDER_ID = 'polymarket-clob-research-sandbox' as const;
