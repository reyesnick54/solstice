import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { runLaunchCommand, runLaunchRehearsal } from '../packages/sunrey-chain/src/launch-rehearsal/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 70 exit criteria', () => {
  it('runs the bounded launch-rehearsal smoke without authorizing production', () => {
    const session = runLaunchRehearsal(ROOT);
    assert.equal(session.report.productionAuthorized, false);
    assert.equal(session.report.liveFlagsRemainDisabled, true);
    assert.equal(session.report.validatorCount, 7);
    assert.equal(session.report.firstBlock.healthyValidatorAgreement, true);
    assert.match(session.report.rehearsalGenesis.genesisHash, /^[0-9a-f]{64}$/);
    assert.equal(session.report.explorer.banner, 'MAINNET REHEARSAL');
    assert.equal(session.report.failureScenarios.length >= 10, true);
    assert.equal(session.report.recoveryResults.every((row) => row.safetyHolds), true);
  });

  it('exposes the launch CLI', () => {
    const verify = runLaunchCommand(['verify'], ROOT);
    assert.equal(verify.ok, true);
    const report = runLaunchCommand(['report'], ROOT);
    assert.equal(report.ok, true);
  });

  it('publishes the required documentation', () => {
    for (const relative of [
      'docs/mainnet/chunk-70-launch-rehearsal.md',
      'docs/mainnet/launch-sequence.md',
      'docs/mainnet/control-room.md',
      'docs/mainnet/failure-injection.md',
      'docs/mainnet/launch-roles.md',
      'docs/mainnet/launch-findings.md',
      'docs/runbooks/mainnet-rehearsal.md',
      'docs/runbooks/launch-security-incident.md',
      'docs/architecture/chunk-70-launch-rehearsal.md',
      'docs/architecture/chunks/chunk-70-launch-rehearsal.json',
    ]) {
      assert.equal(existsSync(join(ROOT, relative)), true, relative);
    }
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-launch')), false);
    assert.equal(existsSync(join(ROOT, 'packages/launch-rehearsal')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mainnet-rehearsal')), false);
  });
});
