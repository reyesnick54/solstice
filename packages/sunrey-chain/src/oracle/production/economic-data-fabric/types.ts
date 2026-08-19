/**
 * Chunk 138 — unified multi-provider economic data fabric types.
 *
 * Operational routing, admission, coverage, and reconciliation above
 * provider-family adapters. This is not a second oracle consensus
 * engine, productive registry, attribution engine, economic asset
 * registry, or mint.
 *
 * Provider Family → Connector Runtime → Certification Gate →
 * Canonical Collection Envelope → Oracle Observation Submission →
 * EXISTING Oracle Consensus → Verified Economic Fact →
 * EXISTING Event Identity → EXISTING Attribution →
 * EXISTING Productive Value → EXISTING Monetary Authority
 */

import type { FactType, UnitCode } from '../../types.ts';
import type { ProductiveCategory } from '../../../productive/types.ts';
import type {
  CanonicalDataSourceCategory,
  DataSourceCategory,
} from '../../../productive/source-taxonomy/types.ts';
import type { CertificationStatus } from '../certification/types.ts';
import type { CanonicalProductiveMeasurement } from '../../../units/measurement.ts';

export const ECONOMIC_DATA_FABRIC_ID = 'sunrey.oracle.economic-data-fabric.v1' as const;
export const ECONOMIC_DATA_FABRIC_VERSION = 1 as const;
export const FABRIC_CONNECTOR_RUNTIME_VERSION = 'sunrey-oracle-connector/1' as const;
export const FABRIC_NORMALIZATION_VERSION = 'sunrey.economic-unit.normalization.v1' as const;
export const FABRIC_SOURCE_TAXONOMY_VERSION = 'moonrey.source-taxonomy.v1' as const;
export const FABRIC_MAX_BATCH_SIZE = 64 as const;

export const DATA_FABRIC_FINALIZES_FACTS = false as const;
export const DATA_FABRIC_MINTS_MOONREY = false as const;
export const DATA_FABRIC_CREATES_PRODUCTIVE_CONTRIBUTION = false as const;
export const DATA_FABRIC_AUTHORIZES_ISSUANCE = false as const;
export const PRODUCTION_ACTIVE = false as const;
export const LIVE_PROVIDER_CONNECTED = false as const;
export const CONSENSUS_CALLED_HTTP = false as const;
export const CHUNK_71_REMAINS_MONETARY_AUTHORITY = true as const;
export const PRODUCTION_LIVE_ADMISSION_EXISTS = false as const;

export const PROVIDER_FAMILY_IDS = [
  'ENERGY',
  'COMPUTE',
  'AI_COMPUTE',
  'MANUFACTURING',
  'AUTOMATED_MACHINE_OUTPUT',
  'LOGISTICS',
  'STORAGE',
  'MINERALS_RESOURCES',
  'AGRICULTURE_FOOD',
  'WATER',
  'REAL_ESTATE',
  'INFRASTRUCTURE',
  'BANDWIDTH',
  'GOODS',
  'SERVICES',
  'REFERENCE_DATA',
] as const;
export type ProviderFamilyId = (typeof PROVIDER_FAMILY_IDS)[number];

export const FAMILY_IMPLEMENTATION_STATES = [
  'ADAPTER_IMPLEMENTED',
  'ROUTING_INDEX_ONLY',
] as const;
export type FamilyImplementationState = (typeof FAMILY_IMPLEMENTATION_STATES)[number];

export const ADMISSION_MODES = [
  'FIXTURE_ONLY',
  'ENGINEERING_SANDBOX',
  'TESTNET_ADMISSIBLE',
  'PRODUCTION_CANDIDATE',
] as const;
export type AdmissionMode = (typeof ADMISSION_MODES)[number];

export const PRIVACY_CLASSES = [
  'AGGREGATE_ONLY',
  'FACILITY_AGGREGATE',
  'OPERATOR_AGGREGATE',
  'REFERENCE_PUBLIC',
] as const;
export type PrivacyClass = (typeof PRIVACY_CLASSES)[number];

export const STORAGE_CLASSES = [
  'COMMITMENT_ONLY',
  'MEASUREMENT_AND_PROVENANCE',
  'REFERENCE_METADATA',
] as const;
export type StorageClass = (typeof STORAGE_CLASSES)[number];

export const CONNECTOR_PROFILE_TYPES = [
  'FILE_FIXTURE',
  'HTTPS_API_KEY',
  'HTTPS_MTLS',
  'HTTPS_OAUTH',
  'SIGNED_REQUEST',
  'PRIVATE_NETWORK',
] as const;
export type ConnectorProfileType = (typeof CONNECTOR_PROFILE_TYPES)[number];

