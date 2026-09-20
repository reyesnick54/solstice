import { asStrategyCapsuleId, asStrategyFamilyId } from '../capsule/ids.ts';

export const HELIOS_M10_RULE_ID = 'HELIOS_M10_CRYPTO_MOMENTUM_BREAKOUT_V1' as const;
export const HELIOS_M10_FAMILY_ID = asStrategyFamilyId('sfam_helios_m10_crypto_momentum_breakout');
export const HELIOS_M10_CAPSULE_ID = asStrategyCapsuleId('scap_helios_m10_crypto_momentum_breakout_v1');
export const HELIOS_M10_RULE_VERSION = 'v1' as const;

export const HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED =
  'HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED' as const;

export const DEFAULT_M10_LOOKBACK_PERIODS = 24;
export const DEFAULT_M10_BREAKOUT_BUFFER_BPS = 20;
export const DEFAULT_M10_VOLUME_RATIO_THRESHOLD = 1.5;
export const DEFAULT_M10_MAX_SPREAD_BPS = 30;
export const DEFAULT_M10_MIN_REALIZED_VOLATILITY_BPS = 100;
export const DEFAULT_M10_MAX_REALIZED_VOLATILITY_BPS = 5_000;
export const DEFAULT_M10_PERSISTENCE_BARS = 1;
export const DEFAULT_M10_MAX_HOLDING_PERIOD_HOURS = 72;
export const DEFAULT_M10_TRAILING_STOP_VOL_MULTIPLIER = 2;
export const DEFAULT_M10_MAX_OBSERVATION_AGE_MS = 3_600_000;
export const DEFAULT_M10_ENTRY_QUANTITY_UNITS = '100000000';

export const DEFAULT_M10_CONFIG = Object.freeze({
  lookbackPeriods: DEFAULT_M10_LOOKBACK_PERIODS,
  breakoutBufferBps: DEFAULT_M10_BREAKOUT_BUFFER_BPS,
  volumeRatioThreshold: DEFAULT_M10_VOLUME_RATIO_THRESHOLD,
  maxSpreadBps: DEFAULT_M10_MAX_SPREAD_BPS,
  minRealizedVolatilityBps: DEFAULT_M10_MIN_REALIZED_VOLATILITY_BPS,
  maxRealizedVolatilityBps: DEFAULT_M10_MAX_REALIZED_VOLATILITY_BPS,
  persistenceBars: DEFAULT_M10_PERSISTENCE_BARS,
  maxHoldingPeriodHours: DEFAULT_M10_MAX_HOLDING_PERIOD_HOURS,
  trailingStopVolMultiplier: DEFAULT_M10_TRAILING_STOP_VOL_MULTIPLIER,
  maxObservationAgeMs: DEFAULT_M10_MAX_OBSERVATION_AGE_MS,
  quantityUnits: DEFAULT_M10_ENTRY_QUANTITY_UNITS,
});

export type CryptoMomentumBreakoutConfig = typeof DEFAULT_M10_CONFIG;
