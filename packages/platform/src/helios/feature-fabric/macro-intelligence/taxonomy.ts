/**
 * AAF10 — point-in-time US macro + official release taxonomy.
 */

export const HELIOS_AAF10_MACRO_INTELLIGENCE_SCHEMA = 'sunrey.helios.aaf10.macro-intelligence.v1' as const;

export const AAF10_MACRO_RELEASE_TYPES = [
  'cpi_release',
  'employment_release',
  'gdp_release',
  'central_bank_policy_decision',
  'official_release',
] as const;
export type Aaf10MacroReleaseType = (typeof AAF10_MACRO_RELEASE_TYPES)[number];

export const AAF10_US_MACRO_SERIES = [
  'cpi',
  'unemployment',
  'payroll',
  'gdp',
  'policy_rate',
  'treasury_yield_2y',
  'treasury_yield_10y',
  'inflation_expectations',
] as const;
export type Aaf10UsMacroSeries = (typeof AAF10_US_MACRO_SERIES)[number];

export const AAF10_FEATURE_IDS = [
  'aaf10.inflation_trend',
  'aaf10.unemployment_trend',
  'aaf10.yield_curve_slope',
  'aaf10.real_rate_proxy',
  'aaf10.rate_change_state',
  'aaf10.release_surprise',
  'aaf10.macro_regime_inputs',
] as const;
export type Aaf10FeatureId = (typeof AAF10_FEATURE_IDS)[number];

/** Versioned transformation identifiers — bump when formula semantics change. */
export const AAF10_FORMULA_VERSIONS = Object.freeze({
  inflationTrend: '1.0.0',
  unemploymentTrend: '1.0.0',
  yieldCurveSlope: '1.0.0',
  realRateProxy: '1.0.0',
  rateChangeState: '1.0.0',
  releaseSurprise: '1.0.0',
  macroRegimeInputs: '1.0.0',
});

export const AAF10_ENTITY_US = 'entity.jurisdiction.US' as const;
