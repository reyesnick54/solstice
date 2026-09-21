/**
 * HELIOS Multi-Asset M13 — cross-asset regime taxonomy.
 */

export const HELIOS_M13_REGIME_ENGINE_VERSION = 'HELIOS_M13_REGIME_ENGINE_V1' as const;

export const MARKET_REGIMES = [
  'TRENDING_UP',
  'TRENDING_DOWN',
  'MEAN_REVERTING',
  'HIGH_VOL',
  'LOW_VOL',
  'RANGE_BOUND',
  'UNKNOWN',
] as const;

export type MarketRegime = (typeof MARKET_REGIMES)[number];

export const REGIME_CONFIDENCE_BANDS = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as const;
export type RegimeConfidenceBand = (typeof REGIME_CONFIDENCE_BANDS)[number];

export const STRATEGY_FAMILY_IDS = [
  'INDEX_MEAN_REVERSION',
  'CRYPTO_MOMENTUM_BREAKOUT',
  'COMMODITY_TREND',
  'RELATIVE_VALUE_STAT_ARB',
  'AGENTIC_RESEARCH',
] as const;

export type StrategyFamilyId = (typeof STRATEGY_FAMILY_IDS)[number];

export const REGIME_COMPATIBILITY = Object.freeze({
  INDEX_MEAN_REVERSION: Object.freeze(['MEAN_REVERTING', 'LOW_VOL', 'RANGE_BOUND'] as const),
  CRYPTO_MOMENTUM_BREAKOUT: Object.freeze(['TRENDING_UP', 'TRENDING_DOWN', 'HIGH_VOL'] as const),
  COMMODITY_TREND: Object.freeze(['TRENDING_UP', 'TRENDING_DOWN', 'HIGH_VOL'] as const),
  RELATIVE_VALUE_STAT_ARB: Object.freeze(['MEAN_REVERTING', 'RANGE_BOUND', 'LOW_VOL'] as const),
  AGENTIC_RESEARCH: Object.freeze(['UNKNOWN'] as const),
} satisfies Readonly<Record<StrategyFamilyId, readonly MarketRegime[]>>);
