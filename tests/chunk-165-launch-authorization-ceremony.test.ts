import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../packages/config/src/flags.ts';
import {
  runLaunchAuthorizationDressRehearsal,
} from '../packages/sunrey-chain/src/production-ceremony/launch-candidate/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 165 launch authorization ceremony integration', () => {
  it('keeps the dress rehearsal at REHEARSAL_COMPLETE without activating production', () => {
    const rehearsal = runLaunchAuthorizationDressRehearsal();
    assert.equal(rehearsal.session.state, 'REHEARSAL_COMPLETE');
    assert.equal(rehearsal.session.authorization?.class, 'REHEARSAL_PACKAGE');
    assert.equal(rehearsal.realProductionKeysCreated, false);
    assert.equal(rehearsal.realHumanSignaturesCollected, false);
    assert.equal(rehearsal.aiSatisfiesHumanRole, false);
    assert.equal(rehearsal.transcriptIntegrity, true);
    assert.equal(rehearsal.candidateChangeRequiresRestart, true);
    assert.equal(rehearsal.ceremonyAuthorizationEqualsActivation, false);
    assert.equal(rehearsal.mainnetEnabled, false);
    assert.equal(rehearsal.productionActive, false);
    assert.equal(rehearsal.changedFreezeRejection.code, 'CEREMONY_CANDIDATE_MISMATCH');
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
  });

  it('prints the required demo flags', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--disable-warning=ExperimentalWarning',
        'packages/sunrey-chain/src/production-ceremony/launch-candidate/demo.ts',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, SUNREY_FIXTURE_ENV: 'local' },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    for (const flag of [
      'REAL_PRODUCTION_KEYS_CREATED=false',
      'REAL_HUMAN_SIGNATURES_COLLECTED=false',
      'AI_SATISFIES_HUMAN_ROLE=false',
      'TRANSCRIPT_INTEGRITY=true',
      'CANDIDATE_CHANGE_REQUIRES_RESTART=true',
      'CEREMONY_AUTHORIZATION_EQUALS_ACTIVATION=false',
      'MAINNET_ENABLED=false',
      'PRODUCTION_ACTIVE=false',
    ]) {
      assert.match(result.stdout, new RegExp(flag));
    }
  });

  it('does not create a competing ceremony package', () => {
    assert.equal(existsSync(join(ROOT, 'packages/ceremony-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/launch-signing')), false);
    assert.equal(existsSync(join(ROOT, 'packages/genesis-authority')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mainnet-ceremony')), false);
    assert.equal(
      existsSync(join(ROOT, 'packages/sunrey-chain/src/production-ceremony/launch-candidate/types.ts')),
      true,
    );
  });
});
