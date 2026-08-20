/**
 * Verifier authority. AI / S3M / Grok / automation cannot verify.
 * Software cannot self-declare regulatory status. A fixture may
 * become VERIFIED_ENGINEERING_FIXTURE only — never VERIFIED_EXTERNAL
 * and never VERIFIED_FOR_PRODUCTION (that state does not exist).
 */

import { recordCommitmentHash, verificationSurvivesSemanticChange } from './hash.ts';
import {
  AI_CAN_VERIFY_EXTERNAL_EVIDENCE,
  NON_HUMAN_VERIFIER_KINDS,
  VERIFIED_FOR_PRODUCTION_STATE_EXISTS,
  externalEvidenceErr,
  externalEvidenceOk,
  type ExternalEvidenceResult,
  type ExternalEvidenceVerifier,
  type ExternalEvidenceVerifierRole,
  type ExternalProductionEvidenceClass,
  type ExternalProductionEvidenceRecord,
} from './types.ts';

const SECURITY_CLASSES = new Set<ExternalProductionEvidenceClass>([
  'EXTERNAL_SECURITY_AUDIT',
  'PENETRATION_TEST_REPORT',
  'SOC_ISO_OR_EQUIVALENT',
  'HSM_ATTESTATION',
  'KMS_SECURITY_EVIDENCE',
]);

const COUNSEL_CLASSES = new Set<ExternalProductionEvidenceClass>(['COUNSEL_OPINION']);

const REGULATORY_CLASSES = new Set<ExternalProductionEvidenceClass>([
  'LICENSE_OR_REGISTRATION',
  'REGULATORY_APPROVAL',
  'JURISDICTION_OPERATING_APPROVAL',
]);

const COMMERCIAL_CLASSES = new Set<ExternalProductionEvidenceClass>([
  'SERVICE_CONTRACT',
  'PARTNER_AGREEMENT',
  'DATA_PROCESSING_AGREEMENT',
  'DATA_LICENSE_AGREEMENT',
  'SERVICE_LEVEL_AGREEMENT',
  'BUSINESS_CONTINUITY_EVIDENCE',
]);

const HUMAN_CLASSES = new Set<ExternalProductionEvidenceClass>([
  'HUMAN_AUTHORIZATION',
  'OPERATOR_ACCEPTANCE',
  'CEREMONY_TRANSCRIPT',
]);

const SECURITY_ROLES = new Set<ExternalEvidenceVerifierRole>(['SECURITY_AUTHORITY', 'EXTERNAL_AUDITOR']);
const COUNSEL_ROLES = new Set<ExternalEvidenceVerifierRole>(['COUNSEL', 'LEGAL_AUTHORITY']);
const REGULATORY_ROLES = new Set<ExternalEvidenceVerifierRole>(['REGULATOR', 'REGULATORY_AUTHORITY']);
const COMMERCIAL_ROLES = new Set<ExternalEvidenceVerifierRole>([
  'COMMERCIAL_REVIEWER',
  'LEGAL_AUTHORITY',
  'HUMAN_GOVERNANCE',
]);
const HUMAN_ROLES = new Set<ExternalEvidenceVerifierRole>([
  'HUMAN_GOVERNANCE',
  'OPERATOR_AUTHORITY',
  'PROTOCOL_AUTHORITY',
  'RELEASE_AUTHORITY',
  'SECURITY_AUTHORITY',
  'LEGAL_AUTHORITY',
]);

export function requiredVerifierRoles(
  evidenceClass: ExternalProductionEvidenceClass,
): readonly ExternalEvidenceVerifierRole[] {
  if (SECURITY_CLASSES.has(evidenceClass)) {
    return [...SECURITY_ROLES];
  }
  if (COUNSEL_CLASSES.has(evidenceClass)) {
    return [...COUNSEL_ROLES];
  }
  if (REGULATORY_CLASSES.has(evidenceClass)) {
    return [...REGULATORY_ROLES];
  }
  if (COMMERCIAL_CLASSES.has(evidenceClass)) {
    return [...COMMERCIAL_ROLES];
  }
  if (HUMAN_CLASSES.has(evidenceClass)) {
    return [...HUMAN_ROLES];
  }
  return [];
}

export function roleMayVerify(
  evidenceClass: ExternalProductionEvidenceClass,
  role: ExternalEvidenceVerifierRole,
): boolean {
  return requiredVerifierRoles(evidenceClass).includes(role);
}

export function actorLooksNonHuman(actor: ExternalEvidenceVerifier): boolean {
  if ((NON_HUMAN_VERIFIER_KINDS as readonly string[]).includes(actor.kind)) {
    return true;
  }
  const lowered = actor.actorId.toLowerCase();
  return (
    lowered.includes('ai-') ||
    lowered.startsWith('ai_') ||
    lowered.includes('s3m') ||
    lowered.includes('grok') ||
    lowered.includes('agent.') ||
    lowered.includes('automation') ||
    lowered.includes('service.')
  );
}

