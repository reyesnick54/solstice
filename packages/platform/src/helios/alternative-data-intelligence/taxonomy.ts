/**
 * HELIOS Alternative Data Intelligence — program taxonomy (ALT04–ALT14).
 * Research evidence only; no live provider access or trading authority.
 */

export const HELIOS_ALTERNATIVE_DATA_PROGRAM = 'HELIOS_ALTERNATIVE_DATA' as const;

export const HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA =
  'sunrey.helios.alternative-data-intelligence.v1' as const;

export const HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED =
  'HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED' as const;

export const HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED =
  'HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED' as const;

export const ALT09_WORK_PACKAGE = 'ALT09' as const;
export const ALT09_MODULE = 'packages/platform/src/helios/alternative-data-intelligence/alt09' as const;

export const HELIOS_ALT12_MULTIMODAL_FUSION_SCHEMA = 'helios.alt12.multimodal_fusion.v1' as const;
export const HELIOS_ALT12_MULTIMODAL_FUSION_AUTHORITY =
  'packages/platform/src/helios/alternative-data-intelligence/alt12' as const;

export const HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED =
  'HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED' as const;
export const HELIOS_ALT12_MULTIMODAL_FUSION_BLOCKED = 'HELIOS_ALT12_MULTIMODAL_FUSION_BLOCKED' as const;

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

/** Alternative-data modality families accepted by the fusion router (ALT12). */
export const ALT_MODALITIES = Object.freeze([
  'workforce',
  'digital_demand',
  'product_demand',
  'logistics',
  'satellite_geospatial',
  'patents',
  'procurement',
  'supply_chain_graph',
  'macro',
  'market',
  'fundamentals',
] as const);
export type AltModalityId = (typeof ALT_MODALITIES)[number];

export const ALT_MISSING_REASONS = Object.freeze([
  'PROVIDER_OUTAGE',
  'NO_COVERAGE',
  'LOW_ACTIVITY',
  'PRIVACY_THRESHOLD',
  'LICENSE_BLOCKED',
  'DELAYED',
  'UNKNOWN',
] as const);
export type AltMissingReason = (typeof ALT_MISSING_REASONS)[number];

export const ALT_BASELINE_FUSION_MODELS = Object.freeze([
  'ROBUST_LINEAR_ENSEMBLE',
  'GRADIENT_BOOSTING',
  'BAYESIAN_MODEL_AVERAGE',
] as const);
export type AltBaselineFusionModel = (typeof ALT_BASELINE_FUSION_MODELS)[number];

export const ALT_ADVANCED_FUSION_MODELS = Object.freeze([
  'CROSS_ATTENTION',
  'MULTI_GRAPH_FUSION',
  'MIXTURE_OF_EXPERTS',
  'MISSING_AWARE_TRANSFORMER',
] as const);
export type AltAdvancedFusionModel = (typeof ALT_ADVANCED_FUSION_MODELS)[number];

export const ALT_FUSION_MODEL_KINDS = Object.freeze([
  ...ALT_BASELINE_FUSION_MODELS,
  ...ALT_ADVANCED_FUSION_MODELS,
] as const);
export type AltFusionModelKind = (typeof ALT_FUSION_MODEL_KINDS)[number];

export const ALT12_FUSION_MODULE =
  'packages/platform/src/helios/alternative-data-intelligence/alt12/index.ts' as const;

export const ALT07_LOGISTICS_FLOW_MODULE =
  'packages/platform/src/helios/alternative-data-intelligence/alt07-logistics-flow/index.ts' as const;
