/**
 * Chunk 160 — External production evidence registry types.
 *
 * Canonical owner remains Chunk 65 mainnet readiness. This is a
 * register / verify / expire / revoke / bind plane for external
 * evidence references. It does not store confidential documents,
 * fabricate audits or counsel opinions, or activate production.
 *
 * The Evidence Vault remains the sealing authority. This registry
 * is not packages/legal, packages/licenses, packages/external-audit,
 * packages/compliance-evidence, or packages/evidence-v2.
 */

import type { ActivationDomain } from '../types.ts';
import type { ProviderDomain } from '../../providers/types.ts';

export const EXTERNAL_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const EXTERNAL_EVIDENCE_TOOL_VERSION = 'sunrey-external-evidence/1' as const;
export const EXTERNAL_EVIDENCE_HASH_DOMAIN = 'SUNREY_EXTERNAL_PRODUCTION_EVIDENCE_V1' as const;
export const EXTERNAL_EVIDENCE_VAULT_KIND = 'SUNREY_EXTERNAL_EVIDENCE_COMMITMENT_V1' as const;

export const FIXTURE_COUNTS_AS_EXTERNAL = false as const;
export const AI_CAN_VERIFY_EXTERNAL_EVIDENCE = false as const;
export const S3M_CAN_VERIFY_EXTERNAL_EVIDENCE = false as const;
export const GROK_CAN_VERIFY_EXTERNAL_EVIDENCE = false as const;
export const AUTOMATION_CAN_VERIFY_EXTERNAL_EVIDENCE = false as const;
export const VERIFIED_EVIDENCE_SCOPE_BOUND = true as const;
export const EXPIRED_EVIDENCE_COUNTS = false as const;
export const REVOKED_EVIDENCE_COUNTS = false as const;
export const CONFIDENTIAL_DOCUMENT_ON_CHAIN = false as const;
export const PRODUCTION_ACTIVE = false as const;
export const VERIFIED_FOR_PRODUCTION_STATE_EXISTS = false as const;
export const STRING_SLOT_SATISFIES_EXTERNAL_READINESS = false as const;
export const ENGINEERING_TEST_EQUALS_EXTERNAL_EVIDENCE = false as const;

export const EXTERNAL_PRODUCTION_EVIDENCE_CLASSES = [
  'EXTERNAL_SECURITY_AUDIT',
  'PENETRATION_TEST_REPORT',
  'SOC_ISO_OR_EQUIVALENT',
  'HSM_ATTESTATION',
  'KMS_SECURITY_EVIDENCE',
  'COUNSEL_OPINION',
  'LICENSE_OR_REGISTRATION',
  'REGULATORY_APPROVAL',
  'JURISDICTION_OPERATING_APPROVAL',
  'SERVICE_CONTRACT',
  'PARTNER_AGREEMENT',
  'DATA_PROCESSING_AGREEMENT',
  'DATA_LICENSE_AGREEMENT',
  'SERVICE_LEVEL_AGREEMENT',
  'BUSINESS_CONTINUITY_EVIDENCE',
  'HUMAN_AUTHORIZATION',
  'OPERATOR_ACCEPTANCE',
  'CEREMONY_TRANSCRIPT',
] as const;
export type ExternalProductionEvidenceClass = (typeof EXTERNAL_PRODUCTION_EVIDENCE_CLASSES)[number];

export const EXTERNAL_EVIDENCE_VERIFICATION_STATES = [
  'NOT_PROVIDED',
  'PROVIDED_UNVERIFIED',
  'UNDER_REVIEW',
  'VERIFIED_ENGINEERING_FIXTURE',
  'VERIFIED_EXTERNAL',
  'REJECTED',
  'EXPIRED',
  'REVOKED',
  'SUPERSEDED',
] as const;
export type ExternalEvidenceVerificationState = (typeof EXTERNAL_EVIDENCE_VERIFICATION_STATES)[number];

