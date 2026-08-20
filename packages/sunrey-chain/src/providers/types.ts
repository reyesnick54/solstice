/**
 * Chunk 82 — production provider acceptance types.
 *
 * This is an evidence-driven engineering control plane for later
 * onboarding of real external providers. Presence of a slot is not
 * proof. Configured is not approved. Technical success is not a
 * contract, license, or commercial right.
 */

export const PROVIDER_ACCEPTANCE_SCHEMA_VERSION = 1 as const;
export const PROVIDER_ACCEPTANCE_TOOL_VERSION = 'sunrey-provider-acceptance/1' as const;

export const PROVIDER_DOMAINS = [
  'CLOUD_INFRASTRUCTURE',
  'SECRET_MANAGER',
  'KMS',
  'HSM',
  'DATABASE',
  'OBJECT_STORAGE',
  'DNS',
  'CERTIFICATE_MANAGER',
  'ORACLE_DATA_SOURCE',
  'IDENTITY_KYC',
  'SANCTIONS_PEP',
  'AML_TRANSACTION_MONITORING',
  'TRAVEL_RULE',
  'MARKET_SURVEILLANCE',
  'CASE_MANAGEMENT',
  'CUSTODY_PROVIDER',
  'BANKING_REFERENCE',
  'PAYMENT_RAIL',
  'FX_LIQUIDITY',
  'OTHER_GOVERNED_EXTERNAL_PROVIDER',
] as const;
export type ProviderDomain = (typeof PROVIDER_DOMAINS)[number];

export const ACCEPTANCE_STATES = [
  'NOT_CONFIGURED',
  'CONFIGURED_UNVERIFIED',
  'ENGINEERING_TESTED',
  'EXTERNAL_EVIDENCE_REQUIRED',
  'EXTERNAL_EVIDENCE_PROVIDED',
  'HUMAN_ACCEPTED',
  'PRODUCTION_ELIGIBLE',
] as const;
export type AcceptanceState = (typeof ACCEPTANCE_STATES)[number];

export const EVIDENCE_CLASSES = [
  'SERVICE_CONTRACT',
  'SECURITY_ASSESSMENT',
  'SOC_ISO_OR_EQUIVALENT',
  'PENETRATION_TEST',
  'HSM_ATTESTATION',
  'KEY_MANAGEMENT',
  'DATA_PROCESSING_AGREEMENT',
  'DATA_LICENSE_AGREEMENT',
  'SERVICE_LEVEL_AGREEMENT',
  'BUSINESS_CONTINUITY',
  'JURISDICTION',
  'LICENSE_REGISTRATION',
  'HUMAN_APPROVAL',
] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export const EVIDENCE_VERIFICATION_STATES = [
  'MISSING',
  'REFERENCED',
  'DIGEST_RECORDED',
  'STALE',
  'HUMAN_REVIEWED',
] as const;
export type EvidenceVerificationState = (typeof EVIDENCE_VERIFICATION_STATES)[number];

export const CANONICAL_REGISTRY_KINDS = [
  'PRODUCTION_INFRASTRUCTURE',
  'ORACLE_PROVIDER',
  'REGULATED_SERVICE',
  'SECURITY_HSM',
] as const;
export type CanonicalRegistryKind = (typeof CANONICAL_REGISTRY_KINDS)[number];

export const PROVIDER_DATA_CLASSES = [
  'PUBLIC_CHAIN_DATA',
  'IDENTITY_DATA',
  'KYC_DATA',
  'PAYMENT_DATA',
  'CUSTODY_METADATA',
  'ORACLE_PUBLIC_DATA',
  'CONFIDENTIAL_OPERATIONS_DATA',
] as const;
export type ProviderDataClass = (typeof PROVIDER_DATA_CLASSES)[number];

export const REVIEWER_KINDS = ['HUMAN', 'AI'] as const;
export type ReviewerKind = (typeof REVIEWER_KINDS)[number];

export const HUMAN_REVIEWER_ROLES = [
  'SECURITY_REVIEWER',
  'OPERATIONS_REVIEWER',
  'COUNSEL_REVIEWER',
  'COMMERCIAL_REVIEWER',
] as const;
export type HumanReviewerRole = (typeof HUMAN_REVIEWER_ROLES)[number];

