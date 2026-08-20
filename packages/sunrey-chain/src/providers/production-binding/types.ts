/**
 * Chunk 162 — production provider binding types.
 *
 * A binding records which real-world provider WOULD serve a production
 * domain, using which environment, endpoint profile, credential
 * reference, contract evidence, jurisdictions, data classes, failover
 * provider, and operational owner — without contacting that provider.
 *
 * Connectivity stays disabled. There is no LIVE state.
 */

import type { SecretReference } from '../../../../security/src/secrets.ts';
import type { CredentialOperation, ProviderCredentialDescriptor } from '../../../../security/src/regulated/credentials/types.ts';
import type { EvidenceClass, ProviderAcceptanceResultRecord, ProviderDataClass, ProviderDomain } from '../types.ts';

export const PRODUCTION_PROVIDER_BINDING_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_PROVIDER_BINDING_ID = 'sunrey-production-provider-binding' as const;
export const PRODUCTION_PROVIDER_BINDING_TOOL_VERSION = 'sunrey-ops/provider-binding/1' as const;

export const BINDING_ENVIRONMENT_CLASSES = ['SANDBOX', 'CERTIFICATION', 'PRODUCTION_CANDIDATE'] as const;
export type BindingEnvironmentClass = (typeof BINDING_ENVIRONMENT_CLASSES)[number];

export const BINDING_STATES = [
  'DRAFT',
  'ENGINEERING_BOUND',
  'EXTERNAL_EVIDENCE_REQUIRED',
  'OPERATING_SCOPE_REQUIRED',
  'HUMAN_ACCEPTANCE_REQUIRED',
  'PRODUCTION_BINDING_CANDIDATE',
  'SUSPENDED',
  'EXPIRED',
  'REVOKED',
] as const;
export type ProductionBindingState = (typeof BINDING_STATES)[number];

export const BINDING_ENDPOINT_SCHEMES = ['https'] as const;
export type BindingEndpointScheme = (typeof BINDING_ENDPOINT_SCHEMES)[number];

export const BINDING_TLS_POLICIES = ['TLS_1_2_PLUS', 'TLS_1_3'] as const;
export type BindingTlsPolicy = (typeof BINDING_TLS_POLICIES)[number];

export const BINDING_REDIRECT_POLICIES = ['DENY', 'SAME_HOST_ONLY'] as const;
export type BindingRedirectPolicy = (typeof BINDING_REDIRECT_POLICIES)[number];

export const BINDING_CERTIFICATE_EXPECTATIONS = ['PINNED', 'PUBLIC_CA', 'MTLS_REQUIRED'] as const;
export type BindingCertificateExpectation = (typeof BINDING_CERTIFICATE_EXPECTATIONS)[number];

export const WEBHOOK_PROFILE_KINDS = [
  'PAYMENT_CALLBACK',
  'KYC_CALLBACK',
  'TRAVEL_RULE_ACKNOWLEDGEMENT',
  'CUSTODY_TRANSACTION_STATUS',
] as const;
export type WebhookProfileKind = (typeof WEBHOOK_PROFILE_KINDS)[number];

export const EXTERNAL_EVIDENCE_STATUSES = ['CURRENT', 'EXPIRED', 'REVOKED', 'MISSING'] as const;
export type ExternalEvidenceStatus = (typeof EXTERNAL_EVIDENCE_STATUSES)[number];

export const BINDING_FAILURE_CODES = [
  'RAW_SECRET_REJECTED',
  'SANDBOX_CREDENTIAL_CANNOT_SATISFY_PRODUCTION',
  'SANDBOX_AND_PRODUCTION_ELIGIBLE_FORBIDDEN',
  'ENDPOINT_PROFILE_REQUIRED',
  'ENDPOINT_PROFILE_INVALID',
  'EXPIRED_EXTERNAL_EVIDENCE',
  'REVOKED_EXTERNAL_EVIDENCE',
  'OPERATING_SCOPE_MISMATCH',
  'UNSUPPORTED_DATA_CLASS',
  'PROVIDER_ACCEPTANCE_REQUIRED',
  'FAILOVER_NOT_INDEPENDENT',
  'FAILOVER_EVIDENCE_INHERITED',
  'SCHEMA_DRIFT_REQUIRES_REVALIDATION',
  'PROVIDER_DOMAIN_MISMATCH',
  'CREDENTIAL_PROVIDER_MISMATCH',
  'ORACLE_BINDING_OUT_OF_SCOPE',
  'PAYMENT_BINDING_OUT_OF_SCOPE',
  'CUSTODY_BINDING_NOT_ASSET_SAFE',
  'CONNECTIVITY_CANNOT_BE_ENABLED',
  'LIVE_STATE_FORBIDDEN',
] as const;
export type BindingFailureCode = (typeof BINDING_FAILURE_CODES)[number];

