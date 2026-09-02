import type { UtcInstant } from '../../../../domain/src/time.ts';
import { classificationPermitsOnChainCommitment } from './classification.ts';
import type { OffChainRecordReference } from './types.ts';
import type { HumanDataClassification } from './taxonomy.ts';

export type CommitmentEntropyAssessment = {
  readonly commitment: string;
  readonly classification: HumanDataClassification;
  readonly lowEntropyRisk: boolean;
  readonly onChainPermitted: boolean;
  readonly recommendation: 'SAFE_COMMITMENT' | 'SALT_REQUIRED' | 'OFF_CHAIN_ONLY';
};

/**
 * Evaluates whether an on-chain commitment could expose sensitive low-entropy
 * information through brute-force guessing. Does not implement salting — flags risk.
 */
export function assessCommitmentEntropy(input: {
  readonly commitment: string;
  readonly classification: HumanDataClassification;
  readonly labelCount?: number;
}): CommitmentEntropyAssessment {
  const onChainPermitted = classificationPermitsOnChainCommitment(input.classification);
  const lowEntropyRisk = input.classification === 'HIGHLY_RESTRICTED'
    || input.classification === 'SENSITIVE_PERSONAL'
    || (input.labelCount !== undefined && input.labelCount < 3);

  const recommendation: CommitmentEntropyAssessment['recommendation'] =
    !onChainPermitted ? 'OFF_CHAIN_ONLY'
      : lowEntropyRisk ? 'SALT_REQUIRED'
        : 'SAFE_COMMITMENT';

  return Object.freeze({
    commitment: input.commitment,
    classification: input.classification,
    lowEntropyRisk,
    onChainPermitted,
    recommendation,
  });
}

export type OffChainDeletionOutcome = {
  readonly recordRefId: string;
  readonly deletedAt: UtcInstant;
  readonly onChainCommitmentPreserved: true;
  readonly historicalProofValid: true;
  readonly futureUseBlocked: true;
};

/**
 * Raw off-chain records may be deleted without mutating blockchain history.
 * On-chain commitments and historical authorization proofs remain valid.
 */
export function handleOffChainRecordDeletion(
  record: OffChainRecordReference,
  deletedAt: UtcInstant,
): { readonly updatedRecord: OffChainRecordReference; readonly outcome: OffChainDeletionOutcome } {
  const updatedRecord: OffChainRecordReference = Object.freeze({
    ...record,
    deletedAt,
  });

  const outcome: OffChainDeletionOutcome = Object.freeze({
    recordRefId: record.recordRefId,
    deletedAt,
    onChainCommitmentPreserved: true,
    historicalProofValid: true,
    futureUseBlocked: true,
  });

  return Object.freeze({ updatedRecord, outcome });
}

export function offChainRecordAvailableForFutureUse(
  record: OffChainRecordReference,
  at: UtcInstant,
): boolean {
  if (record.deletedAt !== null && record.deletedAt <= at) {
    return false;
  }
  if (record.expiresAt !== null && record.expiresAt <= at) {
    return false;
  }
  return true;
}

export function historicalCommitmentRemainsValidAfterDeletion(
  record: OffChainRecordReference,
): boolean {
  return record.commitment.length > 0;
}
