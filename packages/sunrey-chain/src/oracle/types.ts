/**
 * Chunk 43 — SunRey sovereign oracle network types.
 *
 * External facts become usable only through signed, registered, finalized
 * oracle observations. Consensus never calls HTTP, websites, models, or
 * external databases. Facts are protocol evidence, not money and not
 * philosophical truth.
 */

export const ORACLE_SCHEMA_VERSION = 1 as const;
export const ORACLE_MESSAGE_DOMAIN = 'oracle.v1' as const;
export const ORACLE_PROTOCOL_VERSION = 'sunrey-protocol-0' as const;

export const ORACLE_TYPES = [
  'INSTITUTIONAL_DATA_PROVIDER',
  'REGULATED_PROVIDER',
  'ENTERPRISE_SENSOR_NETWORK',
  'DEVICE_ORACLE',
  'ATTESTATION_PROVIDER',
  'AUDITOR',
  'PUBLIC_DATA_PROVIDER',
  'COMPOSITE_ORACLE',
] as const;
export type OracleType = (typeof ORACLE_TYPES)[number];

export const PROVIDER_STATUSES = [
  'REGISTERED',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'EXPIRED',
] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const FEED_STATUSES = ['REGISTERED', 'ACTIVE', 'SUSPENDED', 'RETIRED'] as const;
export type FeedStatus = (typeof FEED_STATUSES)[number];

/**
 * Oracle fact vocabulary. Chunk 116 adds only the types required to cover
 * previously implicit productive domains. Existing types keep their
 * historical meaning and are not reinterpreted.
 *
 * New types:
 * - AI_COMPUTE_CAPACITY — installed or available AI accelerator capacity
 * - AI_TRAINING_USAGE — measured training consumption, distinct from inference
 * - INFRASTRUCTURE_CAPACITY — facility / civil-infrastructure capacity
 * - INFRASTRUCTURE_USAGE — measured infrastructure utilization
 * - GOODS_OUTPUT — finished-goods production, distinct from process output
 * - GOODS_DELIVERY — finished-goods delivery completion
 * - AUTOMATED_MACHINE_OUTPUT — autonomous or machine-originated output
 */
export const FACT_TYPES = [
  'ENERGY_PRODUCTION',
  'ENERGY_CAPACITY',
  'ENERGY_CONSUMPTION',
  'FOOD_PRODUCTION',
  'AGRICULTURAL_OUTPUT',
  'WATER_PRODUCTION',
  'WATER_AVAILABILITY',
  'COMPUTE_CAPACITY',
  'COMPUTE_USAGE',
  'AI_INFERENCE_USAGE',
  'AI_COMPUTE_CAPACITY',
  'AI_TRAINING_USAGE',
  'MANUFACTURING_CAPACITY',
  'MANUFACTURING_OUTPUT',
  'REAL_ESTATE_USE_CAPACITY',
  'STORAGE_CAPACITY',
  'LOGISTICS_CAPACITY',
  'DELIVERY_COMPLETION',
  'BANDWIDTH_CAPACITY',
  'BANDWIDTH_USAGE',
  'RESOURCE_RESERVE',
  'RESOURCE_EXTRACTION',
  'SERVICE_DELIVERY',
  'INFRASTRUCTURE_CAPACITY',
  'INFRASTRUCTURE_USAGE',
  'GOODS_OUTPUT',
  'GOODS_DELIVERY',
  'AUTOMATED_MACHINE_OUTPUT',
  'REFERENCE_PRICE',
] as const;
export type FactType = (typeof FACT_TYPES)[number];

export const UNIT_CODES = [
  'Wh',
  'kWh',
  'MWh',
  'kg',
  'tonne',
  'L',
  'm3',
  'm2',
  'compute_s',
  'gpu_s',
  'token_inference',
  'machine_h',
  'units_produced',
  'tonne_km',
  'GB',
  'TB',
  'GB_s',
] as const;
export type UnitCode = (typeof UNIT_CODES)[number];

export const AGGREGATION_POLICIES = [
  'MEDIAN',
  'WEIGHTED_MEDIAN',
  'QUORUM_MATCH',
  'TRIMMED_MEDIAN',
  'CATEGORICAL_QUORUM',
] as const;
export type AggregationPolicy = (typeof AGGREGATION_POLICIES)[number];

