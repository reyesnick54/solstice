import type { EvidenceRecord } from '../../../evidence/src/vault.ts';

import { createEvidenceCommitment, type EvidenceCommitment, type EvidenceVerificationMetadata } from './commitment.ts';

export function evidenceCommitmentFromVaultRecord(
  record: EvidenceRecord,
  input: {
    readonly evidenceType: string;
    readonly provenanceHash: string;
    readonly issuerProvider: string;
    readonly verification: EvidenceVerificationMetadata;
  },
): EvidenceCommitment {
  return createEvidenceCommitment({
    evidenceId: record.evidenceId,
    evidenceType: input.evidenceType,
    contentHash: record.payloadSha256,
    provenanceHash: input.provenanceHash,
    issuerProvider: input.issuerProvider,
    temporalRef: record.sealedAt,
    verification: input.verification,
  });
}

export function vaultChainTipHash(records: readonly EvidenceRecord[]): string | null {
  if (records.length === 0) {
    return null;
  }
  return records[records.length - 1]!.recordSha256;
}
