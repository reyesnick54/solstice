/**
 * Phase H productized Productive Economy Data Platform types.
 *
 * Extends the existing productive / oracle / unit / GPUV owners.
 * Observations are economic inputs. They do not set MoonRey market
 * price and do not mint MoonRey.
 */

import type { ProductiveCategory } from '../types.ts';
import type { UnitCode } from '../../oracle/types.ts';
import {
  PRODUCTIVE_VALUE_UNIT,
  PRODUCTIVE_VALUE_UNIT_ID,
} from '../policy-governance/value-function/types.ts';

export const PRODUCTIVE_ECONOMY_DATA_SCHEMA = 'sunrey.productive.economy-data.v1' as const;
export const PRODUCTIVE_ECONOMY_PLATFORM_ID = 'sunrey.productive.economy-data-platform.v1' as const;
export const PRODUCTION_ACTIVE = false as const;
export const LIVE_PROVIDER_CONNECTED = false as const;
export const OBSERVATION_CANNOT_MINT = true as const;
export const OBSERVATION_CANNOT_SET_MARKET_PRICE = true as const;
export const UNLABELED_NUMERIC_IS_NOT_ECONOMIC_TRUTH = true as const;
export const CONFIGURED_PROVIDER_IS_NOT_AUTOMATICALLY_TRUSTED = true as const;
export const SINGLE_SOURCE_IS_NOT_CONSENSUS = true as const;
export const GPUV_IS_NOT_MOONREY = true as const;
export const GPUV_IS_NOT_MARKET_PRICE = true as const;

export const CANONICAL_GPUV = PRODUCTIVE_VALUE_UNIT;
export const CANONICAL_GPUV_ID = PRODUCTIVE_VALUE_UNIT_ID;

export const PRODUCTIVE_ECONOMY_CATEGORIES = [
  'ENERGY',
  'COMPUTE',
  'AI_COMPUTE',
  'MANUFACTURING',
  'RESOURCES',
  'AGRICULTURE_FOOD',
  'REAL_ESTATE_INFRASTRUCTURE',
  'LOGISTICS',
  'TRANSPORTATION',
  'BANDWIDTH',
  'WATER',
  'OTHER_GOVERNANCE_APPROVED',
] as const;
export type ProductiveEconomyCategory = (typeof PRODUCTIVE_ECONOMY_CATEGORIES)[number];

export const CATEGORY_TO_PRODUCTIVE: Readonly<Record<ProductiveEconomyCategory, ProductiveCategory>> =
  Object.freeze({
    ENERGY: 'ENERGY',
    COMPUTE: 'COMPUTE',
    AI_COMPUTE: 'AI_COMPUTE',
    MANUFACTURING: 'MANUFACTURING',
    RESOURCES: 'MINERALS_RAW_MATERIALS',
    AGRICULTURE_FOOD: 'FOOD_AGRICULTURE',
    REAL_ESTATE_INFRASTRUCTURE: 'INFRASTRUCTURE',
    LOGISTICS: 'LOGISTICS_TRANSPORTATION',
    TRANSPORTATION: 'LOGISTICS_TRANSPORTATION',
    BANDWIDTH: 'BANDWIDTH_COMMUNICATIONS',
    WATER: 'WATER',
    OTHER_GOVERNANCE_APPROVED: 'SERVICES',
  });

export const LOVABLE_CATEGORY_SECTIONS = [
  'ENERGY',
  'AI_COMPUTE',
  'MANUFACTURING',
  'AGRICULTURE_FOOD',
  'RESOURCES',
  'REAL_ESTATE_INFRASTRUCTURE',
  'LOGISTICS',
  'OTHER_GOVERNANCE_APPROVED',
] as const;
export type LovableCategorySection = (typeof LOVABLE_CATEGORY_SECTIONS)[number];

export const RESOURCE_STATUSES = ['REGISTERED', 'ACTIVE', 'SUSPENDED', 'RETIRED', 'REDACTED'] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export const LOCATION_PRECISION = ['JURISDICTION', 'REGION', 'REDACTED', 'NOT_DISCLOSED'] as const;
export type LocationPrecision = (typeof LOCATION_PRECISION)[number];

