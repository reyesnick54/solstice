/**
 * HELIOS Forward Alpha — ALPHA11 alpha decay, drift, and break detection (simulation only).
 */

export const ALPHA_DECAY_SCHEMA = 'helios.forward-alpha.alpha11.decay.v1' as const;

export const ALPHA_HEALTH_STATES = [
  'HEALTHY',
  'WATCH',
  'DEGRADED',
  'BROKEN',
  'INSUFFICIENT_DATA',
] as const;

export type AlphaHealthState = (typeof ALPHA_HEALTH_STATES)[number];

export const ALPHA_MONITORED_METRICS = [
  'ACTIVE_RETURN_BPS',
  'HIT_RATE_BPS',
  'DRAWDOWN_BPS',
  'EXECUTION_COST_BPS',
  'SLIPPAGE_BPS',
  'SIGNAL_FREQUENCY',
  'FEATURE_DISTRIBUTION_SHIFT',
  'REGIME_MIX_SHIFT',
  'FORECAST_CALIBRATION_BPS',
] as const;

export type AlphaMonitoredMetric = (typeof ALPHA_MONITORED_METRICS)[number];

export const ALPHA_DECAY_ATTRIBUTION_CLASSES = [
  'SIGNAL_DECAY',
  'EXECUTION_DETERIORATION',
  'MARKET_REGIME_SHIFT',
  'DATA_PROVIDER_DEGRADATION',
  'MIXED_OR_UNRESOLVED',
] as const;

export type AlphaDecayAttributionClass = (typeof ALPHA_DECAY_ATTRIBUTION_CLASSES)[number];

export const CHANGE_DETECTOR_KINDS = [
  'EWMA',
  'CUSUM',
  'PAGE_HINKLEY',
  'BAYESIAN_ONLINE',
] as const;

export type ChangeDetectorKind = (typeof CHANGE_DETECTOR_KINDS)[number];

/** Transparent (required) detectors — qualification fails if any is absent. */
export const REQUIRED_CHANGE_DETECTORS = ['EWMA', 'CUSUM', 'PAGE_HINKLEY'] as const;

export type RequiredChangeDetectorKind = (typeof REQUIRED_CHANGE_DETECTORS)[number];

export const ALPHA_DEMOTION_ACTIONS = [
  'NONE',
  'WATCH_ONLY',
  'PAUSE',
  'DEMOTE',
  'RETURN_TO_SHADOW',
] as const;

export type AlphaDemotionAction = (typeof ALPHA_DEMOTION_ACTIONS)[number];

export const HELIOS_ALPHA11_ALPHA_DECAY_QUALIFIED = 'HELIOS_ALPHA11_ALPHA_DECAY_QUALIFIED' as const;

export const HELIOS_ALPHA11_ALPHA_DECAY_BLOCKED = 'HELIOS_ALPHA11_ALPHA_DECAY_BLOCKED' as const;