export const EXTERNAL_EVIDENCE_FRESHNESS_STATES = ['CURRENT', 'REVIEW_DUE', 'EXPIRED', 'REVOKED'] as const;
export type ExternalEvidenceFreshness = (typeof EXTERNAL_EVIDENCE_FRESHNESS_STATES)[number];

export const EXTERNAL_EVIDENCE_SUBJECT_TYPES = [
  'MAINNET_READINESS_DIMENSION',
  'PROVIDER',
  'ACTIVATION_DOMAIN',
  'HSM',
  'KMS',
  'LEGAL_ENTITY',
  'NETWORK',
  'CEREMONY',
  'HUMAN_ROLE',
  'OTHER',
] as const;
export type ExternalEvidenceSubjectType = (typeof EXTERNAL_EVIDENCE_SUBJECT_TYPES)[number];

export const EXTERNAL_EVIDENCE_REFERENCE_KINDS = [
  'DOCUMENT_REFERENCE',
  'SECURE_REPOSITORY_REFERENCE',
  'CONTENT_DIGEST_ONLY',
] as const;
export type ExternalEvidenceReferenceKind = (typeof EXTERNAL_EVIDENCE_REFERENCE_KINDS)[number];

export const EXTERNAL_EVIDENCE_VERIFIER_ROLES = [
  'SECURITY_AUTHORITY',
  'EXTERNAL_AUDITOR',
  'COUNSEL',
  'LEGAL_AUTHORITY',
  'REGULATOR',
  'REGULATORY_AUTHORITY',
  'COMMERCIAL_REVIEWER',
  'HUMAN_GOVERNANCE',
  'OPERATOR_AUTHORITY',
  'PROTOCOL_AUTHORITY',
  'RELEASE_AUTHORITY',
] as const;
export type ExternalEvidenceVerifierRole = (typeof EXTERNAL_EVIDENCE_VERIFIER_ROLES)[number];

export const EXTERNAL_EVIDENCE_ACTOR_KINDS = [
  'HUMAN',
  'AI',
  'S3M',
  'GROK',
  'AGENT',
  'AUTOMATION',
  'SERVICE',
] as const;
export type ExternalEvidenceActorKind = (typeof EXTERNAL_EVIDENCE_ACTOR_KINDS)[number];

export const NON_HUMAN_VERIFIER_KINDS = [
  'AI',
  'S3M',
  'GROK',
  'AGENT',
  'AUTOMATION',
  'SERVICE',
] as const;
export type NonHumanVerifierKind = (typeof NON_HUMAN_VERIFIER_KINDS)[number];

export type ExternalEvidenceScope = {
  readonly label: string;
  readonly global: boolean;
  readonly jurisdictions: readonly string[];
  readonly activationDomains: readonly ActivationDomain[];
  readonly providerDomains: readonly ProviderDomain[];
};

export type ExternalEvidenceReference = {
  readonly kind: ExternalEvidenceReferenceKind;
  readonly locator: string;
  readonly repositoryId: string | null;
};

export type ExternalProductionEvidenceRecord = {
  readonly schemaVersion: typeof EXTERNAL_EVIDENCE_SCHEMA_VERSION;
  readonly recordId: string;
  readonly evidenceClass: ExternalProductionEvidenceClass;
  readonly issuerOrSource: string;
  readonly subjectType: ExternalEvidenceSubjectType;
  readonly subjectId: string;
  readonly scope: ExternalEvidenceScope;
  readonly jurisdictions: readonly string[];
  readonly activationDomains: readonly ActivationDomain[];
  readonly providerDomains: readonly ProviderDomain[];
  readonly issuedAtUtc: string | null;
  readonly validFromUtc: string | null;
  readonly expiresAtUtc: string | null;
  readonly reviewDueAtUtc: string | null;
  readonly reference: ExternalEvidenceReference;
  readonly contentDigest: string;
  readonly verificationState: ExternalEvidenceVerificationState;
  readonly verifiedByRole: ExternalEvidenceVerifierRole | null;
  readonly verifiedByActorId: string | null;
  readonly verifiedAtUtc: string | null;
  readonly verificationBindingHash: string | null;
  readonly revoked: boolean;
  readonly revokedAtUtc: string | null;
  readonly revocationReason: string | null;
  readonly confidential: boolean;
  readonly publicChainSafe: boolean;
  readonly fixture: boolean;
  readonly engineeringOnly: boolean;
  readonly version: number;
  readonly previousVersionId: string | null;
  readonly commitmentHash: string;
};

