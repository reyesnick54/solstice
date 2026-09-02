/**
 * Wave 5 — Canonical productive asset identity types.
 *
 * Extends productive / economy-data owners. Observations resolve to durable
 * productive assets; provider record ids alone are never canonical identity.
 */

import type { ProductiveCategory } from '../types.ts';
import type { ProductiveEconomyCategory } from '../economy-data/types.ts';

export const PRODUCTIVE_ASSET_IDENTITY_SCHEMA = 'sunrey.productive.asset-identity.v1' as const;

export const PRODUCTIVE_ASSET_CLASSES = [
  'POWER_PLANT',
  'GENERATION_UNIT',
  'FACTORY',
  'PRODUCTION_LINE',
  'DATA_CENTER',
  'COMPUTE_CLUSTER',
  'ACCELERATOR_POOL',
  'FARM',
  'FIELD',
  'LOGISTICS_FACILITY',
  'WAREHOUSE',
  'WATER_ASSET',
  'MINE',
  'REFINERY',
  'BANDWIDTH_FACILITY',
  'REAL_ESTATE_FACILITY',
  'PRODUCTIVE_ASSET',
] as const;
export type ProductiveAssetClass = (typeof PRODUCTIVE_ASSET_CLASSES)[number];

export const PRODUCTIVE_ASSET_LIFECYCLES = [
  'PLANNED',
  'ACTIVE',
  'DEGRADED',
  'SUSPENDED',
  'RETIRED',
  'UNKNOWN',
] as const;
export type ProductiveAssetLifecycle = (typeof PRODUCTIVE_ASSET_LIFECYCLES)[number];

export const PARTY_ROLES = ['OWNER', 'OPERATOR', 'CONTROLLER', 'DATA_PROVIDER'] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];

export const ASSET_VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'PARTIALLY_VERIFIED',
  'VERIFIED',
  'DISPUTED',
] as const;
export type AssetVerificationStatus = (typeof ASSET_VERIFICATION_STATUSES)[number];

export const IDENTITY_CONFIDENCE_LEVELS = [
  'EXACT',
  'PROBABLE',
  'POSSIBLE',
  'CONFLICT',
  'NO_MATCH',
] as const;
export type IdentityConfidence = (typeof IDENTITY_CONFIDENCE_LEVELS)[number];

export const EXTERNAL_IDENTIFIER_KINDS = [
  'OFFICIAL_FACILITY_ID',
  'OPERATOR_ASSET_ID',
  'GOVERNMENT_REGISTRY_ID',
  'ENTERPRISE_ID',
  'PROVIDER_RECORD_ID',
  'COORDINATES_COMMITMENT',
  'SATELLITE_GEOMETRY_COMMITMENT',
  'DISPLAY_NAME_COMMITMENT',
] as const;
export type ExternalIdentifierKind = (typeof EXTERNAL_IDENTIFIER_KINDS)[number];

export const PRODUCTIVE_ALIAS_KINDS = [
  'EIA_PLANT_ID',
  'OPERATOR_ASSET_ID',
  'GOVERNMENT_REGISTRY_ID',
  'ENTERPRISE_ID',
  'PROVIDER_RECORD_ID',
  'SATELLITE_GEOMETRY',
  'COORDINATES',
  'DISPLAY_NAME',
  'RESOURCE_ID',
] as const;
export type ProductiveAliasKind = (typeof PRODUCTIVE_ALIAS_KINDS)[number];

export const ROLLUP_BEHAVIORS = ['INDEPENDENT', 'ROLLS_UP_TO_PARENT', 'AGGREGATES_CHILDREN'] as const;
export type RollupBehavior = (typeof ROLLUP_BEHAVIORS)[number];

export type ProductiveAssetId = string & { readonly __brand: 'ProductiveAssetId' };
export type ProductiveAssetFingerprint = string & { readonly __brand: 'ProductiveAssetFingerprint' };
export type ProductiveAssetAliasId = string & { readonly __brand: 'ProductiveAssetAliasId' };

export type PartyReference = {
  readonly role: PartyRole;
  readonly partyRef: string;
  readonly sourceSystem: string;
  readonly authorized: boolean;
};

export type GeographicReference = {
  readonly jurisdiction: string;
  readonly region: string | null;
  readonly locality: string | null;
  readonly coordinatesCommitment: string | null;
  readonly precision: 'JURISDICTION' | 'REGION' | 'LOCALITY' | 'COORDINATES' | 'REDACTED';
};

export type ExternalIdentifier = {
  readonly kind: ExternalIdentifierKind;
  readonly valueCommitment: string;
  readonly sourceSystem: string;
  readonly providerId: string | null;
};

