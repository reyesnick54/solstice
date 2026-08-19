/**
 * Chunk 116 — MoonRey canonical source-to-productive taxonomy types.
 *
 * One exhaustive mapping contract:
 * DataSourceCategory → FactType → ProductiveCategory → source unit → ClaimType.
 *
 * A mapping says a fact is semantically capable of supporting a productive
 * claim. It does not mint MoonRey, value output, or connect live providers.
 * Chunk 71 remains the monetary issuance authority.
 */

import type { FactType, UnitCode } from '../../oracle/types.ts';
import type { ClaimType, ProductiveCategory } from '../types.ts';

export const SOURCE_TAXONOMY_SCHEMA_VERSION = 1 as const;
export const SOURCE_TAXONOMY_ID = 'moonrey.source-taxonomy.v1' as const;
export const SOURCE_TAXONOMY_MAPPING_VERSION = 1 as const;
export const PRODUCTION_ACTIVE = false as const;

/**
 * Collection categories for productive-domain sources.
 *
 * Historical names `resources`, `ai_usage`, and `service_delivery` remain
 * valid stored values. They are deterministic aliases and are never
 * rewritten on existing records.
 */
export const DATA_SOURCE_CATEGORIES = [
  'energy',
  'food_agriculture',
  'water',
  'compute',
  'ai_usage',
  'manufacturing',
  'real_estate_use',
  'storage',
  'logistics',
  'bandwidth',
  'resources',
  'service_delivery',
  'reference_price',
  'minerals_resources',
  'ai_compute',
  'infrastructure',
  'goods',
  'services',
  'automated_machine_output',
] as const;
export type DataSourceCategory = (typeof DATA_SOURCE_CATEGORIES)[number];

export const CANONICAL_DATA_SOURCE_CATEGORIES = [
  'energy',
  'food_agriculture',
  'water',
  'minerals_resources',
  'compute',
  'ai_compute',
  'manufacturing',
  'real_estate_use',
  'storage',
  'logistics',
  'bandwidth',
  'infrastructure',
  'goods',
  'services',
  'automated_machine_output',
  'reference_price',
] as const;
export type CanonicalDataSourceCategory = (typeof CANONICAL_DATA_SOURCE_CATEGORIES)[number];

export const LEGACY_DATA_SOURCE_ALIASES = Object.freeze({
  resources: 'minerals_resources',
  ai_usage: 'ai_compute',
  service_delivery: 'services',
} as const satisfies Readonly<Record<string, CanonicalDataSourceCategory>>);
export type LegacyDataSourceAlias = keyof typeof LEGACY_DATA_SOURCE_ALIASES;

export const PRIMARY_FACT_TYPE_BY_CATEGORY: Readonly<Record<DataSourceCategory, FactType>> = Object.freeze({
  energy: 'ENERGY_PRODUCTION',
  food_agriculture: 'FOOD_PRODUCTION',
  water: 'WATER_PRODUCTION',
  compute: 'COMPUTE_USAGE',
  ai_usage: 'AI_INFERENCE_USAGE',
  manufacturing: 'MANUFACTURING_OUTPUT',
  real_estate_use: 'REAL_ESTATE_USAGE',
  storage: 'STORAGE_CAPACITY',
  logistics: 'LOGISTICS_CAPACITY',
  bandwidth: 'BANDWIDTH_USAGE',
  resources: 'RESOURCE_EXTRACTION',
  service_delivery: 'SERVICE_DELIVERY',
  reference_price: 'REFERENCE_PRICE',
  minerals_resources: 'RESOURCE_EXTRACTION',
  ai_compute: 'AI_INFERENCE_USAGE',
  infrastructure: 'INFRASTRUCTURE_CAPACITY',
  goods: 'GOODS_OUTPUT',
  services: 'SERVICE_DELIVERY',
  automated_machine_output: 'AUTOMATED_MACHINE_OUTPUT',
});

export const ECONOMIC_EVENT_CLASSES = [
  'PRODUCTION_OUTPUT',
  'CAPACITY',
  'CONSUMPTION',
  'USAGE',
  'DELIVERY',
  'RESERVE',
  'REFERENCE',
] as const;
export type EconomicEventClass = (typeof ECONOMIC_EVENT_CLASSES)[number];

export const MAPPING_STATUSES = ['DEVELOPMENT', 'SIMULATION', 'PRODUCTION_CANDIDATE', 'SUPERSEDED'] as const;
export type MappingStatus = (typeof MAPPING_STATUSES)[number];

export const OVERLAP_RISK_PRODUCTIVE_CATEGORIES = [
  'MANUFACTURING',
  'GOODS',
  'AUTOMATED_MACHINE_OUTPUT',
  'LOGISTICS_TRANSPORTATION',
] as const;
export type AttributionRiskProductiveCategory = (typeof OVERLAP_RISK_PRODUCTIVE_CATEGORIES)[number];

/**
 * Economic Asset Registry category pointer. Productive names are the
 * Chunk 44 taxonomy mirrored by the asset registry. Reference data uses
 * SHARED_ECONOMIC_REFERENCE. This module does not re-own that registry.
 */
