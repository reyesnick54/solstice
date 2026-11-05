/**
 * HELIOS Valuation Intelligence VAL03 — dynamic cost of capital taxonomy.
 */

export const HELIOS_VAL03_COST_OF_CAPITAL_SCHEMA =
  'sunrey.helios.valuation-intelligence.val03-cost-of-capital.v1' as const;

export const HELIOS_VAL03_COST_OF_CAPITAL_QUALIFIED =
  'HELIOS_VAL03_COST_OF_CAPITAL_QUALIFIED' as const;

export const HELIOS_VAL03_COST_OF_CAPITAL_BLOCKED =
  'HELIOS_VAL03_COST_OF_CAPITAL_BLOCKED' as const;

/** Basis points where 10_000 = 100% nominal annual rate. */
export const VAL03_RATE_BPS_SCALE = 10_000 as const;

/** Beta scale where 10_000 = unit beta of 1.0. */
export const VAL03_BETA_BPS_SCALE = 10_000 as const;

export const BETA_ESTIMATOR_KINDS = [
  'RAW_REGRESSION',
  'BLUME_ADJUSTED',
  'SECTOR',
  'BOTTOM_UP',
  'SHRINKAGE',
] as const;

export type BetaEstimatorKind = (typeof BETA_ESTIMATOR_KINDS)[number];

export const INFLATION_BASIS_KINDS = ['NOMINAL', 'REAL'] as const;
export type InflationBasisKind = (typeof INFLATION_BASIS_KINDS)[number];

export const CAPITAL_STRUCTURE_BASIS = ['MARKET_VALUE', 'BOOK_LEVERAGE_PROXY'] as const;
export type CapitalStructureBasis = (typeof CAPITAL_STRUCTURE_BASIS)[number];
