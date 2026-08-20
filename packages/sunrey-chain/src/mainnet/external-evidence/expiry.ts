/**
 * Evidence freshness. Expiry immediately removes eligibility.
 * History is not deleted.
 */

import type {
  ExternalEvidenceFreshness,
  ExternalEvidenceVerificationState,
  ExternalProductionEvidenceRecord,
} from './types.ts';

export function freshnessOf(
  record: Pick<
    ExternalProductionEvidenceRecord,
    'revoked' | 'expiresAtUtc' | 'reviewDueAtUtc' | 'verificationState'
  >,
  nowUtc: string,
): ExternalEvidenceFreshness {
  if (record.revoked || record.verificationState === 'REVOKED') {
    return 'REVOKED';
  }
  if (record.verificationState === 'EXPIRED' || (record.expiresAtUtc !== null && record.expiresAtUtc <= nowUtc)) {
    return 'EXPIRED';
  }
  if (record.reviewDueAtUtc !== null && record.reviewDueAtUtc <= nowUtc) {
    return 'REVIEW_DUE';
  }
  return 'CURRENT';
}

export function applyFreshness(
  record: ExternalProductionEvidenceRecord,
  nowUtc: string,
): ExternalProductionEvidenceRecord {
  const freshness = freshnessOf(record, nowUtc);
  if (freshness === 'EXPIRED' && record.verificationState !== 'EXPIRED' && record.verificationState !== 'REVOKED' && record.verificationState !== 'SUPERSEDED') {
    return Object.freeze({ ...record, verificationState: 'EXPIRED' as const });
  }
  if (freshness === 'REVOKED' && record.verificationState !== 'REVOKED' && record.verificationState !== 'SUPERSEDED') {
    return Object.freeze({ ...record, verificationState: 'REVOKED' as const, revoked: true });
  }
  return record;
}

export function isCurrentForEligibility(
  record: ExternalProductionEvidenceRecord,
  nowUtc: string,
): boolean {
  const freshness = freshnessOf(record, nowUtc);
  return freshness === 'CURRENT' || freshness === 'REVIEW_DUE';
}

export function expiredBlocksEligibility(
  record: ExternalProductionEvidenceRecord,
  nowUtc: string,
): boolean {
  return freshnessOf(record, nowUtc) === 'EXPIRED';
}

export function stateAfterExpiry(
  state: ExternalEvidenceVerificationState,
  nowUtc: string,
  expiresAtUtc: string | null,
): ExternalEvidenceVerificationState {
  if (state === 'REVOKED' || state === 'SUPERSEDED' || state === 'REJECTED') {
    return state;
  }
  if (expiresAtUtc !== null && expiresAtUtc <= nowUtc) {
    return 'EXPIRED';
  }
  return state;
}
