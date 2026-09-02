import { commitCanonical } from '../hash.ts';

import type { EvidenceCommitment } from './commitment.ts';
import { EVIDENCE_STATUS_DOMAIN } from './constants.ts';

export const EVIDENCE_STATUS_KINDS = [
  'CHALLENGED',
  'SUPERSEDED',
  'REVOKED',
  'INVALIDATED',
] as const;

export type EvidenceStatusKind = (typeof EVIDENCE_STATUS_KINDS)[number];

/**
 * Append-only status overlay. Finalized block commitments are never rewritten;
 * downstream consumers apply the latest status record when interpreting evidence.
 */
export type EvidenceStatusRecord = {
  readonly statusId: string;
  readonly priorCommitmentHash: string;
  readonly status: EvidenceStatusKind;
  readonly effectiveAt: string;
  readonly reasonCode: string;
  readonly supersedingCommitmentHash: string | null;
};

export function createEvidenceStatusRecord(input: {
  readonly priorCommitment: EvidenceCommitment;
  readonly status: EvidenceStatusKind;
  readonly effectiveAt: string;
  readonly reasonCode: string;
  readonly supersedingCommitment?: EvidenceCommitment | null;
}): EvidenceStatusRecord {
  const statusId = commitCanonical({
    domain: EVIDENCE_STATUS_DOMAIN,
    priorCommitmentHash: input.priorCommitment.commitmentHash,
    status: input.status,
    effectiveAt: input.effectiveAt,
    reasonCode: input.reasonCode,
    supersedingCommitmentHash: input.supersedingCommitment?.commitmentHash ?? null,
  });
  return Object.freeze({
    statusId,
    priorCommitmentHash: input.priorCommitment.commitmentHash,
    status: input.status,
    effectiveAt: input.effectiveAt,
    reasonCode: input.reasonCode,
    supersedingCommitmentHash: input.supersedingCommitment?.commitmentHash ?? null,
  });
}

export function latestStatusForCommitment(
  records: readonly EvidenceStatusRecord[],
  commitmentHash: string,
): EvidenceStatusRecord | null {
  const matches = records
    .filter((record) => record.priorCommitmentHash === commitmentHash)
    .sort((left, right) => right.effectiveAt.localeCompare(left.effectiveAt));
  return matches[0] ?? null;
}
