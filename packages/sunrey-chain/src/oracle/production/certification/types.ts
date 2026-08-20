/**
 * Chunk 128 — Economic data provider certification types.
 *
 * Certification means a provider/source/feed satisfied specified admission
 * controls. It is not a verified economic fact, productive contribution,
 * economic value, MoonRey quantity, or monetary authorization.
 *
 * No PRODUCTION_APPROVED state. productionAuthorized is always false.
 * Commercial / legal CONFIRMED is never inferred from fixture strings.
 */

import type { FactType, UnitCode } from '../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../productive/types.ts';
import type {
  AuthenticationMethod,
  DataSourceCategory,
  EvidenceConfirmationState,
  QualityClass,
} from '../types.ts';
import { EVIDENCE_CONFIRMATION_STATES, QUALITY_CLASSES } from '../types.ts';

export const CERTIFICATION_SCHEMA_VERSION = 1 as const;
export const CERTIFICATION_POLICY_VERSION = 'sunrey.provider-certification.policy.v1' as const;
export const CERTIFICATION_TEST_SUITE_VERSION = 'sunrey.provider-certification.suite.v1' as const;
export const CERTIFICATION_CONNECTOR_RUNTIME_VERSION = 'sunrey.economic-data-connector.v1' as const;
export const CERTIFICATION_NORMALIZATION_VERSION = 'sunrey.economic-unit.normalization.v1' as const;
export const CERTIFICATION_MAPPING_VERSION = 1 as const;

export const CERTIFICATION_FINALIZES_ORACLE = false as const;
export const CERTIFICATION_CREATES_PRODUCTIVE_CONTRIBUTION = false as const;
export const CERTIFICATION_MINTS_MOONREY = false as const;
export const CERTIFICATION_ACTIVATES_PRODUCTION_INGESTION = false as const;
export const COMMERCIAL_EVIDENCE_FABRICATED = false as const;
export const INDEPENDENT_SECURITY_AUDIT_OCCURRED = false as const;
export const PRODUCTION_SLA_CLAIMED = false as const;
export const AI_CAN_RESTORE_PROVIDER = false as const;
export const PRODUCTION_AUTHORIZED = false as const;

export const CERTIFICATION_STATUSES = [
  'NOT_EVALUATED',
  'ENGINEERING_SANDBOX',
  'CONFORMANCE_PASSED',
  'CONFORMANCE_FAILED',
  'SECURITY_REVIEW_REQUIRED',
  'COMMERCIAL_EVIDENCE_REQUIRED',
  'JURISDICTION_REVIEW_REQUIRED',
  'TESTNET_ADMISSIBLE',
  'PRODUCTION_CANDIDATE',
  'REVALIDATION_REQUIRED',
  'SUSPENDED',
  'REVOKED',
] as const;
export type CertificationStatus = (typeof CERTIFICATION_STATUSES)[number];

export const CONTROL_VERDICTS = ['PASS', 'FAIL', 'REVIEW_REQUIRED'] as const;
export type ControlVerdict = (typeof CONTROL_VERDICTS)[number];

export const SCHEMA_DRIFT_KINDS = [
  'MISSING_FIELD',
  'RENAMED_FIELD',
  'TYPE_CHANGE',
  'UNIT_CHANGE',
  'IDENTIFIER_CHANGE',
  'ARRAY_EXPLOSION',
  'TIMESTAMP_SEMANTIC_CHANGE',
  'UNSUPPORTED_VERSION',
] as const;
export type SchemaDriftKind = (typeof SCHEMA_DRIFT_KINDS)[number];

export const REVALIDATION_TRIGGERS = [
  'SCHEMA_DRIFT',
  'PERSISTENT_STALENESS',
  'SIGNATURE_FAILURES',
  'PROVIDER_CONCENTRATION_CHANGE',
  'AUTH_FAILURES',
  'QUALITY_COLLAPSE',
] as const;
export type RevalidationTrigger = (typeof REVALIDATION_TRIGGERS)[number];

export const EXPIRY_REASONS = [
  'SCHEMA_VERSION_CHANGE',
  'UNIT_CHANGE',
  'ENDPOINT_CHANGE',
  'AUTH_METHOD_CHANGE',
  'CONNECTOR_RUNTIME_MAJOR_CHANGE',
  'SECURITY_POLICY_CHANGE',
  'SOURCE_CONTROLLER_CHANGE',
  'ELAPSED_PERIOD',
] as const;
export type ExpiryReason = (typeof EXPIRY_REASONS)[number];