export const OBSERVATION_STATUSES = [
  'INGESTED',
  'NORMALIZED',
  'VERIFIED',
  'REJECTED',
  'SUPERSEDED',
] as const;
export type ObservationStatus = (typeof OBSERVATION_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  'SINGLE_SOURCE_VERIFIED',
  'MULTI_SOURCE_CORROBORATED',
  'DISPUTED',
  'STALE',
  'INVALID',
  'OUTLIER',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const FRESHNESS_STATES = ['FRESH', 'AGING', 'STALE', 'EXPIRED'] as const;
export type FreshnessState = (typeof FRESHNESS_STATES)[number];

export const LICENSE_CLASSES = [
  'SANDBOX_FIXTURE',
  'PUBLIC_DERIVED_ALLOWED',
  'EXTERNAL_RESTRICTED',
  'CONFIDENTIAL_PROVIDER',
] as const;
export type LicenseClass = (typeof LICENSE_CLASSES)[number];

export const SOURCE_CLASSES = [
  'SANDBOX_FIXTURE',
  'CERTIFIED_CANDIDATE',
  'INSTITUTIONAL',
  'SENSOR_NETWORK',
  'PUBLIC_REFERENCE',
] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

export const INTEGRITY_STATES = ['INTACT', 'TAMPERED', 'UNSIGNED', 'INVALID_SIGNATURE'] as const;
export type IntegrityState = (typeof INTEGRITY_STATES)[number];

export const INGESTION_REJECTION_CODES = [
  'UNLABELED_NUMERIC',
  'MISSING_METRIC',
  'MISSING_UNIT',
  'MISSING_SOURCE',
  'MISSING_PROVENANCE',
  'INVALID_SIGNATURE',
  'SCHEMA_INVALID',
  'UNIT_INCOMPATIBLE',
  'PROVIDER_NOT_TRUSTED',
  'LICENSE_FORBIDS_USE',
  'CATEGORY_NOT_APPROVED',
  'RESOURCE_UNKNOWN',
  'LOCATION_POLICY_FORBIDDEN',
] as const;
export type IngestionRejectionCode = (typeof INGESTION_REJECTION_CODES)[number];

export type EconomyResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type ResourceLocation = {
  readonly precision: LocationPrecision;
  readonly jurisdiction: string;
  readonly region: string | null;
  readonly publicDisclosureAllowed: boolean;
};

export type ProductiveResourceRecord = {
  readonly schema: typeof PRODUCTIVE_ECONOMY_DATA_SCHEMA;
  readonly resourceId: string;
  readonly category: ProductiveEconomyCategory;
  readonly productiveCategory: ProductiveCategory;
  readonly subtype: string;
  readonly ownerRef: string | null;
  readonly operatorRef: string | null;
  readonly location: ResourceLocation;
  readonly unit: UnitCode | string;
  readonly status: ResourceStatus;
  readonly sourceRequirements: readonly string[];
  readonly valuationMethodologyId: string;
  readonly oracleRequirements: {
    readonly minimumSources: number;
    readonly allowSingleSourceVerified: boolean;
    readonly singleSourceIsNotConsensus: true;
  };
  readonly productionActive: false;
};

export type ObservationProvenance = {
  readonly sourceId: string;
  readonly providerId: string;
  readonly sourceClass: SourceClass;
  readonly method: string;
  readonly evidenceRef: string;
  readonly collectedAtUtc: string;
  readonly license: LicenseClass;
  readonly signatureValid: boolean;
  readonly configuredDoesNotImplyTrusted: true;
};

export type FreshnessPolicy = {
  readonly maxAgeSeconds: bigint;
  readonly staleAfterSeconds: bigint;
  readonly timeSensitiveValuationRequiresFresh: true;
};

export type FreshnessAssessment = {
  readonly state: FreshnessState;
  readonly ageSeconds: bigint;
  readonly expiresAtUtc: string;
  readonly usableForTimeSensitiveValuation: boolean;
};

export type EconomicObservation = {
  readonly schema: typeof PRODUCTIVE_ECONOMY_DATA_SCHEMA;
  readonly observationId: string;
  readonly category: ProductiveEconomyCategory;
  readonly resourceId: string;
  readonly metric: string;
  readonly value: bigint;
  readonly unit: string;
  readonly canonicalUnit: string;
  readonly canonicalValue: bigint;
  readonly timestampUtc: string;
  readonly source: string;
  readonly provider: string;
  readonly provenance: ObservationProvenance;
  readonly verification: VerificationStatus;
  readonly confidenceBps: bigint;
  readonly freshness: FreshnessAssessment;
  readonly license: LicenseClass;
  readonly integrity: IntegrityState;
  readonly status: ObservationStatus;
  readonly simulation: true;
  readonly mintsMoonRey: false;
  readonly setsMarketPrice: false;
  readonly unlabeled: false;
};

export type ObservationDraft = {
  readonly observationId: string;
  readonly category: ProductiveEconomyCategory;
  readonly resourceId: string;
  readonly metric?: string;
  readonly value?: bigint;
  readonly unit?: string;
  readonly timestampUtc: string;
  readonly source?: string;
  readonly provider: string;
  readonly signatureValid: boolean;
  readonly license: LicenseClass;
  readonly sourceClass: SourceClass;
  readonly evidenceRef?: string;
  readonly method?: string;
};

export type ProductiveValueMethodology = {
  readonly methodologyId: string;
  readonly version: string;
  readonly category: ProductiveEconomyCategory;
  readonly eligibleMetrics: readonly string[];
  readonly normalization: string;
  readonly qualityWeighting: string;
  readonly confidence: string;
  readonly caps: string;
  readonly conversionBasis: 'GPUV_INPUT_NOT_MOONREY_RATIO';
  readonly governanceApproval: 'SIMULATION_ONLY' | 'RESEARCH_REQUIRED' | 'NOT_AUTHORIZED';
  readonly effectiveDateUtc: string;
  readonly hardcodedIssuanceRatio: false;
  readonly productionAuthorized: false;
};

export function isProductiveEconomyCategory(value: string): value is ProductiveEconomyCategory {
  return (PRODUCTIVE_ECONOMY_CATEGORIES as readonly string[]).includes(value);
}
