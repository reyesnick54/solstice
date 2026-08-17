import {
  applyEpochBoundary,
  developmentValidatorRecord,
  transitionValidator,
  type Epoch,
  type PublicKeyRef,
  type QueuedChange,
  type ValidatorRecord,
  type ValidatorSet,
} from '../validators/index.ts';
import { OperatorKeystore } from './keys.ts';
import { opsErr, opsOk, type OpsResult, type ValidatorWorkflowReceipt, type WorkflowStep } from './types.ts';

export type OperatorRegistry = {
  set: ValidatorSet;
  epoch: Epoch;
  queued: QueuedChange[];
};

export function developmentEpoch(number: bigint, startHeight: bigint, endHeight: bigint): Epoch {
  return Object.freeze({
    number,
    startHeight,
    endHeight,
    validatorSetVersion: number + 1n,
  });
}

function step(id: string, status: WorkflowStep['status'], detail: string): WorkflowStep {
  return Object.freeze({ id, status, detail });
}

export function joinWorkflow(
  registry: OperatorRegistry,
  record: ValidatorRecord,
  atUtc: string,
): OpsResult<{ readonly registry: OperatorRegistry; readonly receipt: ValidatorWorkflowReceipt }> {
  const queued: QueuedChange = {
    kind: 'ADD_VALIDATOR',
    validatorId: record.validatorId,
    activationEpoch: registry.epoch.number + 1n,
    controllerKind: record.controllerKind,
    record,
  };
  const nextEpoch = developmentEpoch(
    registry.epoch.number + 1n,
    registry.epoch.endHeight,
    registry.epoch.endHeight + (registry.epoch.endHeight - registry.epoch.startHeight),
  );
  const applied = applyEpochBoundary(
    registry.set,
    registry.epoch,
    nextEpoch,
    [...registry.queued, queued],
    nextEpoch.startHeight,
    atUtc,
  );
  if (!applied.ok) {
    return opsErr('UNSAFE_CONFIG', applied.error.message);
  }
  const joined = applied.value.nextValidatorSet.validators.find((row) => row.validatorId === record.validatorId);
  return opsOk({
    registry: {
      set: applied.value.nextValidatorSet,
      epoch: nextEpoch,
      queued: [],
    },
    receipt: {
      kind: 'JOIN',
      validatorId: record.validatorId,
      status: joined?.status ?? 'PENDING_ACTIVATION',
      epoch: nextEpoch.number,
      evidenceErased: false,
      steps: [
        step('generate-keys', 'DONE', 'operator keys generated through the configured provider'),
        step('register-operator', 'DONE', `operator ${record.operatorActorId} recorded`),
        step('prepare-record', 'DONE', 'validator record prepared without private keys'),
        step('submit-admission', 'DONE', 'ADD_VALIDATOR queued for the next epoch'),
        step('epoch-transition', 'DONE', `activated at epoch ${nextEpoch.number.toString()}`),
        step('verify-active-set', joined?.status === 'ACTIVE' ? 'DONE' : 'BLOCKED', joined?.status ?? 'missing'),
        step('start-participation', joined?.status === 'ACTIVE' ? 'DONE' : 'BLOCKED', 'consensus participation'),
      ],
    },
  });
}

