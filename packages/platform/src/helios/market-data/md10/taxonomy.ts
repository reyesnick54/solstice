/**
 * HELIOS MD10 — FX, rates, and commodity reference taxonomy.
 * Reference/research only; not execution quotes or settlement authority.
 */

export const HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA =
  'sunrey.helios.md10.macro-market-reference.v1' as const;

export const HELIOS_MD10_CONSENSUS_SCHEMA = 'sunrey.helios.md10.decentralized-consensus.v1' as const;

export const FX_QUOTE_KINDS = [
  'CONTRIBUTOR_QUOTE',
  'VENUE_QUOTE',
  'REFERENCE_FIXING',
  'AGGREGATED_REFERENCE',
] as const;
export type FxQuoteKind = (typeof FX_QUOTE_KINDS)[number];

/** Lanes — observations consolidate only within the same lane (never a single universal FX book). */
export const FX_CONSOLIDATION_LANES = Object.freeze({
  CONTRIBUTOR_QUOTE: 'dealer_contributor',
  VENUE_QUOTE: 'dealer_venue',
  REFERENCE_FIXING: 'official_fixing',
  AGGREGATED_REFERENCE: 'aggregated_reference',
} as const satisfies Record<FxQuoteKind, string>);

export const RATE_OBSERVATION_KINDS = [
  'yield_curve',
  'policy_rate',
  'overnight_rate',
  'government_yield',
  'swap_reference_rate',
] as const;
export type RateObservationKind = (typeof RATE_OBSERVATION_KINDS)[number];

export const COMMODITY_REFERENCE_KINDS = [
  'spot_reference',
  'futures',
  'official_fixing',
  'physical_benchmark',
] as const;
export type CommodityReferenceKind = (typeof COMMODITY_REFERENCE_KINDS)[number];

export const MD10_CONSENSUS_ESTIMATORS = ['MEDIAN', 'TRIMMED_MEDIAN'] as const;
export type Md10ConsensusEstimator = (typeof MD10_CONSENSUS_ESTIMATORS)[number];

export const MD10_MACRO_DOMAINS = ['fx', 'rates', 'commodity'] as const;
export type Md10MacroDomain = (typeof MD10_MACRO_DOMAINS)[number];
