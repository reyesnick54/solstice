/**
 * Revocation and supersession. History is preserved. Revocation
 * immediately removes eligibility.
 */

import { externalEvidenceErr, externalEvidenceOk, type ExternalEvidenceResult, type ExternalProductionEvidenceRecord } from './types.ts';

export function revokeExternalEvidence(
  record: ExternalProductionEvidenceRecord,
  nowUtc: string,
  reason: string,
): ExternalEvidenceResult<ExternalProductionEvidenceRecord> {
  if (record.verificationState === 'SUPERSEDED') {
    return externalEvidenceErr('ALREADY_SUPERSEDED', `record ${record.recordId} is already superseded`);
  }
  return externalEvidenceOk(
    Object.freeze({
      ...record,
      verificationState: 'REVOKED' as const,
      revoked: true,
      revokedAtUtc: nowUtc,
      revocationReason: reason,
    }),
  );
}

export function supersedeExternalEvidence(
  previous: ExternalProductionEvidenceRecord,
  next: ExternalProductionEvidenceRecord,
  nowUtc: string,
): ExternalEvidenceResult<{
  readonly previous: ExternalProductionEvidenceRecord;
  readonly next: ExternalProductionEvidenceRecord;
}> {
  if (next.previousVersionId !== previous.recordId) {
    return externalEvidenceErr('VERSION_LINK_REQUIRED', 'superseding record must set previousVersionId');
  }
  if (next.version <= previous.version) {
    return externalEvidenceErr('VERSION_MUST_INCREASE', 'superseding record must increment version');
  }
  const superseded = Object.freeze({
    ...previous,
    verificationState: 'SUPERSEDED' as const,
    revoked: previous.revoked,
    revokedAtUtc: previous.revokedAtUtc,
    revocationReason: previous.revocationReason ?? `superseded at ${nowUtc} by ${next.recordId}`,
  });
  return externalEvidenceOk({ previous: superseded, next });
}

export function revocationBlocksEligibility(record: ExternalProductionEvidenceRecord): boolean {
  return record.revoked || record.verificationState === 'REVOKED';
}

export function supersededPreservesHistory(
  previous: ExternalProductionEvidenceRecord,
  next: ExternalProductionEvidenceRecord,
): boolean {
  return (
    previous.verificationState === 'SUPERSEDED' &&
    next.previousVersionId === previous.recordId &&
    next.recordId !== previous.recordId
  );
}
