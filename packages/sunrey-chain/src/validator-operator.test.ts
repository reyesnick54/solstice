import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import {
  AI_CANNOT_CAST_VALIDATOR_VOTE,
  BINARY_DEPLOY_DOES_NOT_ACTIVATE_PROTOCOL,
  CANDIDATE_V2_ID,
  CANONICAL_STATUS_MAP,
  CANONICAL_VALIDATOR_SET_AUTHORITATIVE,
  DIFFERENT_VALIDATOR_IDS_DO_NOT_IMPLY_INDEPENDENCE,
  MONITORING_SUSPICION_IS_NOT_FINALIZED_MISCONDUCT,
  NO_GOVERNANCE_TOKEN,
  NO_PUBLIC_DELEGATED_STAKING,
  OPERATOR_A_ID,
  OPERATOR_B_ID,
  OPERATOR_CANNOT_DEBIT_CUSTOMER_ASSETS,
  SENTRIES_CANNOT_SIGN,
  ValidatorOperatorPlatform,
  fixturePrincipal,
  rehearsalCandidateV2Id,
  rehearsalDossierValidatorId,
  runValidatorOperatorCommand,
  runValidatorOperatorRehearsal,
  sharedAdminSecretForbidden,
} from './validator-operator/index.ts';

describe('Chunk 92 validator operator platform', () => {
  it('keeps simulation posture and does not duplicate consensus authority', () => {
    const platform = new ValidatorOperatorPlatform();
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(CANONICAL_VALIDATOR_SET_AUTHORITATIVE, true);
    assert.equal(NO_PUBLIC_DELEGATED_STAKING, true);
    assert.equal(NO_GOVERNANCE_TOKEN, true);
    assert.equal(OPERATOR_CANNOT_DEBIT_CUSTOMER_ASSETS, true);
    assert.equal(AI_CANNOT_CAST_VALIDATOR_VOTE, true);
    assert.equal(SENTRIES_CANNOT_SIGN, true);
    assert.equal(BINARY_DEPLOY_DOES_NOT_ACTIVATE_PROTOCOL, true);
    assert.equal(platform.report().canonicalSetAuthoritative, true);
    assert.equal(platform.report().publicDelegatedStaking, false);
    assert.equal(platform.report().governanceToken, false);
    assert.equal(sharedAdminSecretForbidden(), true);
  });

  it('tracks operator identity without exposing private personal details', () => {
    const platform = new ValidatorOperatorPlatform();
    const operator = platform.operatorById(OPERATOR_A_ID);
    assert.ok(operator);
    assert.equal(operator.organizationId, 'org_alpha');
    assert.ok(operator.authorizedContacts.length > 0);
    assert.ok(operator.incidentContacts.length > 0);
    const profile = platform.profiles.find((row) => row.operatorId === OPERATOR_A_ID);
    assert.equal(profile?.privatePersonalDetailsExposed, false);
  });

  it('does not treat different validator IDs as independent operators', () => {
    const platform = new ValidatorOperatorPlatform();
    assert.equal(DIFFERENT_VALIDATOR_IDS_DO_NOT_IMPLY_INDEPENDENCE, true);
    assert.equal(platform.independenceImpliedByValidatorIds(), false);
    assert.equal(platform.sharedController('val_op_a', 'val_op_d'), true);
    assert.equal(platform.sharedController('val_op_a', 'val_op_e'), false);
  });

  it('enrolls through the dossier-backed workflow and consumes Chunk 85', () => {
    const platform = new ValidatorOperatorPlatform();
    const alpha = fixturePrincipal(OPERATOR_A_ID);
    const enrolled = platform.enroll(alpha, 'val_op_a', 'DOSSIER');
    if (!enrolled.ok) {
      throw new Error('expected enrollment');
    }
    assert.equal(enrolled.value.dossierAuthority, 'CHUNK_85_PRODUCTION_VALIDATOR_DOSSIER');
    assert.equal(enrolled.value.candidateV2Id, rehearsalCandidateV2Id());
    assert.equal(enrolled.value.candidateV2Id, CANDIDATE_V2_ID);
    assert.equal(enrolled.value.dossierValidatorId, rehearsalDossierValidatorId());
    const accepted = platform.acceptEnrollment(alpha, enrolled.value.enrollmentId, false);
    assert.equal(accepted.ok, true);
  });

  it('rejects fixture production acceptance', () => {
    const platform = new ValidatorOperatorPlatform();
    const alpha = fixturePrincipal(OPERATOR_A_ID);
    const enrolled = platform.enroll(alpha, 'val_op_a');
    if (!enrolled.ok) {
      throw new Error('expected enrollment');
    }
    const rejected = platform.acceptEnrollment(alpha, enrolled.value.enrollmentId, true);
    assert.equal(rejected.ok, false);
    if (rejected.ok) {
      throw new Error('expected refusal');
    }
    assert.equal(rejected.code, 'FIXTURE_ACCEPTANCE_REJECTED');
  });

  it('collects fleet health and maps operational states onto the canonical lifecycle', () => {
    const platform = new ValidatorOperatorPlatform();
    const health = platform.fleetHealth();
    assert.equal(health.samples.length, 7);
    assert.equal(health.quorumSafe, true);
    for (const sample of health.samples) {
      assert.ok(sample.height > 0n);
      assert.ok(sample.peerCount > 0);
      assert.equal(typeof sample.consensusParticipation, 'boolean');
      assert.ok(sample.stateRoot.length > 0);
      assert.ok(sample.diskFreeBytes > 0n);
    }
    assert.equal(CANONICAL_STATUS_MAP.ACTIVE, 'ACTIVE');
    assert.equal(CANONICAL_STATUS_MAP.JAILED, 'JAILED');
    assert.equal(CANONICAL_STATUS_MAP.UNBONDING, 'PENDING_EXIT');
    assert.equal(CANONICAL_STATUS_MAP.RETIRED, 'EXITED');
    assert.equal(CANONICAL_STATUS_MAP.MAINTENANCE, 'ACTIVE');
  });

  it('allows one-node maintenance and refuses an unsafe concurrent plan', () => {
    const platform = new ValidatorOperatorPlatform();
    const alpha = fixturePrincipal(OPERATOR_A_ID);
    const one = platform.planMaintenance(alpha, ['val_op_a'], 'one node');
    if (!one.ok) {
      throw new Error('expected one-node plan');
    }
    assert.equal(one.value.decision, 'ALLOW');
    assert.equal(one.value.quorumSafe, true);
    const unsafe = platform.planMaintenance(alpha, ['val_op_a', 'val_op_b', 'val_op_c'], 'too many');
    assert.equal(unsafe.ok, false);
    if (unsafe.ok) {
      throw new Error('expected unsafe refusal');
    }
    assert.equal(unsafe.code, 'UNSAFE_MAINTENANCE');
  });

  it('runs a BFT-safe rolling upgrade without activating protocol rules', () => {
    const platform = new ValidatorOperatorPlatform();
    const alpha = fixturePrincipal(OPERATOR_A_ID);
    const planned = platform.planUpgrade(alpha, {
      release: 'sunrey-node/1.1.0',
      artifactDigest: 'digest-1.1.0',
      protocolVersion: '2',
      batch: ['val_op_a'],
    });
    if (!planned.ok) {
      throw new Error('expected upgrade plan');
    }
    const deployed = platform.deployUpgradeBatch(alpha, planned.value.planId);
    if (!deployed.ok) {
      throw new Error('expected deploy');
    }
    assert.equal(deployed.value.binaryDeployed, true);
    assert.equal(deployed.value.protocolActivated, false);
    const activated = platform.activateProtocol(alpha, planned.value.planId);
    assert.equal(activated.ok, false);
    if (activated.ok) {
      throw new Error('expected protocol refusal');
    }
    assert.equal(activated.code, 'PROTOCOL_NOT_ACTIVATED_BY_BINARY');
  });

  it('rejects the wrong release and an unsafe upgrade batch', () => {
    const platform = new ValidatorOperatorPlatform();
    const alpha = fixturePrincipal(OPERATOR_A_ID);
    const wrong = platform.planUpgrade(alpha, {
      release: 'sunrey-node/evil',
      artifactDigest: 'nope',
      protocolVersion: '9',
      batch: ['val_op_a'],
    });
    assert.equal(wrong.ok, false);
    if (wrong.ok) {
      throw new Error('expected wrong release');
    }
    assert.equal(wrong.code, 'WRONG_RELEASE');
    const unsafe = platform.planUpgrade(alpha, {
      release: 'sunrey-node/1.1.0',
      artifactDigest: 'digest-1.1.0',
      protocolVersion: '2',
      batch: ['val_op_a', 'val_op_b', 'val_op_c'],
    });
    assert.equal(unsafe.ok, false);
    if (unsafe.ok) {
      throw new Error('expected unsafe batch');
    }
    assert.equal(unsafe.code, 'UNSAFE_UPGRADE_BATCH');
  });

  it('prepares and activates key rotation, then rejects replay and the old key', () => {
    const platform = new ValidatorOperatorPlatform();
    const alpha = fixturePrincipal(OPERATOR_A_ID);
    const prepared = platform.prepareRotation(alpha, 'val_op_a', 'next-fp-a', false);
    if (!prepared.ok) {
      throw new Error('expected rotation package');
    }
    assert.equal(prepared.value.watermark, 100n);
    const activated = platform.activateRotation(alpha, prepared.value.packageId);
    assert.equal(activated.ok, true);
    const replay = platform.activateRotation(alpha, prepared.value.packageId);
    assert.equal(replay.ok, false);
    if (replay.ok) {
      throw new Error('expected replay refusal');
    }
    assert.equal(replay.code, 'ROTATION_REPLAY');
    const oldKey = platform.signWithFingerprint('val_op_a', prepared.value.currentFingerprint);
    assert.equal(oldKey.ok, false);
    if (oldKey.ok) {
      throw new Error('expected old key refusal');
    }
    assert.equal(oldKey.code, 'OLD_KEY_REJECTED');
    const next = platform.signWithFingerprint('val_op_a', 'next-fp-a');
    assert.equal(next.ok, true);
  });

  it('detects a dual-active signer and refuses sentry signing', () => {
    const platform = new ValidatorOperatorPlatform();
    assert.equal(platform.sentryCanSign('sentry_val_op_a_1'), false);
    const refused = platform.refuseSentrySign('sentry_val_op_a_1');
    assert.equal(refused.ok, false);
    if (refused.ok) {
      throw new Error('expected sentry refusal');
    }
    assert.equal(refused.code, 'SENTRY_CANNOT_SIGN');
    platform.forceDualActive('val_op_a');
    const dual = platform.detectDualActiveSigner('val_op_a');
    assert.equal(dual.ok, false);
    if (dual.ok) {
      throw new Error('expected dual-active detection');
    }
    assert.equal(dual.code, 'DUAL_ACTIVE_SIGNER');
  });

  it('exposes Chunk 72 economics without debiting customer assets', () => {
    const platform = new ValidatorOperatorPlatform();
    const projection = platform.economicsProjection('val_op_a');
    assert.equal(projection.source, 'CHUNK_72_VALIDATOR_ECONOMICS');
    assert.equal(projection.canDebitCustomerAssets, false);
    assert.ok(projection.bondState === 'BONDED' || projection.bondState === 'BONDING');
    const debit = platform.refuseCustomerDebit();
    assert.equal(debit.ok, false);
    if (debit.ok) {
      throw new Error('expected isolation');
    }
    assert.equal(debit.code, 'CUSTOMER_ASSET_ISOLATION');
  });

  it('does not present monitoring suspicion as finalized misconduct', () => {
    const platform = new ValidatorOperatorPlatform();
    const alpha = fixturePrincipal(OPERATOR_A_ID);
    const incident = platform.openIncident(
      alpha,
      'val_op_a',
      'KEY_COMPROMISE_SUSPECTED',
      'monitoring alert',
      'ev_monitor',
    );
    if (!incident.ok) {
      throw new Error('expected incident');
    }
    assert.equal(incident.value.finalizedMisconduct, false);
    assert.equal(incident.value.monitoringSuspicionOnly, true);
    assert.equal(incident.value.evidencePreserved, true);
    const view = platform.accountability('val_op_a', ['missed-vote-alert']);
    assert.equal(view.suspicionPresentedAsFinal, false);
    assert.equal(MONITORING_SUSPICION_IS_NOT_FINALIZED_MISCONDUCT, true);
  });

  it('lets AI summarize a proposal but rejects an AI governance vote', () => {
    const platform = new ValidatorOperatorPlatform();
    const ai = fixturePrincipal(OPERATOR_A_ID, 'AI_ANALYST', 'AI');
    const prepared = platform.prepareGovernanceVote(ai, 'val_op_a', 'prop_1', 'summary only');
    if (!prepared.ok) {
      throw new Error('expected preparation');
    }
    assert.equal(prepared.value.cast, false);
    assert.equal(prepared.value.machineAuthorityDefined, false);
    const cast = platform.castGovernanceVote(ai, prepared.value.preparationId);
    assert.equal(cast.ok, false);
    if (cast.ok) {
      throw new Error('expected vote refusal');
    }
    assert.equal(cast.code, 'AI_CANNOT_CAST_VOTE');
  });

  it('prevents operator A from controlling validator B', () => {
    const platform = new ValidatorOperatorPlatform();
    const alpha = fixturePrincipal(OPERATOR_A_ID);
    const beta = fixturePrincipal(OPERATOR_B_ID);
    const denied = platform.planMaintenance(alpha, ['val_op_e'], 'cross');
    assert.equal(denied.ok, false);
    if (denied.ok) {
      throw new Error('expected cross-operator denial');
    }
    assert.equal(denied.code, 'CROSS_OPERATOR_DENIED');
    const allowed = platform.planMaintenance(beta, ['val_op_e'], 'own');
    assert.equal(allowed.ok, true);
    const signerDenied = platform.prepareRotation(alpha, 'val_op_e', 'stolen', false);
    assert.equal(signerDenied.ok, false);
    if (signerDenied.ok) {
      throw new Error('expected signer isolation');
    }
    assert.equal(signerDenied.code, 'CROSS_OPERATOR_DENIED');
  });

  it('tracks backups, recovery, concentration, and public vs private views', () => {
    const platform = new ValidatorOperatorPlatform();
    const alpha = fixturePrincipal(OPERATOR_A_ID);
    const beta = fixturePrincipal(OPERATOR_B_ID);
    assert.equal(platform.createBackup(alpha, 'val_op_a', 'SNAPSHOT').ok, true);
    assert.equal(platform.createBackup(alpha, 'val_op_a', 'SIGNER_SAFETY').ok, true);
    assert.equal(platform.createBackup(alpha, 'val_op_a', 'CONFIGURATION').ok, true);
    assert.equal(platform.createBackup(alpha, 'val_op_a', 'EVIDENCE').ok, true);
    assert.equal(platform.recover(alpha, 'val_op_a', 'NODE_LOSS').ok, true);
    assert.equal(platform.recover(alpha, 'val_op_a', 'SIGNER_LOSS').ok, true);
    const concentration = platform.concentration();
    assert.equal(concentration.breakdowns.length, 5);
    const pub = platform.publicView('val_op_a');
    assert.equal(pub.infrastructureHealthExposed, false);
    const priv = platform.privateView(alpha, 'val_op_a');
    assert.equal(priv.ok, true);
    const leaked = platform.privateView(beta, 'val_op_a');
    assert.equal(leaked.ok, false);
  });

  it('records an audit trail for high-impact actions', () => {
    const platform = new ValidatorOperatorPlatform();
    const alpha = fixturePrincipal(OPERATOR_A_ID);
    platform.enroll(alpha, 'val_op_a');
    assert.ok(platform.audits.some((row) => row.action === 'ENROLL' && row.requestHash.length === 64));
    assert.ok(platform.audits.every((row) => row.operatorId && row.role && row.result));
  });

  it('runs the seven-validator isolated rehearsal', () => {
    const first = runValidatorOperatorRehearsal();
    const second = runValidatorOperatorRehearsal();
    assert.equal(first.ok, true);
    assert.equal(first.isolated, true);
    assert.equal(first.observedProduction, false);
    assert.equal(first.validatorCount, 7);
    assert.equal(first.hash, second.hash);
    assert.deepEqual(
      first.steps.map((row) => row.id),
      [
        'rolling-upgrade',
        'one-node-maintenance',
        'signer-outage',
        'sentry-replacement',
        'key-rotation',
        'validator-exit',
        'backup-restore',
        'cross-operator',
      ],
    );
    assert.ok(first.steps.every((row) => row.ok));
  });

  it('exposes authenticated operator CLI commands without secrets', () => {
    for (const command of [
      'fleet',
      'operator',
      'enrollment',
      'health',
      'maintenance',
      'upgrade',
      'rotate-key',
      'backup',
      'incidents',
      'concentration',
    ]) {
      const viaDirect = runValidatorOperatorCommand([command]);
      assert.equal(viaDirect.ok, true, command);
    }
    const help = runValidatorOperatorCommand(['help']);
    assert.match(JSON.stringify(help.payload), /sunrey-ops validator fleet/);
    const opsCli = readFileSync(join(import.meta.dirname, 'ops/cli.ts'), 'utf8');
    assert.match(opsCli, /runValidatorOperatorCommand/);
    assert.match(opsCli, /validatorOperatorUsage/);
  });
});
