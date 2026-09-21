/**
 * HELIOS Multi-Asset M13 — canonical market regime dimensions.
 *
 * Dimensions are not mutually exclusive. A MarketRegime artifact may carry
 * multiple simultaneous characteristics (e.g. TRENDING_UP + HIGH_VOLATILITY).
 */

export const MARKET_REGIME_DIMENSIONS = [
  'TRENDING_UP',
  'TRENDING_DOWN',
  'RANGE_BOUND',
  'HIGH_VOLATILITY',
  'NORMAL_VOLATILITY',
  'LOW_VOLATILITY',
  'LIQUIDITY_STRESS',
  'NORMAL_LIQUIDITY',
  'RISK_ON',
  'RISK_OFF',
  'CORRELATION_STRESS',
  'MACRO_EVENT',
  'UNKNOWN',
] as const;

export type MarketRegimeDimension = (typeof MARKET_REGIME_DIMENSIONS)[number];

export const MARKET_REGIME_SCOPES = ['INSTRUMENT', 'ASSET_CLASS', 'PORTFOLIO', 'GLOBAL'] as const;
export type MarketRegimeScope = (typeof MARKET_REGIME_SCOPES)[number];

export const MARKET_REGIME_DATA_QUALITY_STATES = [
  'HEALTHY',
  'DEGRADED',
  'UNUSABLE',
  'INSUFFICIENT',
  'STALE',
] as const;
export type MarketRegimeDataQualityState = (typeof MARKET_REGIME_DATA_QUALITY_STATES)[number];

export const MARKET_REGIME_METHODOLOGY_VERSION = 'helios-m13-regime-v1' as const;

/** Minimum strength (bps 0..10000) before a detected regime affects strategy gating. */
export const MARKET_REGIME_GATING_STRENGTH_BPS = 5000 as const;
