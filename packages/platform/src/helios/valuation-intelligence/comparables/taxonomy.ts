/**
 * VAL08 — dynamic probabilistic comparable company engine taxonomy.
 */

export const VAL08_PROBABILISTIC_COMPARABLES_SCHEMA =
  'helios.valuation-intelligence.val08-probabilistic-comparables.v1' as const;

export const VAL08_PROBABILISTIC_COMPARABLES_MODULE = 'VAL08_PROBABILISTIC_COMPARABLES' as const;

export const HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED =
  'HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED' as const;

export const HELIOS_VAL08_PROBABILISTIC_COMPARABLES_BLOCKED =
  'HELIOS_VAL08_PROBABILISTIC_COMPARABLES_BLOCKED' as const;

export const DEFAULT_VAL08_SEED = 0x08_08_08_08 as const;

export const PEER_SELECTION_METHODS = Object.freeze([
  'FUNDAMENTALS_DISTANCE',
  'SHRINKAGE_MAHALANOBIS',
  'FACTOR_RISK_DISTANCE',
  'CONSTRAINED_NEAREST_NEIGHBORS',
  'DETERMINISTIC_CLUSTERING',
  'BLENDED_PEER_SCORE',
] as const);

export type PeerSelectionMethod = (typeof PEER_SELECTION_METHODS)[number];

export const COMPARABLE_MULTIPLE_KINDS = Object.freeze([
  'PE',
  'FORWARD_PE',
  'PB',
  'PS',
  'EV_SALES',
  'EV_EBITDA',
  'EV_EBIT',
  'EV_FCF',
  'FCF_YIELD',
  'PEG',
  'EV_INVESTED_CAPITAL',
] as const);

export type ComparableMultipleKind = (typeof COMPARABLE_MULTIPLE_KINDS)[number];

export const PEER_SIMILARITY_DIMENSIONS = Object.freeze([
  'sector',
  'industry',
  'subindustry',
  'businessModel',
  'geography',
  'currency',
  'marketCapitalization',
  'revenueScale',
  'revenueGrowth',
  'grossMargin',
  'operatingMargin',
  'ebitdaMargin',
  'fcfMargin',
  'roic',
  'capitalIntensity',
  'leverage',
  'beta',
  'factorExposures',
  'cyclicality',
  'customerConcentration',
  'revenueRecurrence',
  'assetIntensity',
] as const);

export type PeerSimilarityDimension = (typeof PEER_SIMILARITY_DIMENSIONS)[number];

export const PEER_EXCLUSION_REASONS = Object.freeze([
  'NOT_KNOWABLE_AT_VALUATION_TIME',
  'INCOMPATIBLE_ACCOUNTING_REGIME',
  'INCOMPATIBLE_TAX_STRUCTURE',
  'MATERIAL_COUNTRY_RISK_MISMATCH',
  'CURRENCY_NOT_COMPARABLE',
  'MISSING_REQUIRED_FUNDAMENTALS',
  'NEGATIVE_OR_UNDEFINED_DENOMINATOR',
  'USER_CONSTRAINT',
] as const);

export type PeerExclusionReason = (typeof PEER_EXCLUSION_REASONS)[number];

export const DEFAULT_WINSORIZE_FRACTION = 0.05 as const;

export const DEFAULT_MAD_Z_THRESHOLD = 3.5 as const;