export const FACT_COVERAGE_CLASSES = [
  'PRODUCTIVE_SOURCE',
  'REFERENCE_ONLY',
  'CAPACITY_ONLY',
  'REALIZED_OUTPUT',
  'USAGE',
  'DELIVERY',
  'RESERVE',
] as const;
export type FactCoverageClass = (typeof FACT_COVERAGE_CLASSES)[number];

export const CORRELATION_CONFIDENCE = [
  'AUTHORITATIVE_REFERENCE',
  'STRONG_CORRELATION',
  'POSSIBLE_CORRELATION',
  'NO_CORRELATION',
] as const;
export type CorrelationConfidence = (typeof CORRELATION_CONFIDENCE)[number];

export const FABRIC_REJECTION_CODES = [
  'FAMILY_NOT_REGISTERED',
  'DUPLICATE_FAMILY_ID',
  'AMBIGUOUS_FAMILY_ROUTING',
  'INVALID_FAMILY_ROUTING',
  'SOURCE_NOT_REGISTERED',
  'ENDPOINT_PROFILE_NOT_APPROVED',
  'CONNECTOR_RESULT_INVALID',
  'SCHEMA_VALIDATION_FAILED',
  'UNIT_NORMALIZATION_FAILED',
  'UNIT_EXTENSION_REQUIRED',
  'TAXONOMY_INCOMPATIBLE',
  'SELF_LABELED_PRODUCTIVE_CATEGORY',
  'REFERENCE_PRICE_CANNOT_CREATE_CLAIM',
  'CERTIFICATION_MISSING',
  'CERTIFICATION_EXPIRED',
  'CERTIFICATION_REVALIDATION_REQUIRED',
  'CERTIFICATION_STATUS_INSUFFICIENT',
  'PROVIDER_SUSPENDED',
  'SOURCE_SUSPENDED',
  'FRESHNESS_POLICY_FAILED',
  'PROVENANCE_INCOMPLETE',
  'PRIVACY_FIREWALL_VIOLATION',
  'CREDENTIAL_MATERIAL_PRESENT',
  'RAW_PAYLOAD_PRESENT',
  'ARBITRARY_URL_FORBIDDEN',
  'EXTERNAL_NETWORK_FORBIDDEN',
  'PRODUCTION_LIVE_FORBIDDEN',
  'BATCH_LIMIT_EXCEEDED',
  'IDEMPOTENT_REPLAY',
] as const;
export type FabricRejectionCode = (typeof FABRIC_REJECTION_CODES)[number];

export type FabricRejection = {
  readonly code: FabricRejectionCode;
  readonly detail: string;
};

export type SourceQuantity = {
  readonly mantissa: bigint;
  readonly scale: 0;
  readonly unit: UnitCode;
};

export type FabricGeography = {
  readonly jurisdiction: string;
  readonly region: string;
  readonly locality: string;
};

export type EconomicDataProviderFamilyRecord = {
  readonly familyId: ProviderFamilyId;
  readonly version: number;
  readonly implementationState: FamilyImplementationState;
  readonly adapterOwnerPath: string | null;
  readonly supportedSourceCategories: readonly DataSourceCategory[];
  readonly supportedFactTypes: readonly FactType[];
  readonly supportedProductiveCategories: readonly ProductiveCategory[];
  readonly supportedUnits: readonly UnitCode[];
  readonly supportedSchemaIds: readonly string[];
  readonly connectorProfileTypes: readonly ConnectorProfileType[];
  readonly certificationProfileIds: readonly string[];
  readonly privacyClass: PrivacyClass;
  readonly defaultStorageClass: StorageClass;
  readonly sourceTaxonomyVersion: typeof FABRIC_SOURCE_TAXONOMY_VERSION;
  readonly normalizationVersion: typeof FABRIC_NORMALIZATION_VERSION;
  readonly productionActivated: false;
  readonly liveProviderConnected: false;
};

