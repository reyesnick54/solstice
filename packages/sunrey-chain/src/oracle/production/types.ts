/**
 * Chunk 68 — production-candidate oracle onboarding and collection types.
 *
 * This is the off-chain data plane for the Chunk 43 oracle engine.
 * Consensus never calls HTTP or external APIs. Facts are not money and
 * never mint MoonRey. Missing commercial evidence is never confirmed.
 */

import type { SecretReference } from '../../../../security/src/secrets.ts';
import type { AggregationPolicy, FactType, FixedQuantity, OracleType, UnitCode } from '../types.ts';
import {
  DATA_SOURCE_CATEGORIES,
  PRIMARY_FACT_TYPE_BY_CATEGORY,
  isDataSourceCategory,
  type DataSourceCategory,
} from '../../productive/source-taxonomy/types.ts';

export type { FactType, FixedQuantity, OracleType, UnitCode };
export { DATA_SOURCE_CATEGORIES, isDataSourceCategory };
export type { DataSourceCategory };
export const CATEGORY_TO_FACT_TYPE = PRIMARY_FACT_TYPE_BY_CATEGORY;

export const PRODUCTION_ORACLE_SCHEMA_VERSION = 1 as const;
export const COLLECTOR_VERSION = 'sunrey-oracle-collector/1' as const;
export const QUALITY_FORMULA_VERSION = 'oracle.quality.profile.v1' as const;
export const NORMALIZATION_VERSION = 'oracle.normalize.v1' as const;
export const CANONICAL_NORMALIZATION_VERSION = 'sunrey.economic-unit.normalization.v1' as const;