export type ProductiveAssetAlias = {
  readonly aliasId: ProductiveAssetAliasId;
  readonly aliasKind: ProductiveAliasKind;
  readonly aliasValueCommitment: string;
  readonly sourceSystem: string;
  readonly providerId: string | null;
  readonly productiveAssetId: ProductiveAssetId;
  readonly registeredAtUtc: string;
};

export type CanonicalProductiveAsset = {
  readonly schemaVersion: typeof PRODUCTIVE_ASSET_IDENTITY_SCHEMA;
  readonly productiveAssetId: ProductiveAssetId;
  readonly assetClass: ProductiveAssetClass;
  readonly productiveCategory: ProductiveCategory;
  readonly economyCategory: ProductiveEconomyCategory | null;
  readonly displayNameCommitment: string | null;
  readonly parties: readonly PartyReference[];
  readonly geography: GeographicReference;
  readonly jurisdiction: string;
  readonly commissionedAtUtc: string | null;
  readonly retiredAtUtc: string | null;
  readonly lifecycle: ProductiveAssetLifecycle;
  readonly capacityMetadata: Readonly<Record<string, string>>;
  readonly technologyMetadata: Readonly<Record<string, string>>;
  readonly externalIdentifiers: readonly ExternalIdentifier[];
  readonly verificationStatus: AssetVerificationStatus;
  readonly sourceReferences: readonly string[];
  readonly rightsReferences: readonly string[];
  readonly parentAssetId: ProductiveAssetId | null;
  readonly rollupBehavior: RollupBehavior;
  readonly fingerprint: ProductiveAssetFingerprint;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
};

export type AssetHierarchyEdge = {
  readonly parentAssetId: ProductiveAssetId;
  readonly childAssetId: ProductiveAssetId;
  readonly rollupBehavior: RollupBehavior;
  readonly explicitLineage: true;
};

export type AssetResolutionHint = {
  readonly aliasKind?: ProductiveAliasKind;
  readonly aliasValue?: string;
  readonly aliasValueCommitment?: string;
  readonly sourceSystem?: string;
  readonly providerId?: string;
  readonly officialFacilityId?: string;
  readonly operatorAssetId?: string;
  readonly governmentRegistryId?: string;
  readonly enterpriseId?: string;
  readonly coordinatesCommitment?: string;
  readonly technology?: string;
  readonly commissionedYear?: number;
  readonly assetClass?: ProductiveAssetClass;
  readonly jurisdiction?: string;
  readonly displayName?: string;
};

export type AssetResolutionResult = {
  readonly confidence: IdentityConfidence;
  readonly productiveAssetId: ProductiveAssetId | null;
  readonly candidates: readonly ProductiveAssetId[];
  readonly matchedAliasIds: readonly ProductiveAssetAliasId[];
  readonly conflictReason: string | null;
};

export type RegisterProductiveAssetInput = {
  readonly assetClass: ProductiveAssetClass;
  readonly productiveCategory: ProductiveCategory;
  readonly economyCategory?: ProductiveEconomyCategory | null;
  readonly displayName?: string | null;
  readonly parties?: readonly PartyReference[];
  readonly geography: GeographicReference;
  readonly jurisdiction: string;
  readonly commissionedAtUtc?: string | null;
  readonly retiredAtUtc?: string | null;
  readonly lifecycle?: ProductiveAssetLifecycle;
  readonly capacityMetadata?: Readonly<Record<string, string>>;
  readonly technologyMetadata?: Readonly<Record<string, string>>;
  readonly externalIdentifiers?: readonly ExternalIdentifier[];
  readonly verificationStatus?: AssetVerificationStatus;
  readonly sourceReferences?: readonly string[];
  readonly rightsReferences?: readonly string[];
  readonly parentAssetId?: ProductiveAssetId | null;
  readonly rollupBehavior?: RollupBehavior;
  readonly aliases?: readonly {
    readonly aliasKind: ProductiveAliasKind;
    readonly aliasValue: string;
    readonly sourceSystem: string;
    readonly providerId?: string | null;
  }[];
  readonly createdAtUtc: string;
};

export type ProductionAttributionAssessment = {
  readonly allowed: boolean;
  readonly code: 'OK' | 'LIFECYCLE_INCOMPATIBLE' | 'RETIRED_BEFORE_EVENT' | 'NOT_YET_COMMISSIONED' | 'UNKNOWN_LIFECYCLE';
  readonly message: string;
};

export type ProductiveAssetIdentitySnapshot = {
  readonly schemaVersion: typeof PRODUCTIVE_ASSET_IDENTITY_SCHEMA;
  readonly nextSequence: number;
  readonly assets: readonly CanonicalProductiveAsset[];
  readonly aliases: readonly ProductiveAssetAlias[];
  readonly hierarchy: readonly AssetHierarchyEdge[];
};
