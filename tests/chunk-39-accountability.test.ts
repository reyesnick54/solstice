import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '..');

describe('CHUNK-39 validator evidence and accountability', () => {
  it('implements accountability on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').owner, 'packages/sunrey-chain');
    assert.equal(
      evaluateCapability(manifest, 'sunrey-validator-accountability').status,
      'IMPLEMENTED',
    );

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-39',
    );
    assert.ok(declared, 'CHUNK-39 declaration must exist');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/node/src/evidence.rs')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/node/src/accountability.rs')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/validators')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/staking')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consensus-engine')), false);
  });
});
