/**
 * Readiness evidence records and state transitions.
 *
 * Software cannot convert external evidence into HUMAN_VERIFIED
 * without an accepted MainnetAuthorizationRecord from a human.
 */

import { encodeString, sha256Hex } from '../validators/canonical.ts';
import type {
  EvidenceState,
  MainnetAuthorizationRecord,
  MainnetReadinessDimension,
  ReadinessEvidenceRecord,
} from './types.ts';

export const EVIDENCE_DOMAIN = 'SUNREY_MAINNET_EVIDENCE_V1' as const;

const EXTERNAL_DIMENSIONS = new Set<MainnetReadinessDimension>([
  'EXTERNAL_SECURITY_REVIEW',
  'FORMAL_ASSURANCE',
  'ROOT_OF_TRUST',
  'PRIVACY',
  'CUSTODY',
  'EXCHANGE',
  'COMPLIANCE',
  'LEGAL',
  'REGULATORY',
  'LICENSING',
  'PARTNER_DEPENDENCIES',
  'HUMAN_AUTHORIZATION',
]);

export function isExternalDimension(dimension: MainnetReadinessDimension): boolean {
  return EXTERNAL_DIMENSIONS.has(dimension);
}

export function evidenceRecordHash(record: ReadinessEvidenceRecord): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(EVIDENCE_DOMAIN),
      encodeString(record.requirementId),
      encodeString(record.dimension),
      encodeString(record.verificationStatus),
      encodeString(record.description),
      encodeString(record.evidenceHash ?? ''),
      encodeString(record.evidenceReference ?? ''),
      encodeString(record.source),
      encodeString(record.notes),
    ]),
  );
}

export function freezeEvidence(record: ReadinessEvidenceRecord): ReadinessEvidenceRecord {
  return Object.freeze({ ...record });
}

/**
 * Engineering code may mark software-derived evidence ENGINEERING_VERIFIED.
 * It may not mark external slots HUMAN_VERIFIED.
 */
export function applyEngineeringVerification(
  record: ReadinessEvidenceRecord,
  next: EvidenceState,
): ReadinessEvidenceRecord {
  if (next === 'HUMAN_VERIFIED' && record.externalEvidence) {
    throw new TypeError(
      `software cannot convert external evidence ${record.requirementId} to HUMAN_VERIFIED`,
    );
  }
  if (next === 'HUMAN_VERIFIED' && isExternalDimension(record.dimension) && record.externalEvidence) {
    throw new TypeError(`external dimension ${record.dimension} requires authorized human input`);
  }
  return freezeEvidence({ ...record, verificationStatus: next });
}

export function applyHumanVerification(
  record: ReadinessEvidenceRecord,
  authorization: MainnetAuthorizationRecord,
): ReadinessEvidenceRecord {
  if (!authorization.accepted || authorization.actorKind !== 'HUMAN') {
    throw new TypeError('HUMAN_VERIFIED requires an accepted human authorization record');
  }
  return freezeEvidence({
    ...record,
    verificationStatus: 'HUMAN_VERIFIED',
    notes: `${record.notes} human-verified by ${authorization.role} ${authorization.actorId}`,
  });
}

export function missingEvidenceIds(records: readonly ReadinessEvidenceRecord[]): readonly string[] {
  return records
    .filter(
      (record) =>
        record.verificationStatus === 'NOT_PROVIDED' ||
        record.verificationStatus === 'PROVIDED_UNVERIFIED' ||
        record.verificationStatus === 'EXTERNAL_VERIFICATION_REQUIRED',
    )
    .map((record) => record.requirementId);
}
