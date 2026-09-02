/**
 * BFT deterministic finality semantics.
 *
 * Local execution and block observation are not network finality.
 * FINALIZED requires a quorum commit certificate from the consensus engine.
 */

import { createHash } from 'node:crypto';

import type { CommitCertificate, ValidatorPower } from './types.ts';

export const BFT_FAULT_THRESHOLD_NUMERATOR = 1n;
export const BFT_FAULT_THRESHOLD_DENOMINATOR = 3n;

export function totalVotingPower(validators: readonly ValidatorPower[]): bigint {
  return validators.reduce((sum, row) => sum + row.votingPower, 0n);
}

export function quorumPower(total: bigint): bigint {
  return (total * 2n) / 3n + 1n;
}

export function bftQuorumSatisfied(power: bigint, total: bigint): boolean {
  return power >= quorumPower(total);
}

export function buildCommitCertificate(input: {
  readonly height: bigint;
  readonly round: number;
  readonly blockHash: string;
  readonly validatorSetVersion: bigint;
  readonly voters: readonly string[];
}): CommitCertificate {
  const certificateHash = createHash('sha256')
    .update(
      [
        String(input.height),
        String(input.round),
        input.blockHash,
        String(input.validatorSetVersion),
        [...input.voters].sort().join(','),
      ].join('|'),
    )
    .digest('hex');
  return Object.freeze({
    height: input.height,
    round: input.round,
    blockHash: input.blockHash,
    validatorSetVersion: input.validatorSetVersion,
    voterIds: Object.freeze([...input.voters].sort()),
    certificateHash,
  });
}

export function verifyCommitCertificate(
  certificate: CommitCertificate,
  validators: readonly ValidatorPower[],
  expectedBlockHash: string,
): boolean {
  if (certificate.blockHash !== expectedBlockHash) {
    return false;
  }
  const voterPower = certificate.voterIds.reduce((sum, voterId) => {
    const validator = validators.find((row) => row.validatorId === voterId);
    return sum + (validator?.votingPower ?? 0n);
  }, 0n);
  return bftQuorumSatisfied(voterPower, totalVotingPower(validators));
}

export type FinalityObservation = {
  readonly finalized: boolean;
  readonly source: 'LOCAL_EXECUTION' | 'COMMIT_CERTIFICATE' | 'REJECTION';
  readonly localObservationIsNotFinality: boolean;
};

export function observeFinality(source: FinalityObservation['source']): FinalityObservation {
  return Object.freeze({
    finalized: source === 'COMMIT_CERTIFICATE',
    source,
    localObservationIsNotFinality: source !== 'COMMIT_CERTIFICATE',
  });
}