export const OUTLIER_POLICIES = ['NONE', 'REJECT_OUTSIDE_SPREAD', 'EXCLUDE_THEN_AGGREGATE'] as const;
export type OutlierPolicy = (typeof OUTLIER_POLICIES)[number];

export const QUALITY_STATUSES = [
  'PENDING',
  'VERIFIED',
  'CONFLICTED',
  'STALE',
  'REVOKED_SOURCE',
  'SUPERSEDED',
] as const;
export type QualityStatus = (typeof QUALITY_STATUSES)[number];

export const DISPUTE_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'UPHELD',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const DISPUTE_REASON_CODES = [
  'MATERIAL_DISAGREEMENT',
  'METHODOLOGY_CHALLENGE',
  'SOURCE_COMPROMISE',
  'CALIBRATION_FAILURE',
  'GEOGRAPHY_MISMATCH',
  'STALE_WINDOW',
  'UNAUTHORIZED_PROVIDER',
] as const;
export type DisputeReasonCode = (typeof DISPUTE_REASON_CODES)[number];

export const ORACLE_REJECTION_CODES = [
  'ORACLE_UNREGISTERED',
  'ORACLE_INACTIVE',
  'ORACLE_NOT_AUTHORIZED_FOR_FEED',
  'ORACLE_WRONG_FEED',
  'ORACLE_WRONG_UNIT',
  'ORACLE_INVALID_SIGNATURE',
  'ORACLE_WRONG_CRYPTO_SUITE',
  'ORACLE_STALE_OBSERVATION',
  'ORACLE_DUPLICATE_SEQUENCE',
  'ORACLE_INVALID_TIME_WINDOW',
  'ORACLE_WRONG_NETWORK',
  'ORACLE_WRONG_CHAIN',
  'ORACLE_SCHEMA_INVALID',
  'ORACLE_OUT_OF_BOUNDS',
  'ORACLE_GEOGRAPHY_REQUIRED',
  'ORACLE_INSUFFICIENT_QUORUM',
  'ORACLE_PAYLOAD_OVERSIZED',
  'ORACLE_FEE_INSUFFICIENT',
  'ORACLE_FEED_INACTIVE',
  'ORACLE_PROVIDER_SUSPENDED',
  'ORACLE_INCOMPATIBLE_UNITS',
  'ORACLE_HYBRID_REQUIRED',
] as const;
export type OracleRejectionCode = (typeof ORACLE_REJECTION_CODES)[number];

export type OracleRejection = {
  readonly code: OracleRejectionCode;
  readonly detail: string;
};

export type FixedQuantity = {
  readonly schemaVersion: 1;
  readonly mantissa: bigint;
  readonly scale: number;
  readonly unit: UnitCode;
};

export type GeographicScope = {
  readonly schemaVersion: 1;
  readonly jurisdiction: string;
  readonly region: string;
  readonly locality: string;
};

export type DeviceProvenance = {
  readonly schemaVersion: 1;
  readonly deviceId: string;
  readonly ownerController: string;
  readonly firmwareHash: string;
  readonly hardwareAttestation: string;
  readonly calibrationRecord: string;
  readonly measurementSchema: string;
};

export type ConfidenceMetadata = {
  readonly schemaVersion: 1;
  readonly scoreBps: number;
  readonly sampleCount: number;
  readonly notesRef: string;
};

export type ReputationMetadata = {
  readonly schemaVersion: 1;
  readonly acceptedObservations: number;
  readonly rejectedObservations: number;
  readonly conflictsParticipated: number;
};

export type OracleProviderRecord = {
  readonly schemaVersion: 1;
  readonly oracleId: string;
  readonly controllerActor: string;
  readonly legalEntityReference: string | null;
  readonly oracleType: OracleType;
  readonly publicKeyHex: string;
  readonly cryptoSuite: string;
  readonly authorizedFeedTypes: readonly FactType[];
  readonly jurisdictions: readonly string[];
  readonly geographicScope: GeographicScope;
  readonly methodologyReference: string;
  readonly status: ProviderStatus;
  readonly activationHeight: number;
  readonly expirationHeight: number | null;
  readonly reputation: ReputationMetadata;
  readonly schemaVersionRecord: number;
};

