import { encodeBool, encodeString, encodeU32, encodeU64, valsetDomainHash } from './canonical.ts';
import { assertNoDuplicateConsensusKeys, assertSeparatedRecordKeys } from './keys.ts';
import { transitionValidator } from './lifecycle.ts';
import { assertPermittedValidatorController } from './controller.ts';
import {
  type Epoch,
  type QueuedChange,
  type TransitionReceipt,
  type ValidatorRecord,
  type ValidatorResult,
  type ValidatorSet,
  validatorErr,
  validatorOk,
} from './types.ts';
import { totalPower } from './voting-power.ts';

export function sortValidators(validators: readonly ValidatorRecord[]): ValidatorRecord[] {
  return [...validators].sort((a, b) => (a.validatorId < b.validatorId ? -1 : a.validatorId > b.validatorId ? 1 : 0));
}

export function encodeValidatorSet(set: ValidatorSet): Buffer {
  const ordered = sortValidators(set.validators);
  const parts: Buffer[] = [encodeU64(set.version), encodeU32(ordered.length)];
  for (const validator of ordered) {
    parts.push(
      encodeString(validator.validatorId),
      encodeString(validator.consensusPublicKey.publicKeyHex),
      encodeString(validator.cryptoSuiteId),
      encodeU64(validator.votingPower),
      encodeBool(validator.status === 'ACTIVE'),
    );
  }
  return Buffer.concat(parts);
}

export function validatorSetHash(set: ValidatorSet): string {
  return valsetDomainHash(encodeValidatorSet(set));
}

export function freezeValidatorSet(set: ValidatorSet): ValidatorSet {
  return Object.freeze({
    version: set.version,
    epoch: set.epoch,
    validators: Object.freeze(sortValidators(set.validators).map((row) => Object.freeze({ ...row }))),
  });
}

export function activePower(set: ValidatorSet): bigint {
  return totalPower(set.validators.filter((row) => row.status === 'ACTIVE').map((row) => row.votingPower));
}

export function assertSetInvariants(set: ValidatorSet): ValidatorResult<true> {
  const keys = assertNoDuplicateConsensusKeys(set.validators);
  if (!keys.ok) {
    return keys;
  }
  for (const record of set.validators) {
    const separated = assertSeparatedRecordKeys(record);
    if (!separated.ok) {
      return separated;
    }
  }
  return validatorOk(true);
}

function applyChange(
  validators: ValidatorRecord[],
  change: QueuedChange,
  epoch: Epoch,
  height: bigint,
  atUtc: string,
): ValidatorResult<ValidatorRecord[]> {
  const control = assertPermittedValidatorController(
    change.controllerKind ?? 'HUMAN',
    change.kind === 'JAIL_VALIDATOR'
      ? 'JAIL_VALIDATOR'
      : change.kind === 'RESTORE_ELIGIBLE_VALIDATOR'
        ? 'RESTORE_VALIDATOR'
        : change.kind === 'ROTATE_CONSENSUS_KEY'
          ? 'ROTATE_VALIDATOR_KEY'
          : change.kind === 'CHANGE_VOTING_POWER'
            ? 'ALTER_VOTING_POWER'
            : change.kind === 'SCHEDULE_EXIT'
              ? 'CHANGE_VALIDATOR_SET'
              : 'CHANGE_VALIDATOR_SET',
  );
  if (!control.ok) {
    return control;
  }
  if (change.kind === 'ADD_VALIDATOR') {
    if (!change.record) {
      return validatorErr('UNDEFINED_TRANSITION', 'ADD_VALIDATOR requires a record');
    }
    if (validators.some((row) => row.validatorId === change.record!.validatorId)) {
      return validatorErr('UNDEFINED_TRANSITION', 'validator already present');
    }
    const added = { ...change.record, status: 'PENDING_ACTIVATION' as const, activationEpoch: epoch.number };
    const separated = assertSeparatedRecordKeys(added);
    if (!separated.ok) {
      return separated;
    }
    return validatorOk([...validators, added]);
  }
  const index = validators.findIndex((row) => row.validatorId === change.validatorId);
  if (index < 0) {
    return validatorErr('UNDEFINED_TRANSITION', `unknown validator ${change.validatorId}`);
  }
  const current = validators[index]!;
  const next = [...validators];
  if (change.kind === 'ACTIVATE_VALIDATOR') {
    const moved = transitionValidator(current, 'ACTIVE', height, epoch.number, atUtc);
    if (!moved.ok) {
      return moved;
    }
    next[index] = moved.value.record;
    return validatorOk(next);
  }
  if (change.kind === 'CHANGE_VOTING_POWER') {
    if (change.votingPower === undefined || change.votingPower < 0n) {
      return validatorErr('FLOATING_POINT_FORBIDDEN', 'voting power must be a non-negative integer');
    }
    next[index] = { ...current, votingPower: change.votingPower, updatedHeight: height };
    return validatorOk(next);
  }
  if (change.kind === 'ROTATE_CONSENSUS_KEY') {
    if (!change.consensusPublicKey) {
      return validatorErr('KEY_ROLE_MISMATCH', 'rotation requires a new consensus public key');
    }
    if (change.consensusPublicKey.role !== 'CONSENSUS_VOTING_KEY') {
      return validatorErr('KEY_ROLE_MISMATCH', 'rotated key must be CONSENSUS_VOTING_KEY');
    }
    const history = [...current.historicalConsensusKeys, current.consensusPublicKey];
    next[index] = {
      ...current,
      consensusPublicKey: change.consensusPublicKey,
      historicalConsensusKeys: Object.freeze(history),
      updatedHeight: height,
    };
    return validatorOk(next);
  }
  if (change.kind === 'SCHEDULE_EXIT') {
    const moved = transitionValidator(current, current.status === 'ACTIVE' ? 'PENDING_EXIT' : current.status, height, epoch.number, atUtc);
    if (current.status === 'ACTIVE') {
      if (!moved.ok) {
        return moved;
      }
      next[index] = moved.value.record;
      return validatorOk(next);
    }
    return validatorErr('UNDEFINED_TRANSITION', 'only ACTIVE validators may schedule exit');
  }
  if (change.kind === 'JAIL_VALIDATOR') {
    const moved = transitionValidator(current, 'JAILED', height, epoch.number, atUtc);
    if (!moved.ok) {
      return moved;
    }
    next[index] = moved.value.record;
    return validatorOk(next);
  }
  if (change.kind === 'RESTORE_ELIGIBLE_VALIDATOR') {
    if (current.status === 'TOMBSTONED') {
      return validatorErr('UNDEFINED_TRANSITION', 'tombstoned validators cannot be restored');
    }
    const moved = transitionValidator(current, 'BONDED', height, epoch.number, atUtc);
    if (!moved.ok) {
      return moved;
    }
    next[index] = moved.value.record;
    return validatorOk(next);
  }
  return validatorErr('UNDEFINED_TRANSITION', `unknown change ${change.kind}`);
}

