/**
 * HELIOS Valuation Intelligence — canonical owner and taxonomy (VAL01–VAL05).
 */

export const HELIOS_VALUATION_INTELLIGENCE_SCHEMA = 'helios.valuation-intelligence.v1' as const;

export const HELIOS_VAL01_CANONICAL_DOMAIN_SCHEMA =
  'sunrey.helios.val01.valuation-intelligence.v1' as const;

export const HELIOS_VALUATION_INTELLIGENCE_AUTHORITY =
  'packages/platform/src/helios/valuation-intelligence' as const;

export const VALUATION_METHODS = [
  'DCF_FCFF',
  'DCF_FCFE',
  'DIVIDEND_DISCOUNT',
  'RESIDUAL_INCOME',
  'REVERSE_DCF',
  'COMPARABLE_MULTIPLES',
  'SUM_OF_PARTS',
] as const;

export type ValuationMethod = (typeof VALUATION_METHODS)[number];

export const VALUATION_SCENARIO_KINDS = ['BASE', 'BULL', 'BEAR', 'STRESS', 'CUSTOM'] as const;
export type ValuationScenarioKind = (typeof VALUATION_SCENARIO_KINDS)[number];

export const VALUATION_ASSUMPTION_VALUE_KINDS = [
  'ratio_decimal',
  'integer_minor',
  'count',
  'duration_years',
  'probability',
  'text_explicit',
] as const;
export type ValuationAssumptionValueKind = (typeof VALUATION_ASSUMPTION_VALUE_KINDS)[number];

export const VALUATION_INPUT_SOURCES = [
  'sec_point_in_time_fundamentals',
  'earn09_probabilistic_earnings_state',
  'aaf_v2_universal_feature_fabric',
  'macro_intelligence_yield_rates',
  'strategy_lab_research',
] as const;
export type ValuationInputSource = (typeof VALUATION_INPUT_SOURCES)[number];

export const HELIOS_VAL01_VALUATION_DOMAIN_QUALIFIED =
  'HELIOS_VAL01_VALUATION_DOMAIN_QUALIFIED' as const;
export const HELIOS_VAL01_VALUATION_DOMAIN_BLOCKED =
  'HELIOS_VAL01_VALUATION_DOMAIN_BLOCKED' as const;

export const VAL05_REVERSE_DCF_MODULE = 'VAL05_REVERSE_DCF' as const;

export const HELIOS_VAL05_REVERSE_DCF_QUALIFIED = 'HELIOS_VAL05_REVERSE_DCF_QUALIFIED' as const;

export const HELIOS_VAL05_REVERSE_DCF_BLOCKED = 'HELIOS_VAL05_REVERSE_DCF_BLOCKED' as const;

/** Explicit horizon for the reverse-DCF explicit period (years). */
export const VAL05_DEFAULT_EXPLICIT_YEARS = 10 as const;

/** Basis points: 10_000 = 100%. */
export const VAL05_BPS_SCALE = 10_000 as const;

export const VAL_WORK_PACKAGES = Object.freeze(['VAL01', 'VAL02', 'VAL03', 'VAL04', 'VAL05'] as const);
export type ValWorkPackageId = (typeof VAL_WORK_PACKAGES)[number];