export { EVIDENCE_CONFIRMATION_STATES, QUALITY_CLASSES };
export type { EvidenceConfirmationState, QualityClass, AuthenticationMethod, DataSourceCategory };

export type ControlResult = {
  readonly controlId: string;
  readonly verdict: ControlVerdict;
  readonly detail: string;
};

export type SchemaConformanceResult = {
  readonly verdict: ControlVerdict;
  readonly authenticationOk: boolean;
  readonly endpointApproved: boolean;
  readonly responseBounded: boolean;
  readonly contentTypeOk: boolean;
  readonly schemaValid: boolean;
  readonly identifiersValid: boolean;
  readonly sourceTimestampPresent: boolean;
  readonly driftKinds: readonly SchemaDriftKind[];
  readonly details: readonly string[];
};

export type UnitConformanceResult = {
  readonly verdict: ControlVerdict;
  readonly unitKnown: boolean;
  readonly dimensionCompatible: boolean;
  readonly contextSatisfied: boolean;
  readonly semanticsUnambiguous: boolean;
  readonly canonicalNormalizationOk: boolean;
  readonly details: readonly string[];
};

export type TaxonomyConformanceResult = {
  readonly verdict: ControlVerdict;
  readonly mappingId: string | null;
  readonly mappingVersion: number | null;
  readonly compatible: boolean;
  readonly details: readonly string[];
};

export type ProvenanceConformanceResult = {
  readonly verdict: ControlVerdict;
  readonly requiredFieldsPresent: boolean;
  readonly credentialMaterialAbsent: true;
  readonly contentHashDeterministic: boolean;
  readonly details: readonly string[];
};

export type SecurityConformanceResult = {
  readonly verdict: ControlVerdict;
  readonly endpointAllowlisted: boolean;
  readonly httpsTlsOk: boolean;
  readonly authenticationClassOk: boolean;
  readonly secretIsolated: boolean;
  readonly redirectPolicyOk: boolean;
  readonly ssrfPolicyOk: boolean;
  readonly responseBoundsOk: boolean;
  readonly timeoutPolicyOk: boolean;
  readonly retryPolicyOk: boolean;
  readonly rateLimitOk: boolean;
  readonly circuitBreakerOk: boolean;
  readonly independentAuditClaimed: false;
  readonly details: readonly string[];
};

export type FreshnessConformanceResult = {
  readonly verdict: ControlVerdict;
  readonly stale: boolean;
  readonly ageSeconds: number;
  readonly details: readonly string[];
};

export type ReliabilityProfile = {
  readonly sandboxMetricsOnly: true;
  readonly productionSlaClaimed: false;
  readonly availabilityBps: number;
  readonly schemaValidityBps: number;
  readonly freshnessBps: number;
  readonly authSuccessBps: number;
  readonly timeoutBps: number;
  readonly conflictBps: number;
  readonly rateLimitEvents: number;
  readonly latencyP50Ms: number;
  readonly latencyP95Ms: number;
  readonly observationCount: number;
};

export type IndependenceConformanceResult = {
  readonly verdict: ControlVerdict;
  readonly independentControllerCount: number;
  readonly sharedControllerFeeds: readonly string[];
  readonly fakeQuorum: boolean;
  readonly details: readonly string[];
};

export type CertificationEvidenceStates = {
  readonly commercialEvidenceState: EvidenceConfirmationState;
  readonly dataLicenseState: EvidenceConfirmationState;
  readonly usageRightsState: EvidenceConfirmationState;
  readonly jurisdictionReviewState: EvidenceConfirmationState;
  readonly securityReviewState: EvidenceConfirmationState;
};

export type ConnectorRuntimeSnapshot = {
  readonly runtimeVersion: string;
  readonly runtimeMajorVersion: number;
  readonly endpointUrl: string;
  readonly endpointAllowlisted: boolean;
  readonly protocol: 'HTTPS' | 'HTTP' | 'FILE_FIXTURE';
  readonly tlsValidated: boolean;
  readonly authenticationClass: AuthenticationMethod;
  readonly authenticationSucceeded: boolean;
  readonly secretIsolated: boolean;
  readonly redirectedTo: string | null;
  readonly redirectAllowed: boolean;
  readonly ssrfAttempted: boolean;
  readonly ssrfBlocked: boolean;
  readonly contentType: string;
  readonly approvedContentType: string;
  readonly responseBytes: number;
  readonly maxResponseBytes: number;
  readonly timeoutMs: number;
  readonly timeoutBudgetMs: number;
  readonly timedOut: boolean;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly rateLimitEvents: number;
  readonly circuitBreakerOpen: boolean;
  readonly approvedEndpointProfile: boolean;
};