export const ONBOARDING_STATUSES = [
  'DRAFT',
  'TECHNICALLY_VALIDATED',
  'TESTNET_ACTIVE',
  'PRODUCTION_CANDIDATE',
  'SUSPENDED',
  'REVOKED',
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const AUTHENTICATION_METHODS = [
  'MTLS',
  'API_KEY_REFERENCE',
  'OAUTH_CLIENT',
  'SIGNED_REQUEST',
  'PRIVATE_NETWORK',
  'FILE_FIXTURE_TEST_ONLY',
] as const;
export type AuthenticationMethod = (typeof AUTHENTICATION_METHODS)[number];

export const SIGNER_KINDS = ['SOFTWARE_DEVELOPMENT', 'KMS', 'HSM'] as const;
export type OracleSignerKind = (typeof SIGNER_KINDS)[number];

export const SECURITY_REVIEW_STATUSES = [
  'NOT_REVIEWED',
  'ENGINEERING_REVIEWED',
  'EXTERNAL_REVIEW_REQUIRED',
  'REVIEWED_WITH_EVIDENCE',
] as const;
export type SecurityReviewStatus = (typeof SECURITY_REVIEW_STATUSES)[number];

export const EVIDENCE_CONFIRMATION_STATES = [
  'NOT_PROVIDED',
  'REFERENCE_RECORDED',
  'CONFIRMED',
] as const;
export type EvidenceConfirmationState = (typeof EVIDENCE_CONFIRMATION_STATES)[number];

export const QUALITY_CLASSES = ['ENGINEERING', 'TESTNET', 'PRODUCTION_CANDIDATE'] as const;
export type QualityClass = (typeof QUALITY_CLASSES)[number];

export const INCIDENT_ACTIONS = [
  'PROVIDER_SUSPENSION',
  'CREDENTIAL_ROTATION',
  'FEED_RESTRICTION',
  'QUORUM_REVIEW',
  'REPLAY_RECONCILIATION',
  'RESUMPTION_APPROVAL',
] as const;
export type IncidentAction = (typeof INCIDENT_ACTIONS)[number];

export const ORACLE_ALERT_KINDS = [
  'ORACLE_SOURCE_AUTH_FAILURE',
  'ORACLE_SCHEMA_CHANGED',
  'ORACLE_SOURCE_STALE',
  'ORACLE_QUORUM_DEGRADED',
  'ORACLE_PROVIDER_CONCENTRATION',
  'ORACLE_SIGNATURE_FAILURE',
  'ORACLE_SOURCE_CONFLICT',
] as const;
export type OracleAlertKind = (typeof ORACLE_ALERT_KINDS)[number];

export const PRODUCTION_ORACLE_REJECTION_CODES = [
  'PROVIDER_NOT_ONBOARDED',
  'PROVIDER_NOT_ELIGIBLE',
  'PROVIDER_SUSPENDED',
  'PROVIDER_REVOKED',
  'AGREEMENT_EVIDENCE_MISSING',
  'SECURITY_REVIEW_INCOMPLETE',
  'CREDENTIAL_NOT_ASSIGNED',
  'CREDENTIAL_ISOLATION_VIOLATION',
  'AUTH_FAILED',
  'SCHEMA_INCOMPATIBLE',
  'SCHEMA_DRIFT',
  'WRONG_NUMERIC_REPRESENTATION',
  'WRONG_UNIT',
  'MISSING_SOURCE_TIMESTAMP',
  'INVALID_IDENTIFIER',
  'RECORD_OVERSIZED',
  'UNBOUNDED_ARRAY',
  'NORMALIZATION_FAILED',
  'FLOAT_FORBIDDEN',
  'SIGNING_FAILED',
  'HSM_PQ_UNSUPPORTED',
  'INSUFFICIENT_INDEPENDENT_CONTROLLERS',
  'QUORUM_ABSENT',
  'QUALITY_BELOW_POLICY',
  'FEED_NOT_PRODUCTION_ELIGIBLE',
  'CATEGORY_NOT_ELIGIBLE',
  'TIME_WINDOW_INELIGIBLE',
  'LINEAGE_MISSING',
  'FACT_NOT_VERIFIED',
  'AUTOMATIC_ISSUANCE_FORBIDDEN',
  'AI_CANNOT_RESTORE_PROVIDER',
  'FABRICATED_DATA_FORBIDDEN',
] as const;
export type ProductionOracleRejectionCode = (typeof PRODUCTION_ORACLE_REJECTION_CODES)[number];

export type ProductionOracleRejection = {
  readonly code: ProductionOracleRejectionCode;
  readonly detail: string;
};

export type SourceRelationship = {
  readonly schemaVersion: 1;
  readonly sourceId: string;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly infrastructureRegion: string;
  readonly sharedControlGroup: string | null;
};

export type OnboardingEvidence = {
  readonly schemaVersion: 1;
  readonly technicalValidationRef: string | null;
  readonly securityReviewRef: string | null;
  readonly securityReviewStatus: SecurityReviewStatus;
  readonly commercialAgreementRef: string | null;
  readonly commercialAgreementState: EvidenceConfirmationState;
  readonly dataLicenseRef: string | null;
  readonly jurisdictionReviewRef: string | null;
  readonly usageRightsRef: string | null;
  readonly missingContractIsConfirmed: false;
};

export type SigningKeyRecord = {
  readonly schemaVersion: 1;
  readonly keyId: string;
  readonly keyVersion: number;
  readonly publicKeyHex: string;
  readonly cryptoSuite: string;
  readonly signerKind: OracleSignerKind;
  readonly rotatedFromKeyId: string | null;
  readonly active: boolean;
};

export type OracleProviderOnboardingRecord = {
  readonly schemaVersion: typeof PRODUCTION_ORACLE_SCHEMA_VERSION;
  readonly providerId: string;
  readonly legalEntityReference: string | null;
  readonly controllerReference: string;
  readonly dataCategories: readonly DataSourceCategory[];
  readonly feeds: readonly string[];
  readonly authenticationMethod: AuthenticationMethod;
  readonly signingKey: SigningKeyRecord;
  readonly cryptoSuite: string;
  readonly infrastructureRegion: string;
  readonly sourceRelationships: readonly SourceRelationship[];
  readonly onboardingEvidence: OnboardingEvidence;
  readonly securityReviewStatus: SecurityReviewStatus;
  readonly commercialAgreementEvidenceReference: string | null;
  readonly productionEligibility: boolean;
  readonly status: OnboardingStatus;
};

export type EconomicDataSource = {
  readonly schemaVersion: typeof PRODUCTION_ORACLE_SCHEMA_VERSION;
  readonly sourceId: string;
  readonly version: number;
  readonly providerId: string;
  readonly category: DataSourceCategory;
  readonly factType: FactType;
  readonly feedId: string;
  readonly unit: UnitCode;
  readonly schemaId: string;
  readonly sourceSchemaVersion: number;
  readonly normalizationVersion: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly credentialRef: SecretReference | null;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly infrastructureRegion: string;
  readonly retired: boolean;
};

export type SourceProvenance = {
  readonly schemaVersion: typeof PRODUCTION_ORACLE_SCHEMA_VERSION;
  readonly providerId: string;
  readonly sourceId: string;
  readonly sourceObservationId: string;
  readonly collectionTimestampUnix: bigint;
  readonly sourceTimestampUnix: bigint;
  readonly schemaVersionRecord: number;
  readonly unit: UnitCode;
  readonly normalizationVersion: string;
  readonly credentialRefHref: string | null;
  readonly authMethod: AuthenticationMethod;
  readonly collectorVersion: typeof COLLECTOR_VERSION;
  readonly contentHash: string;
};

export type CanonicalCollectedObservation = {
  readonly schemaVersion: typeof PRODUCTION_ORACLE_SCHEMA_VERSION;
  readonly observationDraftId: string;
  readonly providerId: string;
  readonly sourceId: string;
  readonly feedId: string;
  readonly subject: string;
  readonly value: FixedQuantity;
  readonly sourceValue?: FixedQuantity;
  readonly canonicalMeasurement?: import('../../units/measurement.ts').CanonicalProductiveMeasurement;
  readonly provenance: SourceProvenance;
};

export type FeedSchemaDefinition = {
  readonly schemaVersion: typeof PRODUCTION_ORACLE_SCHEMA_VERSION;
  readonly schemaId: string;
  readonly version: number;
  readonly factType: FactType;
  readonly requiredFields: readonly string[];
  readonly unit: UnitCode;
  readonly quantityScale: number;
  readonly identifierPattern: string;
  readonly maxRecordBytes: number;
  readonly maxArrayLength: number;
  readonly allowFloat: false;
  readonly breakingChangeCreatesNewVersion: true;
};

export type ProductionFeedConfiguration = {
  readonly schemaVersion: typeof PRODUCTION_ORACLE_SCHEMA_VERSION;
  readonly feedId: string;
  readonly schema: FeedSchemaDefinition;
  readonly factType: FactType;
  readonly measurementUnit: UnitCode;
  readonly quantityScale: number;
  readonly aggregationPolicy: AggregationPolicy;
  readonly minimumProviders: number;
  readonly minimumIndependentControllers: number;
  readonly maximumAgeSeconds: number;
  readonly maxObservationSpread: bigint;
  readonly minimumQualityBps: number;
  readonly productionEligible: boolean;
  readonly version: number;
};

export type OracleSourceQualityProfile = {
  readonly schemaVersion: typeof PRODUCTION_ORACLE_SCHEMA_VERSION;
  readonly formulaVersion: typeof QUALITY_FORMULA_VERSION;
  readonly sourceId: string;
  readonly freshnessBps: number;
  readonly availabilityBps: number;
  readonly historicalConflictRateBps: number;
  readonly schemaValidityBps: number;
  readonly sourceIndependenceBps: number;
  readonly attestationLevelBps: number;
  readonly scoreBps: number;
  readonly qualityClass: QualityClass;
  readonly engineeringGoverned: true;
};

export type ProductionContributionEligibilityPolicy = {
  readonly schemaVersion: typeof PRODUCTION_ORACLE_SCHEMA_VERSION;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly eligibleFeedIds: readonly string[];
  readonly eligibleCategories: readonly DataSourceCategory[];
  readonly minimumProviders: number;
  readonly minimumIndependentControllers: number;
  readonly minimumQualityBps: number;
  readonly maximumFactAgeSeconds: number;
  readonly requireContributionLineage: true;
  readonly requireVerifiedFact: true;
  readonly automaticIssuance: false;
};

export type OracleWorkloadIdentity = {
  readonly schemaVersion: 1;
  readonly collectorId: string;
  readonly assignedSourceIds: readonly string[];
  readonly credentialRefs: Readonly<Record<string, SecretReference>>;
  readonly expiresAtUnix: bigint;
  readonly status: 'ACTIVE' | 'ROTATING' | 'REVOKED';
};

export type ProviderHealthSnapshot = {
  readonly providerId: string;
  readonly collectorHealthy: boolean;
  readonly authenticationOk: boolean;
  readonly latencyUnits: number;
  readonly sourceFresh: boolean;
  readonly sourceErrors: number;
  readonly schemaErrors: number;
  readonly signatureErrors: number;
  readonly quorumAvailable: boolean;
  readonly conflictRateBps: number;
};

export type OracleAlert = {
  readonly kind: OracleAlertKind;
  readonly providerId: string | null;
  readonly feedId: string | null;
  readonly sourceId: string | null;
  readonly detail: string;
  readonly atUnix: bigint;
};

export type PublicOracleFeedMetadata = {
  readonly feedId: string;
  readonly providerCount: number;
  readonly aggregationMethod: AggregationPolicy;
  readonly freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
  readonly qualityClass: QualityClass;
  readonly verifiedFact: string | null;
  readonly credentialsExposed: false;
  readonly commercialTermsExposed: false;
};

export function isOnboardingStatus(value: string): value is OnboardingStatus {
  return (ONBOARDING_STATUSES as readonly string[]).includes(value);
}

export function isAuthenticationMethod(value: string): value is AuthenticationMethod {
  return (AUTHENTICATION_METHODS as readonly string[]).includes(value);
}

export function missingContractIsNeverConfirmed(): false {
  return false;
}

export function consensusMustNotCallExternalApis(): true {
  return true;
}