export type OracleFeedDefinition = {
  readonly schemaVersion: 1;
  readonly feedId: string;
  readonly factType: FactType;
  readonly measurementUnit: UnitCode;
  readonly quantityScale: number;
  readonly geographicScope: GeographicScope;
  readonly subjectSchema: string;
  readonly aggregationPolicy: AggregationPolicy;
  readonly minimumSources: number;
  readonly minimumQuorum: number;
  readonly requiredSourceClasses: readonly OracleType[];
  readonly maximumAgeSeconds: number;
  readonly outlierPolicy: OutlierPolicy;
  readonly maxObservationSpread: bigint;
  readonly trimCount: number;
  readonly confidenceMinBps: number;
  readonly allowSingleAuthoritativeProvider: boolean;
  readonly requireHybridSignature: boolean;
  readonly minValue: bigint;
  readonly maxValue: bigint;
  readonly requireGeography: boolean;
  readonly activationHeight: number;
  readonly status: FeedStatus;
};

export type OracleObservation = {
  readonly schemaVersion: 1;
  readonly observationId: string;
  readonly oracleId: string;
  readonly feedId: string;
  readonly subject: string;
  readonly value: FixedQuantity;
  readonly measurementStartUnix: bigint;
  readonly measurementEndUnix: bigint;
  readonly observationTimeUnix: bigint;
  readonly validUntilUnix: bigint;
  readonly geography: GeographicScope;
  readonly sourceReferenceCommitment: string;
  readonly methodologyReference: string;
  readonly confidence: ConfidenceMetadata;
  readonly sequence: bigint;
  readonly networkId: string;
  readonly chainId: string;
  readonly cryptoSuite: string;
  readonly signatureHex: string;
  readonly publicKeyHex: string;
  readonly deviceProvenance: DeviceProvenance | null;
  readonly weight: bigint;
};

export type ObservationWindow = {
  readonly startUnix: bigint;
  readonly endUnix: bigint;
};

export type VerifiedEconomicFact = {
  readonly schemaVersion: 1;
  readonly factId: string;
  readonly feedId: string;
  readonly subject: string;
  readonly aggregatedValue: FixedQuantity;
  readonly sourceObservationIds: readonly string[];
  readonly aggregationPolicy: AggregationPolicy;
  readonly observationWindow: ObservationWindow;
  readonly validUntilUnix: bigint;
  readonly qualityStatus: QualityStatus;
  readonly finalizedHeight: number;
  readonly conflictReason: string | null;
};

export type OracleDispute = {
  readonly schemaVersion: 1;
  readonly disputeId: string;
  readonly factId: string | null;
  readonly observationId: string | null;
  readonly challenger: string;
  readonly reasonCode: DisputeReasonCode;
  readonly evidenceCommitment: string;
  readonly status: DisputeStatus;
  readonly resolution: string | null;
  readonly governanceReference: string | null;
  readonly openedHeight: number;
};

export type OracleMetrics = {
  readonly oracle_observations_received: number;
  readonly oracle_observations_rejected: number;
  readonly oracle_verified_facts: number;
  readonly oracle_conflicts: number;
  readonly oracle_stale_facts: number;
  readonly oracle_quorum_failures: number;
  readonly oracle_provider_status: Readonly<Record<string, number>>;
  readonly oracle_aggregation_latency: number;
};

export function isOracleType(value: string): value is OracleType {
  return (ORACLE_TYPES as readonly string[]).includes(value);
}

export function isFactType(value: string): value is FactType {
  return (FACT_TYPES as readonly string[]).includes(value);
}

export function isUnitCode(value: string): value is UnitCode {
  return (UNIT_CODES as readonly string[]).includes(value);
}

export function isAggregationPolicy(value: string): value is AggregationPolicy {
  return (AGGREGATION_POLICIES as readonly string[]).includes(value);
}

export function providerClassificationIsNotLegalApproval(_type: OracleType): true {
  return true;
}
