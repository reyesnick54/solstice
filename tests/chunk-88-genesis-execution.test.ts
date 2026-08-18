import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { defaultActivationMatrix } from '../packages/sunrey-chain/src/mainnet/capabilities.ts';
import {
  ADVERSARIAL_CASES,
  EXECUTION_REHEARSAL_CHAIN_ID,
  EXECUTION_REHEARSAL_NETWORK_ID,
  LAUNCH_AUTHORITY_ROLES,
  REQUIRED_LAUNCH_HUMAN_ROLES,
  adversarialDidNotExecute,
  buildLaunchExecutionReport,
  productionModeRefusesFixtures,
  resetPermitRegistry,
  runAdversarialCase,
  runAuthorizedGenesisExecution,
  runIsolatedGenesisExecutionRehearsal,
  runProductionLaunchCommand,
  verifyLaunchEvents,
} from '../packages/sunrey-chain/src/genesis-execution/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 88 authorized genesis execution', () => {
  it('runs a deterministic isolated rehearsal to initial-chain-verified', () => {
    resetPermitRegistry();
    const first = runIsolatedGenesisExecutionRehearsal(ROOT);
    resetPermitRegistry();
    const second = runIsolatedGenesisExecutionRehearsal(ROOT);
    assert.equal(first.plan.planHash, second.plan.planHash);
    assert.equal(first.genesis?.genesisHash, second.genesis?.genesisHash);
    assert.match(first.plan.planHash, /^[0-9a-f]{64}$/);
    assert.match(first.genesis?.genesisHash ?? '', /^[0-9a-f]{64}$/);
    assert.equal(first.state, 'INITIAL_CHAIN_VERIFIED');
    assert.equal(first.plan.networkId, EXECUTION_REHEARSAL_NETWORK_ID);
    assert.equal(first.plan.chainId, EXECUTION_REHEARSAL_CHAIN_ID);
    assert.equal(first.firstBlock?.verified, true);
    assert.equal(first.firstBlock?.validatorsConverged, true);
    assert.equal(first.supplyAudit?.ok, true);
    assert.equal(first.supplyAudit?.zeroSupplyCompatible, true);
    assert.equal(first.supplyAudit?.tickerStatus, 'NOT_ASSIGNED');
    assert.equal(first.realProductionExecutionPerformed, false);
    assert.equal(first.mainnetEnabled, false);
    assert.equal(first.capabilityMatrixUnchanged, true);
    assert.deepEqual(
      first.capabilityMatrix.map((row) => row.genesis_enabled),
      defaultActivationMatrix().map((row) => row.genesis_enabled),
    );
    assert.equal(first.controlRoom.productionActivated, false);
    assert.equal(first.controlRoom.liveFlagsRemainDisabled, true);
    assert.equal(verifyLaunchEvents(first.events), true);
    const report = buildLaunchExecutionReport(first);
    assert.equal(report.realProductionExecutionPerformed, false);
    assert.equal(report.firstBlockVerified, true);
    assert.equal(report.supplyAuditOk, true);
  });

  it('requires the configured human authorization roles and rejects AI', () => {
    assert.deepEqual([...REQUIRED_LAUNCH_HUMAN_ROLES], [
      'GENESIS_AUTHORITY',
      'PROTOCOL_AUTHORITY',
      'SECURITY_AUTHORITY',
      'RELEASE_AUTHORITY',
    ]);
    assert.ok(LAUNCH_AUTHORITY_ROLES.includes('OPERATIONS_AUTHORITY'));
    resetPermitRegistry();
    const ai = runAuthorizedGenesisExecution(ROOT, { aiAuthorize: true });
    assert.equal(ai.genesis?.executed === true, false);
    assert.equal(ai.incident?.synthesizedSuccess, false);
    assert.equal(ai.incident?.detail, 'AI_CANNOT_AUTHORIZE');
  });

  it('issues a single-use permit and rejects replay', () => {
    resetPermitRegistry();
    const replay = runAuthorizedGenesisExecution(ROOT, { replayPermit: true });
    assert.equal(adversarialDidNotExecute(replay), true);
    assert.equal(replay.incident?.detail, 'PERMIT_REPLAYED');
  });

  it('cancels before genesis with human authority and does not execute', () => {
    resetPermitRegistry();
    const cancelled = runAuthorizedGenesisExecution(ROOT, { cancelBeforeGenesis: true });
    assert.equal(cancelled.state, 'CANCELLED');
    assert.equal(cancelled.genesis, null);
    assert.equal(cancelled.permit?.revoked, true);
    assert.equal(cancelled.realProductionExecutionPerformed, false);
  });

  it('recovers after genesis without duplicate initialization', () => {
    resetPermitRegistry();
    const resumed = runAuthorizedGenesisExecution(ROOT, { resumeAfterGenesis: true });
    assert.equal(resumed.state, 'INITIAL_CHAIN_VERIFIED');
    assert.equal(resumed.genesis?.executed, true);
    assert.equal(resumed.firstBlock?.verified, true);
  });

  it('rejects finalized history rewrite', () => {
    resetPermitRegistry();
    const rewrite = runAuthorizedGenesisExecution(ROOT, { attemptHistoryRewrite: true });
    assert.equal(rewrite.incident?.detail, 'HISTORY_REWRITE_FORBIDDEN');
    assert.equal(rewrite.firstBlock?.verified === true, false);
  });

  it('keeps customer capabilities independently gated after genesis', () => {
    resetPermitRegistry();
    const ran = runIsolatedGenesisExecutionRehearsal(ROOT);
    const gated = ran.services.filter((row) => row.independentlyGated);
    assert.ok(gated.length >= 8);
    assert.ok(gated.every((row) => row.broughtUp === false));
    assert.ok(ran.capabilityMatrix.every((row) => row.runtime_enabled === false && row.genesis_enabled === false));
  });

  it('does not execute on pre-genesis failures', () => {
    for (const fail of [
      'VALIDATOR_NOT_READY',
      'SIGNER_NOT_READY',
      'WRONG_GENESIS',
      'PROVIDER_ISSUE',
      'CONFIGURATION_DRIFT',
      'AUTHORIZATION_MISMATCH',
    ] as const) {
      resetPermitRegistry();
      const session = runAuthorizedGenesisExecution(ROOT, { fail });
      assert.equal(session.genesis?.executed === true, false, fail);
      assert.equal(session.realProductionExecutionPerformed, false, fail);
    }
  });

  it('creates a high-severity incident when first-block verification fails', () => {
    resetPermitRegistry();
    const failed = runAuthorizedGenesisExecution(ROOT, { fail: 'FIRST_BLOCK_VERIFICATION_FAILURE' });
    assert.equal(failed.incident?.severity, 'HIGH');
    assert.equal(failed.incident?.class, 'FIRST_BLOCK_VERIFICATION_FAILURE');
    assert.equal(failed.incident?.synthesizedSuccess, false);
    assert.equal(failed.incident?.evidencePreserved, true);
    assert.equal(failed.firstBlock?.verified, false);
  });

  it('rejects fixture artifacts from production mode', () => {
    assert.equal(productionModeRefusesFixtures(ROOT), 'FIXTURE_REJECTED_FROM_PRODUCTION');
  });

  it('covers the adversarial suite without executing genesis', () => {
    for (const name of ADVERSARIAL_CASES) {
      const session = runAdversarialCase(name, ROOT);
      assert.equal(adversarialDidNotExecute(session), true, name);
      assert.equal(session.realProductionExecutionPerformed, false, name);
    }
  });

  it('exposes sunrey-launch production CLI commands', () => {
    const help = runProductionLaunchCommand(['help'], ROOT);
    assert.match(String((help.payload as { usage: string }).usage), /sunrey-launch production/);
    resetPermitRegistry();
    const execute = runProductionLaunchCommand(['execute'], ROOT);
    assert.equal(execute.ok, true);
    const payload = execute.payload as {
      readonly genesisHash: string;
      readonly realProductionExecutionPerformed: false;
    };
    assert.match(payload.genesisHash, /^[0-9a-f]{64}$/);
    assert.equal(payload.realProductionExecutionPerformed, false);
    const report = runProductionLaunchCommand(['report'], ROOT);
    assert.equal(report.ok, true);
  });

  it('runs the rehearsal CLI without launching production', () => {
    const result = spawnSync('npm', ['run', 'sunrey-launch', '--', 'production', 'execute'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, SUNREY_FIXTURE_ENV: 'local' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"realProductionExecutionPerformed": false/);
    assert.match(result.stdout, /"genesisHash": "[0-9a-f]{64}"/);
  });

  it('does not create forbidden alias packages and keeps docs', () => {
    assert.equal(existsSync(join(ROOT, 'docs/mainnet/chunk-88-genesis-execution.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/mainnet/production-launch-plan.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/mainnet/launch-execution-permit.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/mainnet/launch-control-room.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/mainnet/first-block-verification.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/runbooks/authorized-genesis-execution.md')), true);
    assert.equal(existsSync(join(ROOT, 'packages/genesis-execution')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-genesis-execution')), false);
    assert.equal(existsSync(join(ROOT, 'packages/production-genesis-execution')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mainnet-execution')), false);
    assert.equal(existsSync(join(ROOT, 'packages/launch-execution')), false);
  });
});