export function softwareCannotSelfDeclareRegulatory(evidenceClass: ExternalProductionEvidenceClass): boolean {
  return REGULATORY_CLASSES.has(evidenceClass);
}

export function verifyExternalEvidence(
  record: ExternalProductionEvidenceRecord,
  actor: ExternalEvidenceVerifier,
  nowUtc: string,
): ExternalEvidenceResult<ExternalProductionEvidenceRecord> {
  if (VERIFIED_FOR_PRODUCTION_STATE_EXISTS) {
    return externalEvidenceErr('VERIFIED_FOR_PRODUCTION_FORBIDDEN', 'VERIFIED_FOR_PRODUCTION is not a registry state');
  }
  if (actorLooksNonHuman(actor) || AI_CAN_VERIFY_EXTERNAL_EVIDENCE) {
    return externalEvidenceErr(
      'AI_CANNOT_VERIFY_EXTERNAL_EVIDENCE',
      'AI, S3M, Grok, agents, and automation cannot verify external evidence',
    );
  }
  if (actor.kind !== 'HUMAN') {
    return externalEvidenceErr('NON_HUMAN_VERIFIER', 'only a named human may verify external evidence');
  }
  if (!roleMayVerify(record.evidenceClass, actor.role)) {
    return externalEvidenceErr(
      'VERIFIER_ROLE_MISMATCH',
      `${actor.role} cannot verify ${record.evidenceClass}`,
    );
  }
  if (softwareCannotSelfDeclareRegulatory(record.evidenceClass) && actor.role !== 'REGULATOR' && actor.role !== 'REGULATORY_AUTHORITY') {
    return externalEvidenceErr(
      'REGULATORY_NOT_SELF_DECLARED',
      'regulatory evidence cannot be self-declared by software or an unauthorized role',
    );
  }
  if (record.revoked || record.verificationState === 'REVOKED') {
    return externalEvidenceErr('REVOKED', `record ${record.recordId} is revoked`);
  }
  if (record.verificationState === 'SUPERSEDED') {
    return externalEvidenceErr('SUPERSEDED', `record ${record.recordId} is superseded`);
  }
  if (record.verificationState === 'EXPIRED' || (record.expiresAtUtc !== null && record.expiresAtUtc <= nowUtc)) {
    return externalEvidenceErr('EXPIRED', `record ${record.recordId} is expired`);
  }
  if (record.reference.locator.length === 0 && record.contentDigest.length === 0) {
    return externalEvidenceErr('REFERENCE_REQUIRED', 'a document reference or content digest is required');
  }
  const bindingHash = recordCommitmentHash(record);
  const nextState = record.fixture || record.engineeringOnly ? 'VERIFIED_ENGINEERING_FIXTURE' : 'VERIFIED_EXTERNAL';
  return externalEvidenceOk(
    Object.freeze({
      ...record,
      verificationState: nextState,
      verifiedByRole: actor.role,
      verifiedByActorId: actor.actorId,
      verifiedAtUtc: nowUtc,
      verificationBindingHash: bindingHash,
    }),
  );
}

export function rejectExternalEvidence(
  record: ExternalProductionEvidenceRecord,
  actor: ExternalEvidenceVerifier,
  nowUtc: string,
  reason: string,
): ExternalEvidenceResult<ExternalProductionEvidenceRecord> {
  if (actorLooksNonHuman(actor)) {
    return externalEvidenceErr('AI_CANNOT_VERIFY_EXTERNAL_EVIDENCE', 'AI cannot reject external evidence as a verifier');
  }
  if (actor.kind !== 'HUMAN') {
    return externalEvidenceErr('NON_HUMAN_VERIFIER', 'only a named human may reject external evidence');
  }
  return externalEvidenceOk(
    Object.freeze({
      ...record,
      verificationState: 'REJECTED' as const,
      verifiedByRole: actor.role,
      verifiedByActorId: actor.actorId,
      verifiedAtUtc: nowUtc,
      verificationBindingHash: null,
      revocationReason: reason,
    }),
  );
}

export function invalidateVerificationAfterChange(
  record: ExternalProductionEvidenceRecord,
): ExternalProductionEvidenceRecord {
  if (record.verificationBindingHash === null) {
    return record;
  }
  if (verificationSurvivesSemanticChange(record)) {
    return record;
  }
  return Object.freeze({
    ...record,
    verificationState:
      record.verificationState === 'VERIFIED_EXTERNAL' || record.verificationState === 'VERIFIED_ENGINEERING_FIXTURE'
        ? 'PROVIDED_UNVERIFIED'
        : record.verificationState,
    verifiedByRole: null,
    verifiedByActorId: null,
    verifiedAtUtc: null,
    verificationBindingHash: null,
  });
}

export function markUnderReview(record: ExternalProductionEvidenceRecord): ExternalProductionEvidenceRecord {
  if (record.verificationState === 'REVOKED' || record.verificationState === 'SUPERSEDED') {
    return record;
  }
  return Object.freeze({ ...record, verificationState: 'UNDER_REVIEW' as const });
}