export type BindingError = {
  readonly code: BindingFailureCode | string;
  readonly message: string;
};

export type BindingResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: BindingError };

export function bindingOk<T>(value: T): BindingResult<T> {
  return Object.freeze({ ok: true, value });
}

export function bindingErr(code: BindingFailureCode | string, message: string): BindingResult<never> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) });
}

export type BindingVersionPins = {
  readonly adapterVersion: string;
  readonly schemaVersion: string;
  readonly translationVersion: string;
  readonly endpointProfileVersion: string;
  readonly credentialPolicyVersion: string;
  readonly conformanceSuiteVersion: string;
};

export type BindingEndpointProfile = {
  readonly profileId: string;
  readonly environmentClass: BindingEnvironmentClass;
  readonly scheme: BindingEndpointScheme;
  readonly host: string;
  readonly port: number;
  readonly approvedPathPrefix: string;
  readonly tlsPolicy: BindingTlsPolicy;
  readonly mtlsRequired: boolean;
  readonly redirectPolicy: BindingRedirectPolicy;
  readonly certificateExpectation: BindingCertificateExpectation;
  readonly allowlisted: true;
  readonly connectivityEnabled: false;
};

export type BindingWebhookProfile = {
  readonly profileId: string;
  readonly kind: WebhookProfileKind;
  readonly verificationProfileRef: string;
  readonly externallyExposed: false;
};

export type BindingCredentialRef = {
  readonly credentialDescriptorRef: string;
  readonly credentialVersionRef: string;
  readonly secretRef: SecretReference | null;
  readonly environmentClass: BindingEnvironmentClass;
  readonly rawCredentialPresent: false;
};

export type ProductionProviderBinding = {
  readonly bindingId: string;
  readonly providerId: string;
  readonly providerDomain: ProviderDomain;
  readonly providerProfileVersion: string;
  readonly environmentClass: BindingEnvironmentClass;
  readonly endpointProfileRef: string;
  readonly credentialDescriptorRef: string;
  readonly credentialVersionRef: string;
  readonly externalEvidenceRefs: readonly string[];
  readonly operatingScopeRefs: readonly string[];
  readonly legalEntityRef: string;
  readonly jurisdictions: readonly string[];
  readonly regions: readonly string[];
  readonly dataClasses: readonly ProviderDataClass[];
  readonly allowedOperations: readonly CredentialOperation[];
  readonly primary: boolean;
  readonly failoverPriority: number;
  readonly failoverBindingId: string | null;
  readonly runtimeProfileRef: string;
  readonly conformanceReportRef: string;
  readonly acceptanceReportRef: string;
  readonly webhookProfileRefs: readonly string[];
  readonly versionPins: BindingVersionPins;
  readonly operationalOwner: string;
  readonly controllerId: string;
  readonly credentialAuthorityId: string;
  readonly status: ProductionBindingState;
  readonly version: number;
  readonly contentHash: string;
  readonly productionConnectivityEnabled: false;
};

export type ExternalEvidenceView = {
  readonly evidenceId: string;
  readonly evidenceClass: EvidenceClass | string;
  readonly providerId: string;
  readonly status: ExternalEvidenceStatus;
  readonly expiresAtUtc: string | null;
};

export type ExternalEvidencePort = {
  lookup(evidenceId: string, nowUtc: string): ExternalEvidenceView | null;
};

export type OperatingScopeQuery = {
  readonly scopeRef: string;
  readonly providerId: string;
  readonly providerDomain: ProviderDomain;
  readonly jurisdiction: string;
  readonly productDomain: string;
  readonly dataClass: ProviderDataClass;
  readonly operation: string;
};

export type OperatingScopeDecision = {
  readonly covered: boolean;
  readonly reasons: readonly string[];
  readonly duplicatedEvaluator: false;
};

