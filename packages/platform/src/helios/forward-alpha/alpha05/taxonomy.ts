/**
 * HELIOS Forward Alpha — ALPHA05 benchmark and attribution (taxonomy).
 * Research / forward evaluation only. Does not grant execution authority.
 */

export const HELIOS_ALPHA05_SCHEMA = 'sunrey.helios.forward-alpha.alpha05.v1' as const;

export const HELIOS_ALPHA05_AUTHORITY = 'packages/platform/src/helios/forward-alpha/alpha05' as const;

export const FORWARD_BENCHMARK_KINDS = [
  'CASH',
  'BUY_AND_HOLD',
  'MARKET_INDEX',
  'SECTOR_INDEX',
  'ASSET_CLASS',
  'EQUAL_WEIGHT',
  'RISK_MATCHED',
  'STRATEGY_FAMILY_BASELINE',
  'NAIVE_SIGNAL',
  'INCUMBENT_CHAMPION',
] as const;

export type ForwardBenchmarkKind = (typeof FORWARD_BENCHMARK_KINDS)[number];

export const ALPHA_DECOMPOSITION_BUCKETS = [
  'ASSET_SELECTION',
  'MARKET_BETA',
  'FACTOR_EXPOSURE',
  'TIMING',
  'POSITION_SIZING',
  'EXECUTION',
  'CASH',
  'FEES',
] as const;

export type AlphaDecompositionBucket = (typeof ALPHA_DECOMPOSITION_BUCKETS)[number];

/** Buckets that must never be credited as HELIOS skill alpha. */
export const NON_ALPHA_DECOMPOSITION_BUCKETS = [
  'MARKET_BETA',
  'FACTOR_EXPOSURE',
  'POSITION_SIZING',
  'CASH',
  'FEES',
] as const;

export type NonAlphaDecompositionBucket = (typeof NON_ALPHA_DECOMPOSITION_BUCKETS)[number];

/** Skill attribution — selection and timing only; beta, factor, and leverage exposure are excluded. */
export const SKILL_ALPHA_BUCKETS = ['ASSET_SELECTION', 'TIMING'] as const;

export type SkillAlphaBucket = (typeof SKILL_ALPHA_BUCKETS)[number];

export const HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_QUALIFIED =
  'HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_QUALIFIED' as const;

export const HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_BLOCKED =
  'HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_BLOCKED' as const;

export type Alpha05QualificationMarker =
  | typeof HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_QUALIFIED
  | typeof HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_BLOCKED;

export const ALPHA05_RULE_FLAGS = Object.freeze({
  BENCHMARK_MUST_BE_FROZEN_BEFORE_CAMPAIGN: true,
  POST_HOC_BENCHMARK_SELECTION_FORBIDDEN: true,
  MARKET_BETA_IS_NOT_ALPHA: true,
  SECTOR_CONCENTRATION_IS_NOT_ALPHA: true,
  CRYPTO_BETA_IS_NOT_ALPHA: true,
  LEVERAGE_IS_NOT_ALPHA: true,
  GRANTS_EXECUTION_AUTHORITY: false,
});