export function applyEpochBoundary(
  current: ValidatorSet,
  currentEpoch: Epoch,
  nextEpoch: Epoch,
  queued: readonly QueuedChange[],
  height: bigint,
  atUtc: string,
): ValidatorResult<{
  readonly nextValidatorSet: ValidatorSet;
  readonly nextValidatorSetHash: string;
  readonly transitionReceipt: TransitionReceipt;
  readonly rejectedChanges: readonly { readonly change: QueuedChange; readonly reason: string }[];
}> {
  if (height < currentEpoch.endHeight) {
    return validatorErr('ACTIVE_SET_IMMUTABLE', 'active validator set is immutable during an epoch');
  }
  if (nextEpoch.number !== currentEpoch.number + 1n) {
    return validatorErr('EPOCH_NOT_STARTED', 'validator changes apply only at the next epoch boundary');
  }
  let validators = [...current.validators];
  const applied: TransitionReceipt['applied'] = [];
  const rejected: { readonly change: QueuedChange; readonly reason: string }[] = [];
  const due = queued.filter((change) => change.activationEpoch === nextEpoch.number);
  for (const change of due) {
    const result = applyChange(validators, change, nextEpoch, height, atUtc);
    if (!result.ok) {
      rejected.push({ change, reason: result.error.message });
      continue;
    }
    validators = result.value;
    applied.push(change.kind);
  }
  validators = validators.map((row) => {
    if (row.status === 'PENDING_ACTIVATION' && row.activationEpoch <= nextEpoch.number) {
      const moved = transitionValidator(row, 'ACTIVE', height, nextEpoch.number, atUtc);
      return moved.ok ? moved.value.record : row;
    }
    if (row.status === 'PENDING_EXIT' && row.exitEpoch !== null && row.exitEpoch <= nextEpoch.number) {
      const moved = transitionValidator(row, 'EXITED', height, nextEpoch.number, atUtc);
      return moved.ok ? moved.value.record : row;
    }
    return row;
  });
  const next = freezeValidatorSet({
    version: current.version + 1n,
    epoch: nextEpoch.number,
    validators,
  });
  const invariants = assertSetInvariants(next);
  if (!invariants.ok) {
    return invariants;
  }
  const hash = validatorSetHash(next);
  return validatorOk({
    nextValidatorSet: next,
    nextValidatorSetHash: hash,
    transitionReceipt: Object.freeze({
      fromVersion: current.version,
      toVersion: next.version,
      fromEpoch: currentEpoch.number,
      toEpoch: nextEpoch.number,
      applied: Object.freeze([...applied]),
      nextValidatorSetHash: hash,
    }),
    rejectedChanges: Object.freeze(rejected),
  });
}

export function mutateActiveSetDuringEpoch(): ValidatorResult<never> {
  return validatorErr('ACTIVE_SET_IMMUTABLE', 'the active set for an already-started epoch is immutable');
}
