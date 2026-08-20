/**
 * Adaptors between the canonical external-evidence record and existing
 * readiness / provider / handoff types. Does not create competing
 * evidence classes.
 */

import type { ClassifiedEvidence } from '../../production-handoff/types.ts';
import type {
  EvidenceClass,
  ExternalProviderEvidenceRecord,
  HumanReviewerRole,
} from '../../providers/types.ts';
import { createEvidenceRecord } from '../../providers/evidence.ts';
import type {
  EvidenceState,
  EvidenceType,
  ExternalSecurityReviewSlot,
  LegalRegulatorySlot,
  MainnetReadinessDimension,
  ReadinessEvidenceRecord,
  VerifierRole,
} from '../types.ts';
import { freezeEvidence } from '../evidence.ts';

import { STRING_SLOT_SATISFIES_EXTERNAL_READINESS, type ExternalProductionEvidenceClass, type ExternalProductionEvidenceRecord } from './types.ts';
import type { ExternalEvidenceRegistry } from './registry.ts';

export const PROVIDER_CLASS_TO_EXTERNAL: Readonly<Record<EvidenceClass, ExternalProductionEvidenceClass>> = Object.freeze({
  SERVICE_CONTRACT: 'SERVICE_CONTRACT',
  SECURITY_ASSESSMENT: 'EXTERNAL_SECURITY_AUDIT',
  SOC_ISO_OR_EQUIVALENT: 'SOC_ISO_OR_EQUIVALENT',
  PENETRATION_TEST: 'PENETRATION_TEST_REPORT',
  HSM_ATTESTATION: 'HSM_ATTESTATION',
  KEY_MANAGEMENT: 'KMS_SECURITY_EVIDENCE',
  DATA_PROCESSING_AGREEMENT: 'DATA_PROCESSING_AGREEMENT',
  DATA_LICENSE_AGREEMENT: 'DATA_LICENSE_AGREEMENT',
  SERVICE_LEVEL_AGREEMENT: 'SERVICE_LEVEL_AGREEMENT',
  BUSINESS_CONTINUITY: 'BUSINESS_CONTINUITY_EVIDENCE',
  JURISDICTION: 'JURISDICTION_OPERATING_APPROVAL',
  LICENSE_REGISTRATION: 'LICENSE_OR_REGISTRATION',
  HUMAN_APPROVAL: 'HUMAN_AUTHORIZATION',
});

export const EVIDENCE_TYPE_TO_EXTERNAL: Partial<Record<EvidenceType, ExternalProductionEvidenceClass>> = Object.freeze({
  EXTERNAL_AUDIT_REPORT: 'EXTERNAL_SECURITY_AUDIT',
  COUNSEL_OPINION: 'COUNSEL_OPINION',
  LICENSE_OR_REGISTRATION: 'LICENSE_OR_REGISTRATION',
  REGULATORY_APPROVAL: 'REGULATORY_APPROVAL',
  PARTNER_AGREEMENT: 'PARTNER_AGREEMENT',
  HUMAN_AUTHORIZATION: 'HUMAN_AUTHORIZATION',
  CEREMONY_TRANSCRIPT: 'CEREMONY_TRANSCRIPT',
});

export const DIMENSION_TO_EXTERNAL_CLASS: Partial<Record<MainnetReadinessDimension, ExternalProductionEvidenceClass>> =
  Object.freeze({
    EXTERNAL_SECURITY_REVIEW: 'EXTERNAL_SECURITY_AUDIT',
    LEGAL: 'COUNSEL_OPINION',
    REGULATORY: 'REGULATORY_APPROVAL',
    LICENSING: 'LICENSE_OR_REGISTRATION',
    PARTNER_DEPENDENCIES: 'PARTNER_AGREEMENT',
    HUMAN_AUTHORIZATION: 'HUMAN_AUTHORIZATION',
    ROOT_OF_TRUST: 'CEREMONY_TRANSCRIPT',
    CUSTODY: 'HSM_ATTESTATION',
    COMPLIANCE: 'LICENSE_OR_REGISTRATION',
  });

export function toReadinessEvidenceState(
  record: ExternalProductionEvidenceRecord,
): EvidenceState {
  switch (record.verificationState) {
    case 'NOT_PROVIDED':
      return 'NOT_PROVIDED';
    case 'PROVIDED_UNVERIFIED':
    case 'REJECTED':
      return 'PROVIDED_UNVERIFIED';
    case 'UNDER_REVIEW':
    case 'EXPIRED':
    case 'REVOKED':
    case 'SUPERSEDED':
      return 'EXTERNAL_VERIFICATION_REQUIRED';
    case 'VERIFIED_ENGINEERING_FIXTURE':
      return 'ENGINEERING_VERIFIED';
    case 'VERIFIED_EXTERNAL':
      return 'HUMAN_VERIFIED';
    default:
      return 'NOT_PROVIDED';
  }
}

