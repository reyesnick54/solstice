/**
 * HELIOS Market Data MD12 — data quality, anomaly, and microstructure taxonomies.
 */

export const HELIOS_MD12_SCHEMA = 'helios.market-data-quality-microstructure.v1' as const;
export const HELIOS_MD12_AUTHORITY = 'MARKET_DATA_OBSERVATION_ONLY' as const;

export const MD12_MARKET_EVENT_KINDS = [
  'QUOTE',
  'TRADE',
  'BOOK_UPDATE',
  'BOOK_SNAPSHOT',
  'CANCEL',
  'HEARTBEAT',
] as const;
export type Md12MarketEventKind = (typeof MD12_MARKET_EVENT_KINDS)[number];

export const MD12_ANOMALY_KINDS = [
  'STALE_QUOTE',
  'CROSSED_BOOK',
  'LOCKED_BOOK',
  'ZERO_SIZE',
  'IMPOSSIBLE_PRICE',
  'PRICE_SPIKE',
  'DUPLICATE_TRADE',
  'TRADE_OUTSIDE_PLAUSIBLE_MARKET',
  'SEQUENCE_DISCONTINUITY',
  'LATENCY_SPIKE',
  'TIMESTAMP_REVERSAL',
  'PROVIDER_DIVERGENCE',
  'VENUE_DIVERGENCE',
] as const;
export type Md12AnomalyKind = (typeof MD12_ANOMALY_KINDS)[number];

export const MD12_ANOMALY_CLASSIFICATIONS = [
  'VALID_MARKET_EVENT',
  'LIKELY_DATA_ERROR',
  'AMBIGUOUS',
  'UNTRUSTED',
] as const;
export type Md12AnomalyClassification = (typeof MD12_ANOMALY_CLASSIFICATIONS)[number];

export const MD12_MICROSTRUCTURE_FEATURES = [
  'spread',
  'relativeSpread',
  'depth',
  'imbalance',
  'microprice',
  'orderFlowImbalance',
  'tradeIntensity',
  'quoteIntensity',
  'cancelIntensity',
  'realizedVolatility',
  'shortHorizonLiquidity',
] as const;
export type Md12MicrostructureFeatureName = (typeof MD12_MICROSTRUCTURE_FEATURES)[number];

export const MD12_QUALITY_BANDS = ['HIGH', 'ADEQUATE', 'DEGRADED', 'UNUSABLE'] as const;
export type Md12QualityBand = (typeof MD12_QUALITY_BANDS)[number];

export const MD12_LIQUIDITY_REGIMES = ['DEEP', 'NORMAL', 'THIN', 'STRESSED', 'UNKNOWN'] as const;
export type Md12LiquidityRegime = (typeof MD12_LIQUIDITY_REGIMES)[number];

/** Default policy thresholds (deterministic; not learned). */
export const MD12_DEFAULT_POLICY = Object.freeze({
  staleQuoteMs: 30_000,
  latencySpikeMs: 5_000,
  priceSpikePpm: 500_000, // 50%
  minResearchCompositePpm: 600_000, // 60%
  maxUntrustedAnomalySharePpm: 100_000, // 10%
  maxLikelyErrorAnomalySharePpm: 200_000, // 20%
  shortHorizonLiquidityDepthLevels: 5,
});
