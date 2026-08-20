import type { SecretReference } from '../../../../security/src/secrets.ts';
import type { ScreeningOutcome } from '../types.ts';

export const COMPLIANCE_PROVIDER_CAPABILITIES = [
  'SANCTIONS',
  'PEP',
  'ADVERSE_MEDIA',
  'TRANSACTION_MONITORING',
  'FRAUD',
  'DEVICE_RISK',
  'CASE_MANAGEMENT',
] as const;
export type ComplianceProviderCapability = (typeof COMPLIANCE_PROVIDER_CAPABILITIES)[number];

export const REGULATED_SCREENING_WORKLOAD = 'screening_worker' as const;
export const REGULATED_CASE_WORKLOAD = 'case_management' as const;

export const COMPLIANCE_TRANSPORT_SCENARIOS = [
  'ok',
  'clear',
  'potential_match',
  'confirmed_match',
  'manual_review',
  'unavailable',
  'timeout',
  'schema_error',
  'auth_failure',
  'unknown',
  'score_overflow',
  'confidence_float',
  'invalid_clear',
] as const;
export type ComplianceTransportScenario = (typeof COMPLIANCE_TRANSPORT_SCENARIOS)[number];

export type ComplianceProviderResidency = {
  readonly supportedRegion: string;
  readonly deployedRegion: string;
  readonly configuredResidencyConstraint: string;
  readonly dataClass: 'COMPLIANCE_METADATA';
  readonly dpaRef: string | null;
  readonly jurisdictionReviewRef: string | null;
  readonly cloudRegionDoesNotProveAdequacy: true;
};

export type ComplianceProviderCandidateProfile = {
  readonly providerId: string;
  readonly version: string;
  readonly capabilities: readonly ComplianceProviderCapability[];
  readonly credentialDescriptorRef: string;
  readonly endpointProfileRef: string;
  readonly supportedJurisdictions: readonly string[];
  readonly providerAcceptanceRef: string | null;
  readonly dataProcessingAgreementRef: string | null;
  readonly securityEvidenceRef: string | null;
  readonly jurisdictionEvidenceRef: string | null;
  readonly retentionPolicyRef: string | null;
  readonly residency: ComplianceProviderResidency;
  readonly retentionDefault: 'NORMALIZED_RESULT';
  readonly productionAuthorized: false;
  readonly liveVendorConnected: false;
};

export type RawComplianceVendorResponse = {
  readonly scenario: ComplianceTransportScenario;
  readonly vendorOutcome?: string;
  readonly vendorScore?: number | string;
  readonly vendorConfidence?: number | string;
  readonly articleBody?: string;
  readonly matchRef?: string;
};

export type ComplianceScoreInterpretation = {
  readonly score: number | null;
  readonly confidence: number | null;
  readonly isKernelDecision: false;
  readonly isCreditScore: false;
  readonly isHumanWorth: false;
  readonly isPeve: false;
  readonly isSunReyValuation: false;
};

export type ComplianceCredentialBinding = {
  readonly providerId: string;
  readonly credentialRef: SecretReference;
  readonly credentialDescriptorRef: string;
  readonly workloadIdentity: typeof REGULATED_SCREENING_WORKLOAD | typeof REGULATED_CASE_WORKLOAD;
  readonly crossWorkloadReuseRejected: true;
  readonly plaintextCredentialPresent: false;
};

export type ExternalCaseRecord = {
  readonly externalCaseId: string;
  readonly status: string;
  readonly assigneeRef: string | null;
  readonly evidenceRefs: readonly string[];
};

export const FAIL_CLOSED_OUTCOMES: readonly ScreeningOutcome[] = Object.freeze([
  'UNAVAILABLE',
  'HOLD',
  'REVIEW',
]);
