/**
 * HELIOS ALT13 — alternative-data incremental information, signal decay, and feature discovery.
 */

export const HELIOS_ALT13_SCHEMA = 'sunrey.helios.alternative-data.alt13.v1' as const;
export const HELIOS_ALT13_AUTHORITY = 'RESEARCH_AND_FEATURE_DISCOVERY' as const;

export const HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED =
  'HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED' as const;
export const HELIOS_ALT13_INCREMENTAL_INFORMATION_BLOCKED =
  'HELIOS_ALT13_INCREMENTAL_INFORMATION_BLOCKED' as const;

/** Core HELIOS baselines against which alt-data lift is measured. */
export const ALT13_CORE_BASELINES = [
  'MARKET_ONLY',
  'FUNDAMENTALS_ONLY',
  'EARNINGS_ONLY',
  'VALUATION_ONLY',
  'CORE_HELIOS',
  'CORE_HELIOS_PLUS_ALT_SIGNAL',
] as const;
export type Alt13CoreBaseline = (typeof ALT13_CORE_BASELINES)[number];

/** Primary economically justified forecast targets; stock return is secondary research only. */
export const ALT13_FORECAST_TARGETS = [
  'REVENUE_FORECAST',
  'MARGIN_FORECAST',
  'EARNINGS_SURPRISE',
  'CAPEX_FORECAST',
  'SUPPLY_DISRUPTION',
  'VOLATILITY_RISK',
  'OTHER_ECONOMIC',
  'STOCK_RETURN_SECONDARY',
] as const;
export type Alt13ForecastTarget = (typeof ALT13_FORECAST_TARGETS)[number];

export const ALT13_PRIMARY_FORECAST_TARGETS = ALT13_FORECAST_TARGETS.filter(
  (t) => t !== 'STOCK_RETURN_SECONDARY',
) as readonly Exclude<Alt13ForecastTarget, 'STOCK_RETURN_SECONDARY'>[];

export const ALT13_INCREMENTAL_METRICS = [
  'DELTA_MAE',
  'DELTA_LOG_LOSS',
  'DELTA_BRIER',
  'CONDITIONAL_MUTUAL_INFORMATION',
  'PARTIAL_CORRELATION',
  'ORTHOGONALIZED_RESIDUAL_PREDICTION',
] as const;
export type Alt13IncrementalMetric = (typeof ALT13_INCREMENTAL_METRICS)[number];

/** Latent-demand proxies that often collapse to one shock (redundancy watchlist). */
export const ALT13_DEMAND_PROXY_CHANNELS = [
  'JOB_GROWTH',
  'SEARCH_GROWTH',
  'WEB_TRAFFIC',
  'PRODUCT_DEMAND',
] as const;
export type Alt13DemandProxyChannel = (typeof ALT13_DEMAND_PROXY_CHANNELS)[number];

export const ALT13_MIN_OOS_ROWS = 24 as const;
export const ALT13_REDUNDANCY_CORRELATION_THRESHOLD = 0.85 as const;
export const ALT13_FDR_LEVEL = 0.1 as const;