export type EconomicDataCollectionEnvelope = {
  readonly envelopeId: string;
  readonly familyId: ProviderFamilyId;
  readonly providerId: string;
  readonly sourceId: string;
  readonly feedId: string;
  readonly sourceCategory: DataSourceCategory;
  readonly canonicalSourceCategory: CanonicalDataSourceCategory;
  readonly factType: FactType;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly sourceObservationId: string;
  readonly subjectRef: string;
  readonly sourceQuantity: SourceQuantity;
  readonly canonicalMeasurementRef: string | null;
  readonly canonicalMeasurement: CanonicalProductiveMeasurement | null;
  readonly measurementStart: bigint;
  readonly measurementEnd: bigint;
  readonly sourceTimestamp: bigint;
  readonly collectionTimestamp: bigint;
  readonly geography: FabricGeography;
  readonly provenanceRef: string;
  readonly contentCommitment: string;
  readonly certificationId: string | null;
  readonly certificationStatus: CertificationStatus | 'NOT_EVALUATED';
  readonly connectorRuntimeVersion: typeof FABRIC_CONNECTOR_RUNTIME_VERSION;
  readonly normalizationVersion: typeof FABRIC_NORMALIZATION_VERSION;
  readonly mappingId: string | null;
  readonly mappingVersion: number | null;
  readonly privacyClassification: PrivacyClass;
  readonly payloadStored: false;
  readonly credentialsPresent: false;
  readonly productiveCategory: ProductiveCategory | null;
  readonly canCreateProductiveClaim: boolean;
  readonly canMint: false;
  readonly productionActivated: false;
};

export type CollectionCandidate = {
  readonly providerId: string;
  readonly sourceId: string;
  readonly feedId: string;
  readonly sourceCategory: DataSourceCategory;
  readonly factType: FactType;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly sourceObservationId: string;
  readonly subjectRef: string;
  readonly sourceQuantity: SourceQuantity;
  readonly measurementStart: bigint;
  readonly measurementEnd: bigint;
  readonly sourceTimestamp: bigint;
  readonly collectionTimestamp: bigint;
  readonly geography: FabricGeography;
  readonly provenanceRef: string;
  readonly contentCommitment: string;
  readonly certificationId?: string | null;
  readonly certificationStatus?: CertificationStatus | 'NOT_EVALUATED';
  readonly mappingId?: string | null;
  readonly mappingVersion?: number | null;
  readonly claimedFamilyId?: ProviderFamilyId;
  readonly claimedProductiveCategory?: ProductiveCategory | null;
  readonly endpointProfileId?: string;
  readonly connectorResultValid?: boolean;
  readonly schemaValid?: boolean;
  readonly sourceRegistered?: boolean;
  readonly endpointApproved?: boolean;
  readonly providerSuspended?: boolean;
  readonly sourceSuspended?: boolean;
  readonly freshnessMaxAgeSeconds?: number;
  readonly lineageRef?: string | null;
  readonly batchRef?: string | null;
  readonly objectRef?: string | null;
  readonly controllerId?: string;
  readonly upstreamOrganizationId?: string;
  readonly sharedControlGroup?: string | null;
  readonly payload?: unknown;
  readonly credentialsPresent?: boolean;
  readonly rawPayloadPresent?: boolean;
  readonly externalUrl?: string | null;
  readonly certificationExpired?: boolean;
};

export type ObservationGroupKey = {
  readonly factType: FactType;
  readonly subjectRef: string;
  readonly measurementStart: bigint;
  readonly measurementEnd: bigint;
  readonly geographyKey: string;
  readonly unitSemantics: string;
};

export type ObservationGroup = {
  readonly groupId: string;
  readonly key: ObservationGroupKey;
  readonly envelopeIds: readonly string[];
  readonly rawSourceCount: number;
  readonly independentControllerCount: number;
  readonly sharedControlGroups: readonly string[];
  readonly aggregatedIntoVerifiedFact: false;
};

export type OracleObservationDraftBatch = {
  readonly batchId: string;
  readonly groupId: string;
  readonly feedId: string;
  readonly subject: string;
  readonly drafts: readonly {
    readonly envelopeId: string;
    readonly providerId: string;
    readonly sourceId: string;
    readonly factType: FactType;
    readonly sourceQuantity: SourceQuantity;
    readonly contentCommitment: string;
    readonly measurementStart: bigint;
    readonly measurementEnd: bigint;
  }[];
  readonly fabricFinalizesFact: false;
  readonly fabricCountsAsQuorum: false;
};

export type EconomicEventCorrelationCandidate = {
  readonly candidateId: string;
  readonly leftEnvelopeId: string;
  readonly rightEnvelopeId: string;
  readonly leftFamilyId: ProviderFamilyId;
  readonly rightFamilyId: ProviderFamilyId;
  readonly confidence: CorrelationConfidence;
  readonly evidence: readonly string[];
  readonly merged: false;
  readonly attributionResolved: false;
};