export const ECONOMIC_ASSET_CATEGORY_REFERENCE = 'SHARED_ECONOMIC_REFERENCE' as const;
export type MappingEconomicAssetCategory = ProductiveCategory | typeof ECONOMIC_ASSET_CATEGORY_REFERENCE;

export const ISSUANCE_BOUNDARY = Object.freeze({
  automaticIssuance: false,
  mappingAuthorizesIssuance: false,
  verifiedFactAloneCanMint: false,
  capacityClaimAutomaticallyIssues: false,
  reserveClaimAutomaticallyIssues: false,
  mappingCreatesProductiveContribution: false,
  mappingDeclaresProductiveContribution: false,
  productionActive: false,
} as const);
export type IssuanceBoundary = typeof ISSUANCE_BOUNDARY;

export type SourceProductiveMapping = {
  readonly mappingId: string;
  readonly mappingVersion: typeof SOURCE_TAXONOMY_MAPPING_VERSION;
  readonly schemaVersion: typeof SOURCE_TAXONOMY_SCHEMA_VERSION;
  readonly dataSourceCategory: DataSourceCategory;
  readonly factType: FactType;
  readonly productiveCategory: ProductiveCategory | null;
  readonly economicAssetCategory: MappingEconomicAssetCategory;
  readonly allowedSourceUnits: readonly UnitCode[];
  readonly allowedClaimTypes: readonly ClaimType[];
  readonly economicEventClass: EconomicEventClass;
  readonly requiresProductiveObject: boolean;
  readonly requiresRights: boolean;
  readonly requiresMeasurementPeriod: boolean;
  readonly requiresGeography: boolean;
  readonly requiresVerifiedOracleFact: boolean;
  readonly requiresIndependentSourceQuorum: boolean;
  readonly canCreateProductiveClaim: boolean;
  readonly canBecomeProductiveContribution: boolean;
  readonly requiresAttributionPolicy: boolean;
  readonly automaticIssuance: false;
  readonly mappingAuthorizesIssuance: false;
  readonly verifiedFactAloneCanMint: false;
  readonly capacityClaimAutomaticallyIssues: false;
  readonly reserveClaimAutomaticallyIssues: false;
  readonly mappingCreatesProductiveContribution: false;
  readonly mappingDeclaresProductiveContribution: false;
  readonly status: MappingStatus;
};

export type SourceCategoryResolution = {
  readonly input: DataSourceCategory;
  readonly canonical: CanonicalDataSourceCategory;
  readonly isLegacyAlias: boolean;
  readonly historicalRecordRewritten: false;
};

export type MappingRejectionCode =
  | 'INVALID_FACT_CATEGORY_PAIR'
  | 'INVALID_FACT_CLAIM_PAIR'
  | 'UNKNOWN_SOURCE_CATEGORY'
  | 'UNKNOWN_FACT_TYPE'
  | 'UNKNOWN_PRODUCTIVE_CATEGORY'
  | 'UNKNOWN_CLAIM_TYPE'
  | 'MAPPING_DOES_NOT_MINT'
  | 'MAPPING_DOES_NOT_DECLARE_CONTRIBUTION';

export type MappingRejection = {
  readonly code: MappingRejectionCode;
  readonly detail: string;
};

export type TaxonomyCompletenessReport = {
  readonly productiveCategoryGaps: readonly ProductiveCategory[];
  readonly unmappedActiveSourceCategories: readonly DataSourceCategory[];
  readonly gapCount: number;
  readonly referencePriceCanCreateClaim: false;
  readonly mappingAuthorizesMoonRey: false;
  readonly productionActive: false;
};

export function isDataSourceCategory(value: string): value is DataSourceCategory {
  return (DATA_SOURCE_CATEGORIES as readonly string[]).includes(value);
}

export function isCanonicalDataSourceCategory(value: string): value is CanonicalDataSourceCategory {
  return (CANONICAL_DATA_SOURCE_CATEGORIES as readonly string[]).includes(value);
}

export function isLegacyDataSourceAlias(value: string): value is LegacyDataSourceAlias {
  return Object.hasOwn(LEGACY_DATA_SOURCE_ALIASES, value);
}

export function isEconomicEventClass(value: string): value is EconomicEventClass {
  return (ECONOMIC_EVENT_CLASSES as readonly string[]).includes(value);
}

export function isMappingStatus(value: string): value is MappingStatus {
  return (MAPPING_STATUSES as readonly string[]).includes(value);
}

export function isAttributionRiskCategory(value: string): value is AttributionRiskProductiveCategory {
  return (OVERLAP_RISK_PRODUCTIVE_CATEGORIES as readonly string[]).includes(value);
}

export function resolveSourceCategory(value: DataSourceCategory): SourceCategoryResolution {
  if (isLegacyDataSourceAlias(value)) {
    return Object.freeze({
      input: value,
      canonical: LEGACY_DATA_SOURCE_ALIASES[value],
      isLegacyAlias: true,
      historicalRecordRewritten: false,
    });
  }
  return Object.freeze({
    input: value,
    canonical: value as CanonicalDataSourceCategory,
    isLegacyAlias: false,
    historicalRecordRewritten: false,
  });
}
