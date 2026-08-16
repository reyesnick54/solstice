import {
  type ValidatorEvent,
  type ValidatorRecord,
  type ValidatorResult,
  type ValidatorStatus,
  validatorErr,
  validatorOk,
} from './types.ts';

const ALLOWED: Readonly<Record<ValidatorStatus, readonly ValidatorStatus[]>> = {
  CANDIDATE: ['BONDED'],
  BONDED: ['PENDING_ACTIVATION', 'JAILED'],
  PENDING_ACTIVATION: ['ACTIVE', 'JAILED'],
  ACTIVE: ['PENDING_EXIT', 'JAILED'],
  PENDING_EXIT: ['EXITED', 'JAILED'],
  JAILED: ['TOMBSTONED', 'BONDED'],
  TOMBSTONED: [],
  EXITED: [],
};

const REASON_FOR: Readonly<Record<string, ValidatorEvent['reason']>> = {
  'CANDIDATE->BONDED': 'BOND_ACCEPTED',
  'BONDED->PENDING_ACTIVATION': 'QUEUED_FOR_EPOCH',
  'PENDING_ACTIVATION->ACTIVE': 'EPOCH_BOUNDARY_ACTIVATE',
  'ACTIVE->PENDING_EXIT': 'EXIT_SCHEDULED',
  'PENDING_EXIT->EXITED': 'EPOCH_BOUNDARY_EXIT',
  'ACTIVE->JAILED': 'JAIL_EVIDENCE',
  'BONDED->JAILED': 'JAIL_EVIDENCE',
  'PENDING_ACTIVATION->JAILED': 'JAIL_EVIDENCE',
  'PENDING_EXIT->JAILED': 'JAIL_EVIDENCE',
  'JAILED->TOMBSTONED': 'TOMBSTONE_EQUIVOCATION',
  'JAILED->BONDED': 'RESTORE_ELIGIBLE',
};

export function allowedTransitions(from: ValidatorStatus): readonly ValidatorStatus[] {
  return ALLOWED[from];
}

export function transitionValidator(
  record: ValidatorRecord,
  to: ValidatorStatus,
  height: bigint,
  epoch: bigint,
  atUtc: string,
): ValidatorResult<{ readonly record: ValidatorRecord; readonly event: ValidatorEvent }> {
  const allowed = ALLOWED[record.status];
  if (!allowed.includes(to)) {
    return validatorErr(
      'UNDEFINED_TRANSITION',
      `undefined validator transition ${record.status} -> ${to}`,
    );
  }
  const reason = REASON_FOR[`${record.status}->${to}`];
  if (!reason) {
    return validatorErr('UNDEFINED_TRANSITION', `missing reason for ${record.status} -> ${to}`);
  }
  const next: ValidatorRecord = Object.freeze({
    ...record,
    status: to,
    updatedHeight: height,
    exitEpoch: to === 'PENDING_EXIT' ? epoch + 1n : to === 'EXITED' ? epoch : record.exitEpoch,
  });
  const event: ValidatorEvent = Object.freeze({
    kind: 'VALIDATOR_TRANSITION',
    validatorId: record.validatorId,
    from: record.status,
    to,
    reason,
    height,
    epoch,
    atUtc,
  });
  return validatorOk({ record: next, event });
}