export type CrossProviderConflictCandidate = {
  readonly conflictId: string;
  readonly subjectRef: string;
  readonly factType: FactType;
  readonly measurementStart: bigint;
  readonly measurementEnd: bigint;
  readonly quantities: readonly {
    readonly envelopeId: string;
    readonly providerId: string;
    readonly mantissa: bigint;
    readonly unit: UnitCode;
  }[];
  readonly resolved: false;
  readonly oracleConsensusAuthoritative: true;
};

export type CrossDomainLineageLink = {
  readonly linkId: string;
  readonly fromFamilyId: ProviderFamilyId;
  readonly toFamilyId: ProviderFamilyId;
  readonly fromEnvelopeId: string;
  readonly toEnvelopeId: string;
  readonly relation:
    | 'ENERGY_INPUT'
    | 'WATER_IRRIGATION_INPUT'
    | 'RESOURCE_INPUT'
    | 'FOOD_PROCESSING_INPUT'
    | 'GOODS_BATCH'
    | 'LOGISTICS_SHIPMENT'
    | 'WAREHOUSE_STORAGE'
    | 'AI_SERVICE_EXECUTION';
  readonly ownershipTransferred: false;
};

export type CoverageFlags = {
  readonly providerFamilyImplemented: boolean;
  readonly factTypeMapped: boolean;
  readonly sourceSchemaAvailable: boolean;
  readonly canonicalUnitPathAvailable: boolean;
  readonly certificationProfileAvailable: boolean;
  readonly connectorRuntimeCompatible: boolean;
  readonly oracleFeedPathAvailable: boolean;
  readonly eventIdentityCompatible: boolean;
  readonly attributionPolicyAvailable: boolean;
  readonly valueFunctionCategoryReviewed: boolean;
  readonly referenceOnly: boolean;
  readonly unitExtensionRequired: boolean;
  readonly semanticReviewRequired: boolean;
  readonly liveProviderConnected: false;
};

export type SourceCategoryCoverageRow = {
  readonly sourceCategory: DataSourceCategory;
  readonly familyId: ProviderFamilyId | null;
  readonly flags: CoverageFlags;
};

export type ProductiveCategoryCoverageRow = {
  readonly productiveCategory: ProductiveCategory;
  readonly familyId: ProviderFamilyId | null;
  readonly flags: CoverageFlags;
};

export type FactTypeCoverageRow = {
  readonly factType: FactType;
  readonly coverageClass: FactCoverageClass;
  readonly familyId: ProviderFamilyId | null;
  readonly mapped: boolean;
  readonly routed: boolean;
};

export type EconomicDataFabricCoverageReport = {
  readonly reportId: typeof ECONOMIC_DATA_FABRIC_ID;
  readonly version: typeof ECONOMIC_DATA_FABRIC_VERSION;
  readonly sourceCategories: readonly SourceCategoryCoverageRow[];
  readonly productiveCategories: readonly ProductiveCategoryCoverageRow[];
  readonly factTypes: readonly FactTypeCoverageRow[];
  readonly productiveCategoryGaps: readonly ProductiveCategory[];
  readonly unmappedActiveSourceCategories: readonly DataSourceCategory[];
  readonly unmappedActiveFactTypes: readonly FactType[];
  readonly liveProviderConnections: 0;
  readonly productionActive: false;
};

export type FamilyHealthSnapshot = {
  readonly familyId: ProviderFamilyId;
  readonly sourcesRegistered: number;
  readonly sourcesSandboxAdmissible: number;
  readonly sourcesSuspended: number;
  readonly schemaFailures: number;
  readonly staleRateBps: number;
  readonly authFailureRateBps: number;
  readonly normalizationFailures: number;
  readonly certificationExpiryCount: number;
  readonly circuitOpenCount: number;
  readonly moonreyFactor: false;
};

export type BatchRecordResult =
  | { readonly ok: true; readonly envelope: EconomicDataCollectionEnvelope; readonly replay: boolean }
  | { readonly ok: false; readonly code: FabricRejectionCode; readonly detail: string; readonly sourceObservationId: string };

export type BatchIngestResult = {
  readonly accepted: readonly EconomicDataCollectionEnvelope[];
  readonly rejected: readonly BatchRecordResult[];
  readonly results: readonly BatchRecordResult[];
  readonly fabricCountsAsQuorum: false;
};

export function isProviderFamilyId(value: string): value is ProviderFamilyId {
  return (PROVIDER_FAMILY_IDS as readonly string[]).includes(value);
}

export function isAdmissionMode(value: string): value is AdmissionMode {
  return (ADMISSION_MODES as readonly string[]).includes(value);
}

export function fabricRejection(code: FabricRejectionCode, detail: string): FabricRejection {
  return Object.freeze({ code, detail });
}