export function toProviderVerificationState(
  record: ExternalProductionEvidenceRecord,
): ExternalProviderEvidenceRecord['verificationState'] {
  switch (record.verificationState) {
    case 'NOT_PROVIDED':
      return 'MISSING';
    case 'PROVIDED_UNVERIFIED':
    case 'UNDER_REVIEW':
    case 'REJECTED':
    case 'VERIFIED_ENGINEERING_FIXTURE':
      return record.contentDigest.length > 0 ? 'DIGEST_RECORDED' : 'REFERENCED';
    case 'VERIFIED_EXTERNAL':
      return 'HUMAN_REVIEWED';
    case 'EXPIRED':
    case 'REVOKED':
    case 'SUPERSEDED':
      return 'STALE';
    default:
      return 'MISSING';
  }
}

export function toVerifierRole(record: ExternalProductionEvidenceRecord): VerifierRole {
  switch (record.verifiedByRole) {
    case 'SECURITY_AUTHORITY':
    case 'EXTERNAL_AUDITOR':
      return 'EXTERNAL_AUDITOR';
    case 'COUNSEL':
    case 'LEGAL_AUTHORITY':
      return 'COUNSEL';
    case 'REGULATOR':
    case 'REGULATORY_AUTHORITY':
      return 'REGULATOR';
    case 'COMMERCIAL_REVIEWER':
    case 'HUMAN_GOVERNANCE':
    case 'OPERATOR_AUTHORITY':
    case 'PROTOCOL_AUTHORITY':
    case 'RELEASE_AUTHORITY':
      return 'HUMAN_AUTHORITY';
    default:
      return 'EXTERNAL_AUDITOR';
  }
}

export function bindReadinessRecordToRegistry(
  record: ReadinessEvidenceRecord,
  registryRecord: ExternalProductionEvidenceRecord,
): ReadinessEvidenceRecord {
  return freezeEvidence({
    ...record,
    evidenceHash: registryRecord.commitmentHash,
    evidenceReference: `external-evidence:${registryRecord.recordId}`,
    verificationStatus: toReadinessEvidenceState(registryRecord),
    externalRegistryRecordId: registryRecord.recordId,
    externalRegistryBindingHash: registryRecord.commitmentHash,
    notes: `${record.notes} bound to external registry ${registryRecord.recordId}`,
  });
}

export function stringSlotSatisfiesExternalReadiness(
  slot: Pick<ExternalSecurityReviewSlot, 'reviewReference' | 'reportHash' | 'status'> | Pick<
    LegalRegulatorySlot,
    'counselOpinionReference' | 'status'
  >,
): false {
  void slot;
  return STRING_SLOT_SATISFIES_EXTERNAL_READINESS;
}

export function toProviderEvidenceRecord(
  record: ExternalProductionEvidenceRecord,
  providerId: string,
  evidenceClass: EvidenceClass,
): ExternalProviderEvidenceRecord {
  const role = record.verifiedByRole;
  const humanRole: HumanReviewerRole | null =
    role === 'SECURITY_AUTHORITY' || role === 'EXTERNAL_AUDITOR'
      ? 'SECURITY_REVIEWER'
      : role === 'COUNSEL' || role === 'LEGAL_AUTHORITY'
        ? 'COUNSEL_REVIEWER'
        : role === 'COMMERCIAL_REVIEWER'
          ? 'COMMERCIAL_REVIEWER'
          : role === 'OPERATOR_AUTHORITY' || role === 'HUMAN_GOVERNANCE'
            ? 'OPERATIONS_REVIEWER'
            : null;
  return createEvidenceRecord({
    recordId: record.recordId,
    providerId,
    evidenceClass,
    documentOrReferenceId: record.reference.locator,
    issuerOrSource: record.issuerOrSource,
    issuedAtUtc: record.issuedAtUtc,
    expiresAtUtc: record.expiresAtUtc,
    contentDigest: record.contentDigest,
    verificationState: toProviderVerificationState(record),
    humanReviewer: record.verifiedByActorId,
    humanReviewerRole: humanRole,
    scope: record.scope.label,
  });
}

export function toClassifiedEvidence(record: ExternalProductionEvidenceRecord): ClassifiedEvidence {
  return Object.freeze({
    id: record.recordId,
    evidenceClass: record.fixture || record.engineeringOnly ? 'ENGINEERING' : 'EXTERNAL',
    source: record.issuerOrSource,
    hash: record.commitmentHash,
    rehearsal: record.fixture,
    fixture: record.fixture,
    notes: record.engineeringOnly ? 'engineering-only external evidence reference' : 'external evidence metadata',
  });
}

export function readinessRecordHasVerifiedRegistryReference(
  record: ReadinessEvidenceRecord,
  registry: ExternalEvidenceRegistry,
  nowUtc: string,
): boolean {
  const id = record.externalRegistryRecordId;
  if (!id) {
    return false;
  }
  const bound = registry.get(id);
  if (!bound) {
    return false;
  }
  if (record.externalRegistryBindingHash !== bound.commitmentHash) {
    return false;
  }
  return registry.productionEligible({
    evidenceClass: bound.evidenceClass,
    subjectType: bound.subjectType,
    subjectId: bound.subjectId,
    nowUtc,
    production: true,
  });
}