export type SandboxObservation = {
  readonly identifier: string;
  readonly numericValue: string;
  readonly unit: string;
  readonly sourceTimestampUnix: string;
  readonly collectionTimestampUnix: string;
  readonly sourceObservationId: string;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly contentType: string;
  readonly responseBytes: number;
  readonly extras?: Readonly<Record<string, unknown>> | undefined;
  readonly leakedCredentialField?: string | undefined;
  readonly timestampSemantic?: 'SOURCE_EVENT' | 'INGESTION' | 'UNKNOWN' | undefined;
};

export type CertificationSubject = {
  readonly providerId: string;
  readonly sourceId: string;
  readonly feedId: string;
  readonly sourceCategory: DataSourceCategory;
  readonly factType: FactType;
  readonly productiveCategory: ProductiveCategory | null;
  readonly claimType: ClaimType | null;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly unit: UnitCode;
  readonly normalizationVersion: string;
  readonly mappingVersion: number;
  readonly connectorRuntimeVersion: string;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
  readonly relatedFeeds: readonly RelatedFeedIdentity[];
  readonly connector: ConnectorRuntimeSnapshot;
  readonly observations: readonly SandboxObservation[];
  readonly evidence: CertificationEvidenceStates;
  readonly prior?: PriorCertificationFingerprint | null | undefined;
  readonly nowUnix: bigint;
  readonly createdAtUnix?: bigint | undefined;
};

export type RelatedFeedIdentity = {
  readonly feedId: string;
  readonly sourceId: string;
  readonly providerId: string;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
};

export type PriorCertificationFingerprint = {
  readonly certificationId: string;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly unit: string;
  readonly endpointUrl: string;
  readonly authenticationClass: AuthenticationMethod;
  readonly connectorRuntimeMajorVersion: number;
  readonly securityPolicyVersion: string;
  readonly controllerId: string;
  readonly createdAtUnix: bigint;
  readonly expiresAtUnix: bigint;
  readonly requiredFields: readonly string[];
};

export type CertificationPolicy = {
  readonly policyVersion: typeof CERTIFICATION_POLICY_VERSION;
  readonly testSuiteVersion: typeof CERTIFICATION_TEST_SUITE_VERSION;
  readonly maximumObservationAgeSeconds: number;
  readonly maximumResponseBytes: number;
  readonly maximumArrayLength: number;
  readonly certificationTtlSeconds: number;
  readonly minimumQualityBps: number;
  readonly minimumIndependentControllers: number;
  readonly allowTestnetWithoutCommercialEvidence: boolean;
  readonly requireSecurityEvidenceForProduction: boolean;
  readonly requireCommercialEvidenceForProduction: boolean;
  readonly requireDataLicenseForProduction: boolean;
  readonly requireUsageRightsForProduction: boolean;
  readonly requireJurisdictionForProduction: boolean;
  readonly securityPolicyVersion: string;
  readonly approvedContentType: string;
  readonly identifierPattern: string;
  readonly requiredProvenanceFields: readonly string[];
};

export type TechnicalConformanceBundle = {
  readonly schema: SchemaConformanceResult;
  readonly unit: UnitConformanceResult;
  readonly taxonomy: TaxonomyConformanceResult;
  readonly provenance: ProvenanceConformanceResult;
  readonly freshness: FreshnessConformanceResult;
};

