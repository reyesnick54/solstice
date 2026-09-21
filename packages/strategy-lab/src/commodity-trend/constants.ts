import { asStrategyCapsuleId, asStrategyFamilyId } from '../capsule/ids.ts';

export const HELIOS_M11_RULE_ID = 'HELIOS_M11_COMMODITY_TREND_FOLLOWING_V1' as const;
export const HELIOS_M11_FAMILY_ID = asStrategyFamilyId('sfam_helios_m11_commodity_trend_following');
export const HELIOS_M11_CAPSULE_ID = asStrategyCapsuleId('scap_helios_m11_commodity_trend_following_v1');
export const HELIOS_M11_RULE_VERSION = 'v1' as const;

export const HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED =
  'HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED' as const;

export const DEFAULT_M11_FAST_MA_PERIODS = 8;
export const DEFAULT_M11_SLOW_MA_PERIODS = 21;
export const DEFAULT_M11_MIN_HISTORY_BARS = 24;
export const DEFAULT_M11_MIN_ROC_BPS = 25;
export const DEFAULT_M11_MAX_SPREAD_BPS = 35;
export const DEFAULT_M11_MIN_LIQUIDITY_SCORE = 40;
export const DEFAULT_M11_MIN_REALIZED_VOLATILITY_BPS = 50;
export const DEFAULT_M11_MAX_REALIZED_VOLATILITY_BPS = 4_000;
export const DEFAULT_M11_MAX_OBSERVATION_AGE_MS = 7_200_000;
export const DEFAULT_M11_MAX_HOLDING_PERIOD_HOURS = 168;
export const DEFAULT_M11_TRAILING_STOP_VOL_MULTIPLIER = 2.5;
export const DEFAULT_M11_MAX_ADVERSE_EXCURSION_BPS = 350;
export const DEFAULT_M11_RECOMMENDED_EXPOSURE_UNITS = '100000000';

export const DEFAULT_M11_CONFIG = Object.freeze({
  fastMaPeriods: DEFAULT_M11_FAST_MA_PERIODS,
  slowMaPeriods: DEFAULT_M11_SLOW_MA_PERIODS,
  minHistoryBars: DEFAULT_M11_MIN_HISTORY_BARS,
  minRocBps: DEFAULT_M11_MIN_ROC_BPS,
  maxSpreadBps: DEFAULT_M11_MAX_SPREAD_BPS,
  minLiquidityScore: DEFAULT_M11_MIN_LIQUIDITY_SCORE,
  minRealizedVolatilityBps: DEFAULT_M11_MIN_REALIZED_VOLATILITY_BPS,
  maxRealizedVolatilityBps: DEFAULT_M11_MAX_REALIZED_VOLATILITY_BPS,
  maxObservationAgeMs: DEFAULT_M11_MAX_OBSERVATION_AGE_MS,
  maxHoldingPeriodHours: DEFAULT_M11_MAX_HOLDING_PERIOD_HOURS,
  trailingStopVolMultiplier: DEFAULT_M11_TRAILING_STOP_VOL_MULTIPLIER,
  maxAdverseExcursionBps: DEFAULT_M11_MAX_ADVERSE_EXCURSION_BPS,
  recommendedExposureUnits: DEFAULT_M11_RECOMMENDED_EXPOSURE_UNITS,
});

export type CommodityTrendFollowingConfig = typeof DEFAULT_M11_CONFIG;
