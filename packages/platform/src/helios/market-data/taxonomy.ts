/**
 * HELIOS Market Data fabric (MD01–MD14) — shared taxonomies.
 * Research / read-only qualification; not regulatory approval.
 */

export const HELIOS_MARKET_DATA_FABRIC_SCHEMA = 'sunrey.helios.market-data-fabric.v1' as const;

export const HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED =
  'HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED' as const;

export const HELIOS_PRODUCTION_MARKET_DATA_V1_BLOCKED =
  'HELIOS_PRODUCTION_MARKET_DATA_V1_BLOCKED' as const;

export const MD_WORK_PACKAGES = Object.freeze([
  'MD01',
  'MD02',
  'MD03',
  'MD04',
  'MD05',
  'MD06',
  'MD07',
  'MD08',
  'MD09',
  'MD10',
  'MD11',
  'MD12',
  'MD13',
  'MD14',
] as const);

export type MdWorkPackageId = (typeof MD_WORK_PACKAGES)[number];

/** Production-shaped provider progression — not regulatory approval. */
export const PRODUCTION_MARKET_DATA_STATUSES = Object.freeze([
  'REGISTERED',
  'SANDBOX_QUALIFIED',
  'READONLY_LIVE_QUALIFIED',
  'PRODUCTION_RESEARCH_QUALIFIED',
] as const);

export type ProductionMarketDataStatus = (typeof PRODUCTION_MARKET_DATA_STATUSES)[number];

/**
 * Observation quality / sync states that block AAF feature certification.
 * Features must not certify from observations in these states.
 */
export const AAF_FEATURE_CERTIFICATION_BLOCK_STATES = Object.freeze([
  'DESYNCHRONIZED',
  'UNTRUSTED',
  'ENTITLEMENT_BLOCKED',
] as const);

export type AafFeatureCertificationBlockState = (typeof AAF_FEATURE_CERTIFICATION_BLOCK_STATES)[number];

export const MD14_ADVERSARIAL_SCENARIO_IDS = Object.freeze([
  'md14_gap_recovery',
  'md14_clock_skew',
  'md14_entitlement_block',
  'md14_redundant_source_divergence',
  'md14_chaos_provider_outage',
  'md14_aaf_block_on_untrusted',
  'md14_execution_twin_no_live_submit',
  'md14_live_shadow_no_execution_authority',
] as const);

export type Md14AdversarialScenarioId = (typeof MD14_ADVERSARIAL_SCENARIO_IDS)[number];