export type OperatingScopePort = {
  evaluate(query: OperatingScopeQuery): OperatingScopeDecision;
};

export type BindingCredentialRecord = {
  readonly descriptor: ProviderCredentialDescriptor;
  readonly environmentClass: BindingEnvironmentClass;
};

export type BindingEvaluationContext = {
  readonly nowUtc: string;
  readonly endpointProfiles: Readonly<Record<string, BindingEndpointProfile>>;
  readonly webhookProfiles: Readonly<Record<string, BindingWebhookProfile>>;
  readonly credentials: Readonly<Record<string, BindingCredentialRecord>>;
  readonly evidence: ExternalEvidencePort;
  readonly operatingScope: OperatingScopePort;
  readonly acceptance: ProviderAcceptanceResultRecord | null;
  readonly observedVersionPins: BindingVersionPins;
  readonly requestedJurisdictions: readonly string[];
  readonly requestedDataClasses: readonly ProviderDataClass[];
  readonly requestedOperations: readonly string[];
  readonly requestedProductDomain: string;
  readonly sandboxFlag: boolean;
  readonly productionEligibleFlag: boolean;
  readonly failoverEvaluation: BindingEvaluation | null;
};

export type BindingBlocker = {
  readonly code: BindingFailureCode | string;
  readonly detail: string;
};

export type BindingEvaluation = {
  readonly bindingId: string;
  readonly providerId: string;
  readonly providerDomain: ProviderDomain;
  readonly state: ProductionBindingState;
  readonly blockers: readonly BindingBlocker[];
  readonly engineeringBound: boolean;
  readonly externalEvidenceChecked: boolean;
  readonly operatingScopeChecked: boolean;
  readonly acceptanceSatisfied: boolean;
  readonly credentialReady: boolean;
  readonly endpointReady: boolean;
  readonly conformanceReady: boolean;
  readonly productionBindingCandidate: boolean;
  readonly sandboxCredentialUsedForProduction: false;
  readonly rawSecretPresent: false;
  readonly productionConnectivityEnabled: false;
  readonly realProviderCalled: false;
  readonly contentHash: string;
};

export type FailoverIndependenceReport = {
  readonly primaryBindingId: string;
  readonly failoverBindingId: string;
  readonly sameProvider: false;
  readonly inheritedApprovals: false;
  readonly failoverIndependentlyQualified: boolean;
  readonly blockers: readonly BindingBlocker[];
};

export type BindingConcentrationReport = {
  readonly providerConcentration: number;
  readonly regionConcentration: number;
  readonly controllerConcentration: number;
  readonly sameCorporationControlsMultipleCritical: boolean;
  readonly sameRegionHostsAllCritical: boolean;
  readonly sameCredentialAuthorityControlsAll: boolean;
  readonly dualProviderConfigured: boolean;
  readonly organizationalIndependenceClaimed: false;
  readonly independenceEvidencePresent: boolean;
};

export type ConnectivityReadinessReport = {
  readonly schemaVersion: typeof PRODUCTION_PROVIDER_BINDING_SCHEMA_VERSION;
  readonly toolVersion: typeof PRODUCTION_PROVIDER_BINDING_TOOL_VERSION;
  readonly generatedAtUtc: string;
  readonly providerDomainsRequired: readonly ProviderDomain[];
  readonly domainsBound: readonly ProviderDomain[];
  readonly domainsMissing: readonly ProviderDomain[];
  readonly invalidEvidence: readonly string[];
  readonly invalidJurisdictionScope: readonly string[];
  readonly credentialReadiness: boolean;
  readonly endpointReadiness: boolean;
  readonly failoverCoverage: boolean;
  readonly conformanceReadiness: boolean;
  readonly connectivityReadyForHumanReview: boolean;
  readonly connectivityEnabled: false;
  readonly liveConnectivityEnabled: false;
  readonly productionActive: false;
  readonly realProviderCalled: false;
  readonly reportDigest: string;
};

export function isBindingEnvironmentClass(value: string): value is BindingEnvironmentClass {
  return (BINDING_ENVIRONMENT_CLASSES as readonly string[]).includes(value);
}

export function isProductionBindingState(value: string): value is ProductionBindingState {
  return (BINDING_STATES as readonly string[]).includes(value);
}
