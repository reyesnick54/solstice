/**
 * HELIOS ALT14 — alternative-data intelligence program taxonomy.
 * Research evidence only; no live provider access or trading authority.
 */

export const HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA =
  'sunrey.helios.alternative-data-intelligence.v1' as const;

export const HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED =
  'HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED' as const;

export const HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED =
  'HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED' as const;

export const ALT_WORK_PACKAGES = Object.freeze([
  'ALT01',
  'ALT02',
  'ALT03',
  'ALT04',
  'ALT05',
  'ALT06',
  'ALT07',
  'ALT08',
  'ALT09',
  'ALT10',
  'ALT11',
  'ALT12',
  'ALT13',
  'ALT14',
] as const);

export type AltWorkPackageId = (typeof ALT_WORK_PACKAGES)[number];

/** Skeptic must interrogate every vector before synthesis certifies AAF features. */
export const SKEPTIC_ALT_ATTACK_VECTORS = Object.freeze([
  'entity_mismatch',
  'selection_bias',
  'coverage_bias',
  'provider_revision',
  'staleness',
  'licensing',
  'duplicate_observations',
  'proxy_instability',
  'regime_shift',
  'missing_modalities',
  'spurious_correlation',
] as const);

export type AlternativeDataSkepticAttackVector = (typeof SKEPTIC_ALT_ATTACK_VECTORS)[number];

/** AAF-certified Strategy Genome feature ids — raw provider rows never enter the genome. */
export const AAF_CERTIFIED_ALT_FEATURE_IDS = Object.freeze([
  'workforce_expansion_state',
  'digital_demand_acceleration',
  'pricing_power_state',
  'port_congestion_exposure',
  'physical_activity_change',
  'innovation_momentum',
  'procurement_demand_state',
  'supply_chain_risk_state',
] as const);

export type AafCertifiedAltFeatureId = (typeof AAF_CERTIFIED_ALT_FEATURE_IDS)[number];

export const ALT14_ADVERSARIAL_SCENARIO_IDS = Object.freeze([
  'wrong_company_mapping',
  'job_posting_duplicates',
  'small_employer_omission',
  'search_series_revision',
  'satellite_cloud_obscuration',
  'night_lights_infrastructure_bias',
  'ais_cargo_unknown',
  'contract_ceiling_vs_obligation',
  'patent_without_commercialization',
  'weak_supply_chain_edge',
  'modality_dropout',
  'holdout_incremental_reject',
  'multiple_testing_screen',
  'provider_entitlement_revoked',
] as const);

export type Alt14AdversarialScenarioId = (typeof ALT14_ADVERSARIAL_SCENARIO_IDS)[number];