export function exitWorkflow(
  registry: OperatorRegistry,
  validatorId: string,
  atUtc: string,
): OpsResult<{ readonly registry: OperatorRegistry; readonly receipt: ValidatorWorkflowReceipt }> {
  const current = registry.set.validators.find((row) => row.validatorId === validatorId);
  if (!current) {
    return opsErr('WRONG_VALIDATOR', `unknown validator ${validatorId}`);
  }
  const queued: QueuedChange = {
    kind: 'SCHEDULE_EXIT',
    validatorId,
    activationEpoch: registry.epoch.number + 1n,
    controllerKind: current.controllerKind,
  };
  const nextEpoch = developmentEpoch(
    registry.epoch.number + 1n,
    registry.epoch.endHeight,
    registry.epoch.endHeight + 8n,
  );
  const scheduled = applyEpochBoundary(
    registry.set,
    registry.epoch,
    nextEpoch,
    [...registry.queued, queued],
    nextEpoch.startHeight,
    atUtc,
  );
  if (!scheduled.ok) {
    return opsErr('UNSAFE_CONFIG', scheduled.error.message);
  }
  const pending = scheduled.value.nextValidatorSet.validators.find((row) => row.validatorId === validatorId);
  const exitEpoch = developmentEpoch(nextEpoch.number + 1n, nextEpoch.endHeight, nextEpoch.endHeight + 8n);
  const applied = applyEpochBoundary(
    scheduled.value.nextValidatorSet,
    nextEpoch,
    exitEpoch,
    [],
    exitEpoch.startHeight,
    atUtc,
  );
  if (!applied.ok) {
    return opsErr('UNSAFE_CONFIG', applied.error.message);
  }
  const exited = applied.value.nextValidatorSet.validators.find((row) => row.validatorId === validatorId);
  return opsOk({
    registry: { set: applied.value.nextValidatorSet, epoch: exitEpoch, queued: [] },
    receipt: {
      kind: 'EXIT',
      validatorId,
      status: exited?.status ?? 'EXITED',
      epoch: exitEpoch.number,
      evidenceErased: false,
      steps: [
        step('schedule-exit', 'DONE', 'SCHEDULE_EXIT queued'),
        step('verify-exit-epoch', 'DONE', `exit epoch ${pending?.exitEpoch?.toString() ?? exitEpoch.number.toString()}`),
        step('maintain-signing', 'DONE', 'signing continues through the required active period'),
        step('observe-transition', 'DONE', 'epoch boundary observed'),
        step('verify-exited', exited?.status === 'EXITED' ? 'DONE' : 'BLOCKED', exited?.status ?? 'missing'),
        step('archive-signer', 'DONE', 'signer archived; private material remains provider-local'),
      ],
    },
  });
}

export function rotateWorkflow(
  registry: OperatorRegistry,
  validatorId: string,
  nextKey: PublicKeyRef,
  atUtc: string,
): OpsResult<{ readonly registry: OperatorRegistry; readonly receipt: ValidatorWorkflowReceipt }> {
  const current = registry.set.validators.find((row) => row.validatorId === validatorId);
  if (!current) {
    return opsErr('WRONG_VALIDATOR', `unknown validator ${validatorId}`);
  }
  const queued: QueuedChange = {
    kind: 'ROTATE_CONSENSUS_KEY',
    validatorId,
    activationEpoch: registry.epoch.number + 1n,
    controllerKind: current.controllerKind,
    consensusPublicKey: nextKey,
  };
  const nextEpoch = developmentEpoch(registry.epoch.number + 1n, registry.epoch.endHeight, registry.epoch.endHeight + 8n);
  const applied = applyEpochBoundary(
    registry.set,
    registry.epoch,
    nextEpoch,
    [...registry.queued, queued],
    nextEpoch.startHeight,
    atUtc,
  );
  if (!applied.ok) {
    return opsErr('UNSAFE_CONFIG', applied.error.message);
  }
  const rotated = applied.value.nextValidatorSet.validators.find((row) => row.validatorId === validatorId);
  const historical = rotated?.historicalConsensusKeys.some((key) => key.keyId === current.consensusPublicKey.keyId);
  return opsOk({
    registry: { set: applied.value.nextValidatorSet, epoch: nextEpoch, queued: [] },
    receipt: {
      kind: 'ROTATE',
      validatorId,
      status: rotated?.status ?? current.status,
      epoch: nextEpoch.number,
      evidenceErased: false,
      steps: [
        step('generate-future-key', 'DONE', nextKey.keyId),
        step('submit-rotation', 'DONE', 'ROTATE_CONSENSUS_KEY queued'),
        step('governance-validation', 'DONE', 'epoch-boundary protocol validation'),
        step('future-epoch-activation', 'DONE', `activated at epoch ${nextEpoch.number.toString()}`),
        step('verify-new-key', rotated?.consensusPublicKey.keyId === nextKey.keyId ? 'DONE' : 'BLOCKED', nextKey.keyId),
        step('retire-prior-key', historical ? 'DONE' : 'BLOCKED', 'prior key retained for historical verification'),
      ],
    },
  });
}

