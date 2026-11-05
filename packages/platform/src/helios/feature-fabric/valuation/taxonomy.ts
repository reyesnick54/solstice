/**
 * VAL01 feature fabric — valuation intelligence feature plane.
 */

export const HELIOS_VALUATION_FEATURE_PLANE_SCHEMA = 'sunrey.helios.val01.valuation-feature-plane.v1' as const;

export const VALUATION_FEATURE_IDS = [
  'val01.intrinsic_equity_value_minor',
  'val01.intrinsic_value_per_share_minor',
  'val01.applicable_method_count',
  'val01.wacc_assumption_decimal',
  'val01.market_implied_growth_decimal',
] as const;

export type ValuationFeatureId = (typeof VALUATION_FEATURE_IDS)[number];

export const VALUATION_FEATURE_FORMULA_VERSION = 'val01-feature-bridge-v1' as const;

export const HELIOS_VAL01_VALUATION_FEATURE_FABRIC_QUALIFIED =
  'HELIOS_VAL01_VALUATION_FEATURE_FABRIC_QUALIFIED' as const;
export const HELIOS_VAL01_VALUATION_FEATURE_FABRIC_BLOCKED =
  'HELIOS_VAL01_VALUATION_FEATURE_FABRIC_BLOCKED' as const;
