/**
 * HELIOS Multi-Asset Expansion — shared taxonomies (M04 market state, M09 index strategies).
 *
 * Deterministic classification only. No AI or probabilistic validity checks.
 */

export const TRADABILITY_STATES = [
  'TRADABLE',
  'RESEARCH_ONLY',
  'DATA_STALE',
  'MARKET_CLOSED',
  'INSUFFICIENT_DATA',
  'PROVIDER_DEGRADED',
  'ENTITLEMENT_BLOCKED',
  'EXECUTION_UNAVAILABLE',
  'CONTRACT_EXPIRING',
  'INSTRUMENT_INACTIVE',
] as const;
export type TradabilityState = (typeof TRADABILITY_STATES)[number];

export const MARKET_SESSION_STATES = [
  'OPEN',
  'CLOSED',
  'PRE_MARKET',
  'POST_MARKET',
  'HALTED',
  'UNKNOWN',
] as const;
export type MarketSessionState = (typeof MARKET_SESSION_STATES)[number];

export const MARKET_FRESHNESS_STATES = [
  'FRESH',
  'AGING',
  'STALE',
  'UNKNOWN',
] as const;
export type MarketFreshnessState = (typeof MARKET_FRESHNESS_STATES)[number];

export const MARKET_DATA_QUALITY_STATES = [
  'HEALTHY',
  'DEGRADED',
  'UNUSABLE',
] as const;
export type MarketDataQualityState = (typeof MARKET_DATA_QUALITY_STATES)[number];

export const MARKET_DATA_QUALITY_DIMENSIONS = [
  'freshness',
  'completeness',
  'providerHealth',
  'entitlement',
  'timestampConsistency',
  'spreadSanity',
  'corroboration',
] as const;
export type MarketDataQualityDimension = (typeof MARKET_DATA_QUALITY_DIMENSIONS)[number];

export const MARKET_VOLATILITY_STATES = [
  'LOW',
  'NORMAL',
  'ELEVATED',
  'EXTREME',
  'UNKNOWN',
] as const;
export type MarketVolatilityState = (typeof MARKET_VOLATILITY_STATES)[number];

export const MARKET_LIQUIDITY_STATES = [
  'ADEQUATE',
  'THIN',
  'ILLIQUID',
  'UNKNOWN',
] as const;
export type MarketLiquidityState = (typeof MARKET_LIQUIDITY_STATES)[number];

export const MARKET_ENTITLEMENT_STATES = [
  'USABLE',
  'RESTRICTED',
  'BLOCKED',
  'UNKNOWN',
] as const;
export type MarketEntitlementState = (typeof MARKET_ENTITLEMENT_STATES)[number];

export const MARKET_PROVIDER_HEALTH_STATES = [
  'HEALTHY',
  'DEGRADED',
  'MAINTENANCE',
  'OUTAGE',
  'UNKNOWN',
] as const;
export type MarketProviderHealthState = (typeof MARKET_PROVIDER_HEALTH_STATES)[number];

export const MARKET_EXECUTION_CAPABILITY_STATES = [
  'AVAILABLE',
  'SANDBOX_ONLY',
  'UNAVAILABLE',
  'UNKNOWN',
] as const;
export type MarketExecutionCapabilityState = (typeof MARKET_EXECUTION_CAPABILITY_STATES)[number];

export const MARKET_CONFIDENCE_BANDS = [
  'HIGH',
  'MEDIUM',
  'LOW',
  'NONE',
] as const;
export type MarketConfidenceBand = (typeof MARKET_CONFIDENCE_BANDS)[number];

export const FUTURES_ROLL_STATES = [
  'NOT_APPLICABLE',
  'STABLE',
  'APPROACHING_ROLL',
  'EXPIRING',
  'UNKNOWN',
] as const;
export type FuturesRollState = (typeof FUTURES_ROLL_STATES)[number];

export const BAR_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type BarTimeframe = (typeof BAR_TIMEFRAMES)[number];

export const RESEARCH_CONSUMER_SYSTEMS = [
  'OPPORTUNITY_RESEARCH',
  'STAT_ARB',
  'VOLATILITY',
  'MICROSTRUCTURE',
  'EXECUTION_RESEARCH',
  'STRATEGY_LAB',
] as const;
export type ResearchConsumerSystem = (typeof RESEARCH_CONSUMER_SYSTEMS)[number];

export const TRADABILITY_REASON_CODES = [
  'OK',
  'INSTRUMENT_INACTIVE',
  'INSTRUMENT_RESEARCH_ONLY',
  'ENTITLEMENT_BLOCKED',
  'ENTITLEMENT_RESTRICTED',
  'PROVIDER_OUTAGE',
  'PROVIDER_MAINTENANCE',
  'PROVIDER_DEGRADED',
  'VENUE_CLOSED',
  'VENUE_HALTED',
  'QUOTE_STALE',
  'BAR_STALE',
  'MISSING_REFERENCE_PRICE',
  'MISSING_BID_ASK',
  'MISSING_VOLUME',
  'EXTREME_SPREAD',
  'CONTRADICTORY_SOURCES',
  'EXECUTION_ROUTE_UNAVAILABLE',
  'CONTRACT_EXPIRING',
  'INSUFFICIENT_CORROBORATION',
  'TIMESTAMP_INCONSISTENT',
  'DATA_INCOMPLETE',
] as const;
export type TradabilityReasonCode = (typeof TRADABILITY_REASON_CODES)[number];

export const HELIOS_MULTI_ASSET_BAR_INTERVALS = ['15m'] as const;
export type HeliosMultiAssetBarInterval = (typeof HELIOS_MULTI_ASSET_BAR_INTERVALS)[number];

export const HELIOS_MULTI_ASSET_INDEX_INSTRUMENTS = [
  'SECURITY:US:SPY:ARCX',
  'SECURITY:US:QQQ:XNAS',
] as const;

export type HeliosMultiAssetIndexInstrument = (typeof HELIOS_MULTI_ASSET_INDEX_INSTRUMENTS)[number];

export const HELIOS_M09_STRATEGY_FAMILY = 'sfam_helios_m09_index_mean_reversion' as const;