export const PQC_ALGORITHMS = ['ED25519', 'ML_DSA', 'ML_KEM', 'SLH_DSA', 'HYBRID'] as const;
export type PqcAlgorithm = (typeof PQC_ALGORITHMS)[number];

export const PQC_HARDWARE_STATES = [
  'SOFTWARE_ONLY',
  'HARDWARE_UNCONFIRMED',
  'HARDWARE_EVIDENCE_REQUIRED',
  'HARDWARE_CONFIRMED',
] as const;
export type PqcHardwareState = (typeof PQC_HARDWARE_STATES)[number];

export const OUTAGE_SCENARIOS = [
  'PROVIDER_UNAVAILABLE',
  'CREDENTIAL_INVALID',
  'TLS_FAILURE',
  'RATE_LIMIT',
  'TIMEOUT',
  'SCHEMA_CHANGE',
  'PARTIAL_DEGRADATION',
] as const;
export type OutageScenario = (typeof OUTAGE_SCENARIOS)[number];

export const OUTAGE_POSTURES = ['FAIL_CLOSED', 'DEGRADED'] as const;
export type OutagePosture = (typeof OUTAGE_POSTURES)[number];

export type ProviderAcceptanceResultKind = 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'EXTERNAL_REQUIRED';

export type ProviderExternalRegistryQuery = {
  readonly evidenceClass: string;
  readonly subjectType?: string;
  readonly subjectId?: string;
  readonly jurisdiction?: string;
  readonly providerDomain?: ProviderDomain;
  readonly nowUtc: string;
  readonly production?: boolean;
};

export type ProviderExternalRegistryPort = {
  readonly productionEligible: (query: ProviderExternalRegistryQuery) => boolean;
};

export type ProviderAcceptanceError = {
  readonly code: string;
  readonly message: string;
};

export type ProviderAcceptanceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProviderAcceptanceError };

export function acceptanceOk<T>(value: T): ProviderAcceptanceResult<T> {
  return { ok: true, value };
}

export function acceptanceErr(code: string, message: string): ProviderAcceptanceResult<never> {
  return { ok: false, error: { code, message } };
}

export type CrossDomainProviderReference = {
  readonly domain: ProviderDomain;
  readonly providerId: string;
  readonly registry: CanonicalRegistryKind;
  readonly canonicalRecordId: string;
  readonly isCopy: false;
};

export type ExternalProviderEvidenceRecord = {
  readonly recordId: string;
  readonly providerId: string;
  readonly evidenceClass: EvidenceClass;
  readonly documentOrReferenceId: string;
  readonly issuerOrSource: string;
  readonly issuedAtUtc: string | null;
  readonly expiresAtUtc: string | null;
  readonly contentDigest: string | null;
  readonly verificationState: EvidenceVerificationState;
  readonly humanReviewer: string | null;
  readonly humanReviewerRole: HumanReviewerRole | null;
  readonly scope: string;
  readonly confidentialContentOnPublicChain: false;
  readonly slotPresenceIsProof: false;
};

export type ProviderCapabilityAttestation = {
  readonly capability: string;
  readonly supported: boolean;
  readonly inferred: false;
  readonly evidenceSource: string;
  readonly hardwareBound: boolean;
};

export type ProviderSecurityProfile = {
  readonly providerId: string;
  readonly authenticationMethods: readonly string[];
  readonly leastPrivilegeVerified: boolean;
  readonly mTlsSupported: boolean;
  readonly auditEventsSupported: boolean;
  readonly secretMaterialInProfile: false;
};

export type ProviderOperationalProfile = {
  readonly providerId: string;
  readonly healthEndpoint: boolean;
  readonly logging: boolean;
  readonly monitoring: boolean;
  readonly credentialRotation: boolean;
  readonly failureDomains: readonly string[];
};

export type ProviderDataResidencyProfile = {
  readonly providerId: string;
  readonly deploymentRegions: readonly string[];
  readonly configuredResidencyConstraints: readonly string[];
  readonly legalConclusion: false;
  readonly jurisdictionalReviewEvidenceId: string | null;
};