export type EconomicDataSourceCertificationRecord = {
  readonly schemaVersion: typeof CERTIFICATION_SCHEMA_VERSION;
  readonly certificationId: string;
  readonly providerId: string;
  readonly sourceId: string;
  readonly feedId: string;
  readonly sourceCategory: DataSourceCategory;
  readonly factType: FactType;
  readonly productiveCategory: ProductiveCategory | null;
  readonly schemaId: string;
  readonly schemaVersionRecord: number;
  readonly unit: UnitCode;
  readonly normalizationVersion: string;
  readonly mappingVersion: number;
  readonly connectorRuntimeVersion: string;
  readonly testSuiteVersion: typeof CERTIFICATION_TEST_SUITE_VERSION;
  readonly certificationPolicyVersion: typeof CERTIFICATION_POLICY_VERSION;
  readonly technicalResults: TechnicalConformanceBundle;
  readonly securityResults: SecurityConformanceResult;
  readonly schemaResults: SchemaConformanceResult;
  readonly unitResults: UnitConformanceResult;
  readonly provenanceResults: ProvenanceConformanceResult;
  readonly freshnessResults: FreshnessConformanceResult;
  readonly reliabilityResults: ReliabilityProfile;
  readonly independenceResults: IndependenceConformanceResult;
  readonly commercialEvidenceState: EvidenceConfirmationState;
  readonly dataLicenseState: EvidenceConfirmationState;
  readonly usageRightsState: EvidenceConfirmationState;
  readonly jurisdictionReviewState: EvidenceConfirmationState;
  readonly securityReviewState: EvidenceConfirmationState;
  readonly qualityClass: QualityClass;
  readonly qualityScoreBps: number;
  readonly status: CertificationStatus;
  readonly evidenceDigest: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly createdAtUnix: bigint;
  readonly expiresAtUnix: bigint;
  readonly productionAuthorized: false;
  readonly finalizesOracleFact: false;
  readonly createsProductiveContribution: false;
  readonly mintsMoonRey: false;
  readonly commercialEvidenceFabricated: false;
  readonly supersededBy: string | null;
  readonly supersedes: string | null;
};

export type ProviderConformanceReport = {
  readonly schemaVersion: typeof CERTIFICATION_SCHEMA_VERSION;
  readonly certificationId: string;
  readonly providerId: string;
  readonly sourceId: string;
  readonly feedId: string;
  readonly status: CertificationStatus;
  readonly controls: readonly ControlResult[];
  readonly missingEvidence: readonly string[];
  readonly warnings: readonly string[];
  readonly blockingFailures: readonly string[];
  readonly testnetAdmissible: boolean;
  readonly productionCandidate: boolean;
  readonly productionAuthorized: false;
  readonly commercialEvidenceFabricated: false;
  readonly certificationFinalizesOracle: false;
  readonly certificationMintsMoonRey: false;
  readonly independentAuditClaimed: false;
  readonly humanReadable: string;
};

export function defaultCertificationPolicy(): CertificationPolicy {
  return Object.freeze({
    policyVersion: CERTIFICATION_POLICY_VERSION,
    testSuiteVersion: CERTIFICATION_TEST_SUITE_VERSION,
    maximumObservationAgeSeconds: 3_600,
    maximumResponseBytes: 8_192,
    maximumArrayLength: 32,
    certificationTtlSeconds: 7_776_000,
    minimumQualityBps: 6_000,
    minimumIndependentControllers: 2,
    allowTestnetWithoutCommercialEvidence: true,
    requireSecurityEvidenceForProduction: true,
    requireCommercialEvidenceForProduction: true,
    requireDataLicenseForProduction: true,
    requireUsageRightsForProduction: true,
    requireJurisdictionForProduction: true,
    securityPolicyVersion: 'sunrey.oracle.security-conformance.v1',
    approvedContentType: 'application/json',
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    requiredProvenanceFields: Object.freeze([
      'providerId',
      'sourceId',
      'sourceObservationId',
      'collectionTime',
      'sourceTime',
      'schemaVersion',
      'unit',
      'normalizationVersion',
      'collectorVersion',
      'contentHash',
    ]),
  });
}

export function emptyEvidenceStates(): CertificationEvidenceStates {
  return Object.freeze({
    commercialEvidenceState: 'NOT_PROVIDED',
    dataLicenseState: 'NOT_PROVIDED',
    usageRightsState: 'NOT_PROVIDED',
    jurisdictionReviewState: 'NOT_PROVIDED',
    securityReviewState: 'NOT_PROVIDED',
  });
}

export function isCertificationStatus(value: string): value is CertificationStatus {
  return (CERTIFICATION_STATUSES as readonly string[]).includes(value);
}

export function certificationNeverApprovesProduction(): false {
  return PRODUCTION_AUTHORIZED;
}

export function certificationDoesNotFinalizeOracle(): false {
  return CERTIFICATION_FINALIZES_ORACLE;
}

export function certificationDoesNotCreateProductiveContribution(): false {
  return CERTIFICATION_CREATES_PRODUCTIVE_CONTRIBUTION;
}

export function certificationDoesNotMintMoonRey(): false {
  return CERTIFICATION_MINTS_MOONREY;
}

export function commercialEvidenceIsNeverFabricated(): false {
  return COMMERCIAL_EVIDENCE_FABRICATED;
}

export function aiCannotRestoreProvider(): false {
  return AI_CAN_RESTORE_PROVIDER;
}
