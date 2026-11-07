/**
 * HELIOS Alternative Data Intelligence — shared taxonomy.
 * Research-only signals; not canonical economic facts.
 */

export const HELIOS_ALTERNATIVE_DATA_PROGRAM = 'HELIOS_ALTERNATIVE_DATA' as const;
export const HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA = 'helios.alternative-data-intelligence.v1' as const;

export const ALT09_WORK_PACKAGE = 'ALT09' as const;
export const ALT09_MODULE = 'packages/platform/src/helios/alternative-data-intelligence/alt09' as const;

export const HELIOS_ALT12_MULTIMODAL_FUSION_SCHEMA = 'helios.alt12.multimodal_fusion.v1' as const;
export const HELIOS_ALT12_MULTIMODAL_FUSION_AUTHORITY =
  'packages/platform/src/helios/alternative-data-intelligence/alt12' as const;

export const HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED =
  'HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED' as const;
export const HELIOS_ALT12_MULTIMODAL_FUSION_BLOCKED =
  'HELIOS_ALT12_MULTIMODAL_FUSION_BLOCKED' as const;

export const ALT_WORK_PACKAGES = Object.freeze(['ALT04', 'ALT08', 'ALT09', 'ALT12'] as const);
export type AltWorkPackageId = (typeof ALT_WORK_PACKAGES)[number];

/** Alternative-data modality families accepted by the fusion router. */
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

/** Why a modality observation is absent — missingness is information. */
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