export type ProviderContinuityProfile = {
  readonly providerId: string;
  readonly rtoTargetMs: number | null;
  readonly rpoTargetMs: number | null;
  readonly backupRecoveryCapability: boolean;
  readonly regionalFailover: boolean;
  readonly dependencyChain: readonly string[];
  readonly tested: boolean;
  readonly claimSource: string;
  readonly engineeringClaimOnly: true;
};

export type ExternalProviderAcceptanceProfile = {
  readonly domain: ProviderDomain;
  readonly requiredCapabilities: readonly string[];
  readonly requiredEvidenceClasses: readonly EvidenceClass[];
  readonly requiredHumanReviewerRole: HumanReviewerRole;
  readonly canonicalRegistry: CanonicalRegistryKind | null;
  readonly dataClasses: readonly ProviderDataClass[];
  readonly notes: string;
};

export type ProviderAcceptanceTestCase = {
  readonly caseId: string;
  readonly domain: ProviderDomain;
  readonly name: string;
  readonly destructive: false;
  readonly outcome: ProviderAcceptanceResultKind;
  readonly detail: string;
};

export type ProviderAcceptanceTestSuite = {
  readonly suiteId: string;
  readonly domain: ProviderDomain;
  readonly providerId: string;
  readonly cases: readonly ProviderAcceptanceTestCase[];
  readonly passed: boolean;
  readonly engineeringTested: boolean;
};

export type ProviderAcceptanceResultRecord = {
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly configured: boolean;
  readonly engineeringTested: boolean;
  readonly externalEvidenceSatisfied: boolean;
  readonly humanAccepted: boolean;
  readonly productionEligible: boolean;
  readonly state: AcceptanceState;
  readonly expirationWarnings: readonly string[];
  readonly capabilities: readonly ProviderCapabilityAttestation[];
};

export type ProviderAcceptanceReport = {
  readonly schemaVersion: typeof PROVIDER_ACCEPTANCE_SCHEMA_VERSION;
  readonly toolVersion: typeof PROVIDER_ACCEPTANCE_TOOL_VERSION;
  readonly generatedAtUtc: string;
  readonly technicalAcceptance: boolean;
  readonly securityEvidence: boolean;
  readonly commercialEvidence: boolean;
  readonly legalRegulatoryEvidence: boolean;
  readonly humanAcceptance: boolean;
  readonly productionEligible: false | true;
  readonly secretValuePresent: false;
  readonly results: readonly ProviderAcceptanceResultRecord[];
  readonly reportDigest: string;
};

export type ProviderProductionEligibilityEvaluation = {
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly state: AcceptanceState;
  readonly productionEligible: boolean;
  readonly configuredEqualsApproved: false;
  readonly missingRequirements: readonly string[];
  readonly derivedFromConfiguredRequirements: true;
};

export type ProductionProviderMatrixRow = {
  readonly domain: ProviderDomain;
  readonly providerId: string;
  readonly configured: boolean;
  readonly engineeringTested: boolean;
  readonly externalEvidence: boolean;
  readonly humanAccepted: boolean;
  readonly productionEligible: boolean;
  readonly expirationWarnings: readonly string[];
  readonly capabilities: readonly string[];
};

export type ProductionProviderMatrix = {
  readonly schemaVersion: typeof PROVIDER_ACCEPTANCE_SCHEMA_VERSION;
  readonly rows: readonly ProductionProviderMatrixRow[];
  readonly anyProductionEligible: boolean;
  readonly secretValuePresent: false;
  readonly matrixDigest: string;
};

export type ProviderReplacementPlan = {
  readonly fromProviderId: string;
  readonly toProviderId: string;
  readonly domain: ProviderDomain;
  readonly compatible: boolean;
  readonly canonicalProtocolAuthorityUnchanged: true;
  readonly evidenceRequired: readonly EvidenceClass[];
  readonly governed: true;
};

export type ProviderConcentrationReport = {
  readonly providerConcentration: number;
  readonly regionConcentration: number;
  readonly controllerConcentration: number;
  readonly dualProviderConfigured: boolean;
};

export function isProviderDomain(value: string): value is ProviderDomain {
  return (PROVIDER_DOMAINS as readonly string[]).includes(value);
}

export function isAcceptanceState(value: string): value is AcceptanceState {
  return (ACCEPTANCE_STATES as readonly string[]).includes(value);
}