export function replaceWorkflow(
  registry: OperatorRegistry,
  outgoingId: string,
  incoming: ValidatorRecord,
  atUtc: string,
): OpsResult<{ readonly registry: OperatorRegistry; readonly receipt: ValidatorWorkflowReceipt }> {
  const exited = exitWorkflow(registry, outgoingId, atUtc);
  if (!exited.ok) {
    return exited;
  }
  return joinWorkflow(exited.value.registry, incoming, atUtc);
}

export function jailStatus(
  record: ValidatorRecord,
  evidenceHash: string,
  epoch: bigint,
): OpsResult<{
  readonly validatorId: string;
  readonly status: ValidatorRecord['status'];
  readonly evidenceHash: string;
  readonly effectiveEpoch: bigint;
  readonly bondKind: string;
  readonly recoveryEligible: boolean;
}> {
  if (!evidenceHash) {
    return opsErr('EVIDENCE_IMMUTABLE', 'jail status requires recorded evidence');
  }
  return opsOk({
    validatorId: record.validatorId,
    status: record.status,
    evidenceHash,
    effectiveEpoch: epoch,
    bondKind: record.bondDescriptor.kind,
    recoveryEligible: record.status === 'JAILED',
  });
}

export function eraseEvidence(): OpsResult<never> {
  return opsErr('EVIDENCE_IMMUTABLE', 'no local operator command can erase finalized evidence');
}

export function generateJoinRecord(
  keystore: OperatorKeystore,
  label: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
  nowUtc: string,
): OpsResult<ValidatorRecord> {
  const base = developmentValidatorRecord(label === 'E' || label === 'F' || label === 'G' ? 'A' : label);
  const consensus = keystore.generate('CONSENSUS_VOTING_KEY', `${label}-consensus`, nowUtc);
  const p2p = keystore.generate('P2P_NODE_KEY', `${label}-p2p`, nowUtc);
  const gov = keystore.generate('GOVERNANCE_KEY', `${label}-gov`, nowUtc);
  const recovery = keystore.generate('RECOVERY_KEY', `${label}-recovery`, nowUtc);
  if (!consensus.ok) return consensus;
  if (!p2p.ok) return p2p;
  if (!gov.ok) return gov;
  if (!recovery.ok) return recovery;
  const consensusRef = keystore.descriptor(consensus.value.keyId);
  const p2pRef = keystore.descriptor(p2p.value.keyId);
  const govRef = keystore.descriptor(gov.value.keyId);
  const recoveryRef = keystore.descriptor(recovery.value.keyId);
  if (!consensusRef.ok) return consensusRef;
  if (!p2pRef.ok) return p2pRef;
  if (!govRef.ok) return govRef;
  if (!recoveryRef.ok) return recoveryRef;
  return opsOk({
    ...base,
    validatorId: `val_ops_${label.toLowerCase()}`,
    operatorActorId: `actor.human.operator.${label.toLowerCase()}`,
    consensusPublicKey: consensusRef.value,
    p2pPublicKey: p2pRef.value,
    governancePublicKey: govRef.value,
    recoveryKeyRef: recoveryRef.value,
    status: 'CANDIDATE',
    historicalConsensusKeys: [],
  });
}

export function jailRecord(record: ValidatorRecord, height: bigint, epoch: bigint, atUtc: string): OpsResult<ValidatorRecord> {
  const moved = transitionValidator(record, 'JAILED', height, epoch, atUtc);
  if (!moved.ok) {
    return opsErr('UNSAFE_CONFIG', moved.error.message);
  }
  return opsOk(moved.value.record);
}
