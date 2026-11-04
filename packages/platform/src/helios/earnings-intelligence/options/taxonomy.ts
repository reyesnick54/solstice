/**
 * HELIOS EARN07 — options-implied earnings intelligence taxonomy.
 * Research and expectation modeling only; does not enable options execution.
 */

export const HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA =
  'sunrey.helios.earnings-intelligence.options.v1' as const;

export const HELIOS_EARN07_OPTIONS_INTELLIGENCE_AUTHORITY = 'RESEARCH_REFERENCE_ONLY' as const;

/** Option premiums quoted in minor units per share (10_000 = $1.00). */
export const OPTION_PRICE_MINOR_SCALE = 10_000n as const;

/** Implied volatility and move metrics expressed in basis points (100 bps = 1%). */
export const OPTIONS_IV_BPS_SCALE = 10_000 as const;

export const OPTION_RIGHT_TYPES = ['CALL', 'PUT'] as const;
export type OptionRightType = (typeof OPTION_RIGHT_TYPES)[number];

export const OPTIONS_DATA_QUALITY_STATES = [
  'VALID',
  'DEGRADED_STALE',
  'DEGRADED_INCOMPLETE_CHAIN',
  'DEGRADED_MISSING_GREEKS',
  'UNAVAILABLE',
] as const;
export type OptionsDataQualityState = (typeof OPTIONS_DATA_QUALITY_STATES)[number];

export const OPTIONS_EXECUTION_MODES = ['DISABLED_RESEARCH_ONLY'] as const;
export type OptionsExecutionMode = (typeof OPTIONS_EXECUTION_MODES)[number];

export const OPTIONS_EXECUTION_MODE: OptionsExecutionMode = 'DISABLED_RESEARCH_ONLY';

export const HELIOS_EARN07_OPTIONS_INTELLIGENCE_QUALIFIED =
  'HELIOS_EARN07_OPTIONS_INTELLIGENCE_QUALIFIED' as const;

export const HELIOS_EARN07_OPTIONS_INTELLIGENCE_BLOCKED =
  'HELIOS_EARN07_OPTIONS_INTELLIGENCE_BLOCKED' as const;

export const EARN07_COMPUTED_METRIC_IDS = [
  'ATMStraddleImpliedMove',
  'IVExpectedMove',
  'NearTermIV',
  'PostEventIVProxy',
  'IVTermStructure',
  'IVEventPremium',
  'IVRank',
  'IVPercentile',
  'CallSkew',
  'PutSkew',
  'PutCallVolumeRatio',
  'PutCallOpenInterestRatio',
  'DirectionalCallVolume',
  'DirectionalPutVolume',
  'VolumeToOpenInterest',
  'AbnormalOptionsVolume',
  'CallPutDemandImbalance',
] as const;

export type Earn07ComputedMetricId = (typeof EARN07_COMPUTED_METRIC_IDS)[number];

export const EARN07_REALIZED_METRIC_IDS = [
  'realizedMove',
  'impliedMoveError',
  'volatilityCrush',
  'directionalDemandAccuracy',
] as const;

export type Earn07RealizedMetricId = (typeof EARN07_REALIZED_METRIC_IDS)[number];
