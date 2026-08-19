/**
 * Chunk 116/117 — MoonRey source / fact / claim mapping types.
 *
 * Chunk 116 owns the semantic mapping:
 *   DataSourceCategory → FactType → ProductiveCategory → Unit → ClaimType
 * Chunk 117 makes that mapping enforceable. Neither layer mints MoonRey.
 */

import type { FactType, UnitCode } from '../types.ts';
import type { DataSourceCategory } from '../production/types.ts';
import type { ClaimType, ProductiveCategory } from '../../productive/types.ts';

export const SOURCE_TAXONOMY_SCHEMA_VERSION = 1 as const;
export const SOURCE_TAXONOMY_ID = 'moonrey.source-productive-mapping.v1' as const;
export const SOURCE_TAXONOMY_ACTIVE_VERSION = 2 as const;

export const MAPPING_STATUSES = ['ACTIVE', 'RETIRED', 'SUPERSEDED'] as const;
export type MappingStatus = (typeof MAPPING_STATUSES)[number];

export const SOURCE_CLAIM_COMPATIBILITY_CODES = [
  'SOURCE_CATEGORY_UNKNOWN',
  'SOURCE_CATEGORY_RETIRED',
  'FACT_NOT_ALLOWED_FOR_SOURCE',
  'FACT_NOT_ALLOWED_FOR_PRODUCTIVE_CATEGORY',
  'PRODUCTIVE_CATEGORY_UNMAPPED',
  'SOURCE_UNIT_NOT_ALLOWED',
  'CLAIM_TYPE_NOT_ALLOWED',
  'REFERENCE_DATA_CANNOT_CREATE_CLAIM',
  'PRODUCTIVE_OBJECT_REQUIRED',
  'RIGHTS_REQUIRED',
  'MEASUREMENT_PERIOD_REQUIRED',
  'GEOGRAPHY_REQUIRED',
  'VERIFIED_FACT_REQUIRED',
  'QUORUM_REQUIRED',
  'ATTRIBUTION_POLICY_REQUIRED',
  'MAPPING_VERSION_MISMATCH',
  'MAPPING_SUPERSEDED',
] as const;
export type SourceClaimCompatibilityCode = (typeof SOURCE_CLAIM_COMPATIBILITY_CODES)[number];

export type SourceClaimCompatibilityRejection = {
  readonly code: SourceClaimCompatibilityCode;
  readonly detail: string;
};

export type AttributionState =
  | 'NOT_REQUIRED'
  | 'ATTRIBUTION_REVIEW_REQUIRED'
  | 'ATTRIBUTION_POLICY_ATTACHED';

export type SourceProductiveMapping = {
  readonly schemaVersion: typeof SOURCE_TAXONOMY_SCHEMA_VERSION;
  readonly taxonomyId: typeof SOURCE_TAXONOMY_ID;
  readonly mappingId: string;
  readonly mappingVersion: number;
  readonly status: MappingStatus;
  readonly supersededBy: string | null;
  readonly sourceCategory: DataSourceCategory;
  readonly factType: FactType;
  readonly allowedSourceUnits: readonly UnitCode[];
  readonly productiveCategory: ProductiveCategory | null;
  readonly allowedClaimTypes: readonly ClaimType[];
  readonly referenceDataOnly: boolean;
  readonly requiresAttributionPolicy: boolean;
  readonly overlapRisk: boolean;
  readonly requiresProductiveObject: boolean;
  readonly requiresRights: boolean;
  readonly requiresMeasurementPeriod: boolean;
  readonly requiresGeography: boolean;
  readonly requiresVerifiedFact: boolean;
  readonly requiresQuorum: boolean;
};

export type MappingValidationInput = {
  readonly sourceCategory: string;
  readonly factType: string;
  readonly sourceUnit: string;
  readonly productiveCategory?: string | null;
  readonly claimType?: string | null;
  readonly mappingId?: string | null;
  readonly mappingVersion?: number | null;
};

export type CompatibleMapping = {
  readonly status: 'COMPATIBLE';
  readonly mapping: SourceProductiveMapping;
  readonly attributionState: AttributionState;
};

export type SourceCategoryStatus = 'ACTIVE' | 'RETIRED';

export type SourceTaxonomyRegistry = {
  readonly taxonomyId: typeof SOURCE_TAXONOMY_ID;
  readonly schemaVersion: typeof SOURCE_TAXONOMY_SCHEMA_VERSION;
  readonly mappings: readonly SourceProductiveMapping[];
  readonly sourceCategoryStatus: Readonly<Record<DataSourceCategory, SourceCategoryStatus>>;
};

export function mappingRejection(
  code: SourceClaimCompatibilityCode,
  detail: string,
): SourceClaimCompatibilityRejection {
  return Object.freeze({ code, detail });
}

export function verifiedFactAloneCanMint(): false {
  return false;
}

export function claimCandidateAloneCanMint(): false {
  return false;
}

export function attributionPolicyComplete(): false {
  return false;
}

export function productionActive(): false {
  return false;
}
