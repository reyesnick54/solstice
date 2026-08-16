import type { Epoch, ValidatorSet } from './types.ts';
import { validatorSetHash } from './set.ts';
import { activePower } from './set.ts';

export type ValidatorObservability = {
  readonly validator_status: readonly { readonly validatorId: string; readonly status: string }[];
  readonly validator_set_version: string;
  readonly validator_set_hash: string;
  readonly validator_voting_power: string;
  readonly epoch_number: string;
  readonly validator_key_rotation_pending: number;
  readonly validator_exit_pending: number;
  readonly signer_last_height: string | null;
  readonly signer_last_round: string | null;
  readonly signer_conflict_rejected: string;
  readonly bond_status: readonly { readonly validatorId: string; readonly kind: string }[];
};

export function observeValidatorPlane(input: {
  readonly set: ValidatorSet;
  readonly epoch: Epoch;
  readonly signerLastHeight?: bigint | null;
  readonly signerLastRound?: bigint | null;
  readonly signerConflictRejected?: bigint;
  readonly pendingRotations?: number;
}): ValidatorObservability {
  return Object.freeze({
    validator_status: input.set.validators.map((row) => ({
      validatorId: row.validatorId,
      status: row.status,
    })),
    validator_set_version: input.set.version.toString(),
    validator_set_hash: validatorSetHash(input.set),
    validator_voting_power: activePower(input.set).toString(),
    epoch_number: input.epoch.number.toString(),
    validator_key_rotation_pending: input.pendingRotations ?? 0,
    validator_exit_pending: input.set.validators.filter((row) => row.status === 'PENDING_EXIT').length,
    signer_last_height: input.signerLastHeight === undefined || input.signerLastHeight === null
      ? null
      : input.signerLastHeight.toString(),
    signer_last_round: input.signerLastRound === undefined || input.signerLastRound === null
      ? null
      : input.signerLastRound.toString(),
    signer_conflict_rejected: (input.signerConflictRejected ?? 0n).toString(),
    bond_status: input.set.validators.map((row) => ({
      validatorId: row.validatorId,
      kind: row.bondDescriptor.kind,
    })),
  });
}
