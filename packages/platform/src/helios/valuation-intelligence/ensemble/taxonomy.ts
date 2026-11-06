/** VAL11 — adaptive multi-model valuation ensemble taxonomy. */

export const VAL11_ENSEMBLE_SCHEMA =
  'sunrey.helios.valuation-intelligence.val11-adaptive-ensemble.v1' as const;

export const VAL11_ENSEMBLE_MODULE =
  'packages/platform/src/helios/valuation-intelligence/ensemble/index.ts' as const;

export const HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_QUALIFIED =
  'HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_QUALIFIED' as const;

export const HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_BLOCKED =
  'HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_BLOCKED' as const;

/** Lane A — price-free intrinsic methods (market price forbidden as input). */
export const INTRINSIC_ENSEMBLE_METHODS = Object.freeze([
  'DCF_FCFF',
  'DCF_FCFE',
  'RESIDUAL_INCOME',
  'ECONOMIC_PROFIT',
  'RESIDUAL_OPERATING_CASH_FLOW',
  'SUM_OF_PARTS',
  'ASSET_NAV',
] as const);

export type IntrinsicEnsembleMethod = (typeof INTRINSIC_ENSEMBLE_METHODS)[number];

/** Lane B — market-referenced methods (may consume price and peer multiples). */
export const MARKET_REFERENCED_ENSEMBLE_METHODS = Object.freeze([
  'COMPARABLE_MULTIPLES',
  'REVERSE_DCF',
  'MARKET_IMPLIED_EXPECTATIONS',
  'RELATIVE_VALUATION',
] as const);

export type MarketReferencedEnsembleMethod = (typeof MARKET_REFERENCED_ENSEMBLE_METHODS)[number];

export const VALUATION_ENSEMBLE_LANES = Object.freeze(['INTRINSIC', 'MARKET_REFERENCED'] as const);
export type ValuationEnsembleLane = (typeof VALUATION_ENSEMBLE_LANES)[number];

/** Inputs that must never appear on Lane A model runs. */
export const FORBIDDEN_INTRINSIC_INPUT_KEYS = Object.freeze([
  'marketPriceMinor',
  'marketPrice',
  'sharePriceMinor',
  'peerMultiple',
  'impliedMultipleFromPrice',
  'trailingPeFromPrice',
] as const);

export type ForbiddenIntrinsicInputKey = (typeof FORBIDDEN_INTRINSIC_INPUT_KEYS)[number];

export const COMPANY_CHARACTERISTIC_TAGS = Object.freeze([
  'BANK',
  'MATURE_DIVIDEND_PAYER',
  'CONGLOMERATE',
  'LOSS_MAKING_HIGH_GROWTH',
  'RESOURCE_ASSET_HEAVY',
  'STANDARD_OPERATING',
] as const);

export type CompanyCharacteristicTag = (typeof COMPANY_CHARACTERISTIC_TAGS)[number];

/** Minimum posterior weight share when multiple applicable intrinsic models exist. */
export const DEFAULT_MIN_INTRINSIC_MODEL_WEIGHT = 0.08 as const;

/** Shrinkage toward applicability prior — higher = less dominance from small samples. */
export const DEFAULT_RELIABILITY_SHRINKAGE = 0.35 as const;

/** Effective sample size below which reliability is heavily discounted. */
export const MIN_RELIABILITY_SAMPLE_FOR_FULL_WEIGHT = 8 as const;
