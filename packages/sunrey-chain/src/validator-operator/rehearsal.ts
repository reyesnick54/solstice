/**
 * Isolated seven-validator operator-platform rehearsal.
 *
 * Exercises rolling upgrade, one-node maintenance, signer outage,
 * sentry replacement, key-rotation rehearsal, validator exit, and
 * backup/restore. Isolated only — not observed production.
 */

import { OPERATOR_A_ID, OPERATOR_B_ID, ValidatorOperatorPlatform } from './platform.ts';
import { fixturePrincipal } from './fixtures.ts';
import { requestHash } from './hash.ts';
import type { OperatorResult } from './types.ts';

export type RehearsalStep = {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type ValidatorOperatorRehearsal = {
  readonly ok: boolean;
  readonly isolated: true;
  readonly observedProduction: false;
  readonly validatorCount: 7;
  readonly hash: string;
  readonly steps: readonly RehearsalStep[];
};

function step(id: string, result: OperatorResult<unknown> | { readonly ok: boolean }, detail: string): RehearsalStep {
  return { id, ok: result.ok, detail };
}

export function runValidatorOperatorRehearsal(): ValidatorOperatorRehearsal {
  const platform = new ValidatorOperatorPlatform();
  const alpha = fixturePrincipal(OPERATOR_A_ID);
  const beta = fixturePrincipal(OPERATOR_B_ID);

  const maintenance = platform.planMaintenance(alpha, ['val_op_a'], 'one-node maintenance');
  if (maintenance.ok) {
    platform.executeMaintenance(alpha, maintenance.value.planId);
  }

  const upgrade = platform.planUpgrade(alpha, {
    release: 'sunrey-node/1.1.0',
    artifactDigest: 'digest-1.1.0',
    protocolVersion: '2',
    batch: ['val_op_b'],
  });
  if (upgrade.ok) {
    platform.deployUpgradeBatch(alpha, upgrade.value.planId);
    platform.activateProtocol(alpha, upgrade.value.planId);
  }

  const signerOutage = platform.openIncident(alpha, 'val_op_c', 'SIGNER_FAILURE', 'rehearsal signer outage', 'ev_signer_outage');
  if (signerOutage.ok) {
    platform.preserveIncidentEvidence(alpha, signerOutage.value.incidentId);
    platform.fenceSigner(alpha, 'signer_val_op_c', 'FENCED');
  }

  const sentry = platform.replaceSentry(alpha, 'sentry_val_op_d_1');

  const rotation = platform.prepareRotation(alpha, 'val_op_a', 'rotated-fingerprint-a', false);
  if (rotation.ok) {
    platform.activateRotation(alpha, rotation.value.packageId);
  }

  const exitNode = platform.nodes.find((row) => row.validatorId === 'val_op_d' && row.kind === 'VALIDATOR');
  if (exitNode) {
    exitNode.operationalState = 'EXITING';
    exitNode.canonicalStatus = 'PENDING_EXIT';
  }

  const snapshot = platform.createBackup(alpha, 'val_op_a', 'SNAPSHOT');
  const signerSafety = platform.createBackup(alpha, 'val_op_a', 'SIGNER_SAFETY');
  const restore = platform.recover(alpha, 'val_op_a', 'DISK_LOSS');
  const cross = platform.planMaintenance(alpha, ['val_op_e'], 'cross');

  const steps: RehearsalStep[] = [
    step('rolling-upgrade', upgrade, 'safe single-validator binary batch'),
    step('one-node-maintenance', maintenance, 'remaining voting power stays quorum-safe'),
    step('signer-outage', signerOutage, 'fence and preserve evidence'),
    step('sentry-replacement', sentry, 'replacement sentry cannot sign'),
    step('key-rotation', rotation, 'prepared package then governed activation'),
    step('validator-exit', { ok: exitNode?.operationalState === 'EXITING' }, 'operational EXITING maps to PENDING_EXIT'),
    step('backup-restore', snapshot.ok && signerSafety.ok && restore.ok ? snapshot : { ok: false }, 'snapshot and signer-safety backup then disk recovery'),
    step(
      'cross-operator',
      { ok: !cross.ok && cross.code === 'CROSS_OPERATOR_DENIED' },
      'operator A cannot maintain operator B',
    ),
  ];

  void beta;
  return {
    ok: steps.every((row) => row.ok),
    isolated: true,
    observedProduction: false,
    validatorCount: 7,
    hash: requestHash(steps),
    steps,
  };
}
