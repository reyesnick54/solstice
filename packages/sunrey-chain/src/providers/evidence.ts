/**
 * Evidence records for external production providers.
 *
 * A slot is not proof. Expired evidence becomes STALE. AI may
 * summarize; AI cannot mark HUMAN_REVIEWED, HUMAN_ACCEPTED, or
 * PRODUCTION_ELIGIBLE. Confidential document contents stay off
 * the public chain.
 */

import { createHash } from 'node:crypto';

import { acceptanceErr, acceptanceOk, type ExternalProviderEvidenceRecord, type EvidenceClass, type HumanReviewerRole, type ProviderAcceptanceResult, type ReviewerKind } from './types.ts';

export function digestEvidenceReference(input: {
  readonly providerId: string;
  readonly evidenceClass: EvidenceClass;
  readonly documentOrReferenceId: string;
  readonly issuerOrSource: string;
}): string {
  return createHash('sha256')
    .update(
      [input.providerId, input.evidenceClass, input.documentOrReferenceId, input.issuerOrSource].join('|'),
    )
    .digest('hex');
}

export function createEvidenceRecord(input: {
  readonly recordId: string;
  readonly providerId: string;
  readonly evidenceClass: EvidenceClass;
  readonly documentOrReferenceId?: string | null;
  readonly issuerOrSource?: string | null;
  readonly issuedAtUtc?: string | null;
  readonly expiresAtUtc?: string | null;
  readonly contentDigest?: string | null;
  readonly verificationState?: ExternalProviderEvidenceRecord['verificationState'];
  readonly humanReviewer?: string | null;
  readonly humanReviewerRole?: HumanReviewerRole | null;
  readonly scope: string;
}): ExternalProviderEvidenceRecord {
  const documentOrReferenceId = input.documentOrReferenceId ?? '';
  const issuerOrSource = input.issuerOrSource ?? '';
  const missing = documentOrReferenceId.length === 0;
  return Object.freeze({
    recordId: input.recordId,
    providerId: input.providerId,
    evidenceClass: input.evidenceClass,
    documentOrReferenceId,
    issuerOrSource,
    issuedAtUtc: input.issuedAtUtc ?? null,
    expiresAtUtc: input.expiresAtUtc ?? null,
    contentDigest: missing
      ? null
      : input.contentDigest ??
        digestEvidenceReference({
          providerId: input.providerId,
          evidenceClass: input.evidenceClass,
          documentOrReferenceId,
          issuerOrSource,
        }),
    verificationState: missing ? 'MISSING' : (input.verificationState ?? 'REFERENCED'),
    humanReviewer: input.humanReviewer ?? null,
    humanReviewerRole: input.humanReviewerRole ?? null,
    scope: input.scope,
    confidentialContentOnPublicChain: false,
    slotPresenceIsProof: false,
  });
}

export function missingEvidence(providerId: string, evidenceClass: EvidenceClass, scope: string): ExternalProviderEvidenceRecord {
  return createEvidenceRecord({
    recordId: `ev_${providerId}_${evidenceClass.toLowerCase()}`,
    providerId,
    evidenceClass,
    scope,
  });
}

export function refreshEvidenceState(
  record: ExternalProviderEvidenceRecord,
  nowUtc: string,
): ExternalProviderEvidenceRecord {
  if (record.verificationState === 'MISSING' || record.documentOrReferenceId.length === 0) {
    return Object.freeze({ ...record, verificationState: 'MISSING', slotPresenceIsProof: false as const });
  }
  if (record.expiresAtUtc && record.expiresAtUtc <= nowUtc) {
    return Object.freeze({ ...record, verificationState: 'STALE', slotPresenceIsProof: false as const });
  }
  return record;
}

export function evidenceIsCurrent(record: ExternalProviderEvidenceRecord, nowUtc: string): boolean {
  const refreshed = refreshEvidenceState(record, nowUtc);
  return refreshed.verificationState !== 'MISSING' && refreshed.verificationState !== 'STALE';
}

export function contractRemainsMissing(record: ExternalProviderEvidenceRecord): boolean {
  return record.evidenceClass === 'SERVICE_CONTRACT' && (record.verificationState === 'MISSING' || record.documentOrReferenceId.length === 0);
}

export function licenseRemainsMissing(record: ExternalProviderEvidenceRecord): boolean {
  return record.evidenceClass === 'LICENSE_REGISTRATION' && (record.verificationState === 'MISSING' || record.documentOrReferenceId.length === 0);
}

export function markEvidenceHumanReviewed(
  record: ExternalProviderEvidenceRecord,
  actor: { readonly kind: ReviewerKind; readonly reviewerId: string; readonly role: HumanReviewerRole },
  nowUtc: string,
): ProviderAcceptanceResult<ExternalProviderEvidenceRecord> {
  if (actor.kind === 'AI') {
    return acceptanceErr(
      'AI_CANNOT_HUMAN_ACCEPT',
      'AI may summarize evidence but cannot mark HUMAN_REVIEWED, HUMAN_ACCEPTED, or PRODUCTION_ELIGIBLE',
    );
  }
  const current = refreshEvidenceState(record, nowUtc);
  if (current.verificationState === 'MISSING' || current.verificationState === 'STALE') {
    return acceptanceErr('EVIDENCE_NOT_CURRENT', `evidence ${record.recordId} is ${current.verificationState}`);
  }
  return acceptanceOk(
    Object.freeze({
      ...current,
      verificationState: 'HUMAN_REVIEWED',
      humanReviewer: actor.reviewerId,
      humanReviewerRole: actor.role,
      slotPresenceIsProof: false,
      confidentialContentOnPublicChain: false,
    }),
  );
}

export function summarizeEvidenceForAi(record: ExternalProviderEvidenceRecord): {
  readonly recordId: string;
  readonly evidenceClass: EvidenceClass;
  readonly verificationState: ExternalProviderEvidenceRecord['verificationState'];
  readonly expiresAtUtc: string | null;
  readonly slotPresenceIsProof: false;
  readonly mayMarkHumanAccepted: false;
} {
  return Object.freeze({
    recordId: record.recordId,
    evidenceClass: record.evidenceClass,
    verificationState: record.verificationState,
    expiresAtUtc: record.expiresAtUtc,
    slotPresenceIsProof: false,
    mayMarkHumanAccepted: false,
  });
}

export function assertNoSecretInEvidenceReport(value: unknown): ProviderAcceptanceResult<true> {
  const text = JSON.stringify(value);
  if (/secret:\/\/[^[\s"]+|BEGIN [A-Z ]+PRIVATE KEY|api[_-]?key\s*[:=]|client_secret\s*[:=]/i.test(text)) {
    return acceptanceErr('SECRET_IN_REPORT', 'provider evidence reports must not contain secret values');
  }
  return acceptanceOk(true);
}