export type PublicExternalEvidenceView = {
  readonly recordId: string;
  readonly evidenceClass: ExternalProductionEvidenceClass;
  readonly subjectType: ExternalEvidenceSubjectType;
  readonly subjectId: string;
  readonly scopeLabel: string;
  readonly jurisdictions: readonly string[];
  readonly activationDomains: readonly ActivationDomain[];
  readonly providerDomains: readonly ProviderDomain[];
  readonly issuedAtUtc: string | null;
  readonly validFromUtc: string | null;
  readonly expiresAtUtc: string | null;
  readonly reviewDueAtUtc: string | null;
  readonly referenceKind: ExternalEvidenceReferenceKind;
  readonly contentDigest: string;
  readonly verificationState: ExternalEvidenceVerificationState;
  readonly freshness: ExternalEvidenceFreshness;
  readonly revoked: boolean;
  readonly fixture: boolean;
  readonly engineeringOnly: boolean;
  readonly confidential: boolean;
  readonly publicChainSafe: true;
  readonly confidentialDocumentPresent: false;
  readonly rawDocumentOnChain: false;
  readonly version: number;
  readonly previousVersionId: string | null;
  readonly commitmentHash: string;
  readonly issuerOrSource: string | null;
  readonly referenceLocator: string | null;
};

export type ExternalEvidenceVerifier = {
  readonly kind: ExternalEvidenceActorKind;
  readonly actorId: string;
  readonly role: ExternalEvidenceVerifierRole;
};

export type ExternalEvidenceQuery = {
  readonly evidenceClass: ExternalProductionEvidenceClass;
  readonly subjectType?: ExternalEvidenceSubjectType;
  readonly subjectId?: string;
  readonly jurisdiction?: string;
  readonly activationDomain?: ActivationDomain;
  readonly providerDomain?: ProviderDomain;
  readonly nowUtc: string;
  readonly production?: boolean;
};

export type ExternalEvidenceRegistryError = {
  readonly code: string;
  readonly message: string;
};

export type ExternalEvidenceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ExternalEvidenceRegistryError };

export function externalEvidenceOk<T>(value: T): ExternalEvidenceResult<T> {
  return { ok: true, value };
}

export function externalEvidenceErr(code: string, message: string): ExternalEvidenceResult<never> {
  return { ok: false, error: { code, message } };
}

export function isExternalProductionEvidenceClass(
  value: string,
): value is ExternalProductionEvidenceClass {
  return (EXTERNAL_PRODUCTION_EVIDENCE_CLASSES as readonly string[]).includes(value);
}

export function isVerifiedExternalState(state: ExternalEvidenceVerificationState): boolean {
  return state === 'VERIFIED_EXTERNAL';
}

export function isVerifiedFixtureState(state: ExternalEvidenceVerificationState): boolean {
  return state === 'VERIFIED_ENGINEERING_FIXTURE';
}

export function satisfiesProductionVerification(
  record: Pick<
    ExternalProductionEvidenceRecord,
    'verificationState' | 'fixture' | 'engineeringOnly' | 'revoked'
  >,
): boolean {
  if (record.fixture || record.engineeringOnly || record.revoked) {
    return false;
  }
  return record.verificationState === 'VERIFIED_EXTERNAL';
}
