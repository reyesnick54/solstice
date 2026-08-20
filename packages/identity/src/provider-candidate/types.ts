import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SecretReference } from '../../../security/src/secrets.ts';

export const IDENTITY_PROVIDER_CAPABILITIES = [
  'PERSON_VERIFICATION',
  'DOCUMENT_VERIFICATION',
  'LIVENESS',
  'BUSINESS_VERIFICATION',
  'BENEFICIAL_OWNERSHIP',
  'DEVICE_RISK',
] as const;
export type IdentityProviderCapability = (typeof IDENTITY_PROVIDER_CAPABILITIES)[number];

export const REGULATED_IDENTITY_WORKLOAD = 'kyc_worker' as const;

export const IDENTITY_RETENTION_MODES = [
  'REFERENCE_ONLY',
  'COMMITMENT_ONLY',
  'NORMALIZED_RESULT',
  'SHORT_LIVED_RAW_QUARANTINE',
] as const;
export type IdentityRetentionMode = (typeof IDENTITY_RETENTION_MODES)[number];

export const IDENTITY_DATA_CLASSES = ['IDENTITY_METADATA', 'GOVERNMENT_ID', 'BIOMETRIC'] as const;
export type IdentityDataClass = (typeof IDENTITY_DATA_CLASSES)[number];

export type IdentityProviderResidency = {
  readonly supportedRegion: string;
  readonly deployedRegion: string;
  readonly configuredResidencyConstraint: string;
  readonly dataClass: IdentityDataClass;
  readonly dpaRef: string | null;
  readonly jurisdictionReviewRef: string | null;
  readonly cloudRegionDoesNotProveAdequacy: true;
};

export type IdentityProviderCandidateProfile = {
  readonly providerId: string;
  readonly version: string;
  readonly capabilities: readonly IdentityProviderCapability[];
  readonly credentialDescriptorRef: string;
  readonly endpointProfileRef: string;
  readonly supportedJurisdictions: readonly string[];
  readonly providerAcceptanceRef: string | null;
  readonly dataProcessingAgreementRef: string | null;
  readonly securityEvidenceRef: string | null;
  readonly jurisdictionEvidenceRef: string | null;
  readonly retentionPolicyRef: string | null;
  readonly residency: IdentityProviderResidency;
  readonly retentionDefault: IdentityRetentionMode;
  readonly productionAuthorized: false;
  readonly liveVendorConnected: false;
};

export type IdentityProviderExternalEvidence = {
  readonly serviceContractRef: string | null;
  readonly dataProcessingAgreementRef: string | null;
  readonly securityReviewRef: string | null;
  readonly jurisdictionReviewRef: string | null;
  readonly licenseRegistrationRef: string | null;
  readonly slaContinuityRef: string | null;
  readonly humanAcceptanceRef: string | null;
};

export type IdentityCredentialBinding = {
  readonly providerId: string;
  readonly credentialRef: SecretReference;
  readonly credentialDescriptorRef: string;
  readonly workloadIdentity: typeof REGULATED_IDENTITY_WORKLOAD;
  readonly crossWorkloadReuseRejected: true;
  readonly plaintextCredentialPresent: false;
};

/**
 * Vendor payload that never leaves the candidate adapter.
 * Images, selfies, and biometric templates are rejected, not stored.
 */
export type RawIdentityVendorResponse = {
  readonly scenario: IdentityTransportScenario;
  readonly vendorOutcome?: string;
  readonly vendorReason?: string;
  readonly vendorScore?: number | string;
  readonly documentImage?: string;
  readonly selfieImage?: string;
  readonly livenessVideo?: string;
  readonly biometricTemplate?: string;
  readonly articleBody?: string;
};

export const IDENTITY_TRANSPORT_SCENARIOS = [
  'ok',
  'timeout',
  'schema_drift',
  'unavailable',
  'auth_failure',
  'verified',
] as const;
export type IdentityTransportScenario = (typeof IDENTITY_TRANSPORT_SCENARIOS)[number];

export type IdentityNormalizedStoreRecord = {
  readonly providerRef: string;
  readonly outcome: 'VERIFIED' | 'FAILED' | 'IN_PROGRESS';
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly evidenceCommitment: string;
  readonly observedAt: UtcInstant;
  readonly rawDocumentPersisted: false;
  readonly biometricPersisted: false;
  readonly rawVendorResponsePersisted: false;
};

export const HUMAN_REVIEWER_ROLES = [
  'COUNSEL_REVIEWER',
  'SECURITY_REVIEWER',
  'OPERATIONS_REVIEWER',
  'COMMERCIAL_REVIEWER',
] as const;
export type HumanReviewerRole = (typeof HUMAN_REVIEWER_ROLES)[number];

export type ReviewActorKind = 'HUMAN_OPERATOR' | 'AI' | 'S3M' | 'GROK';
