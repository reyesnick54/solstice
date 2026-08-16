import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '..');

const FORBIDDEN_VALIDATOR_ROOTS = [
  'packages/validators',
  'packages/staking',
  'packages/validator-v2',
  'packages/consensus-engine',
  'packages/tendermint',
  'packages/sunrey-node',
  'packages/sunrey-p2p',
  'packages/sunrey-consensus',
] as const;

describe('CHUNK-36 validator registry / lifecycle', () => {
  it('is implemented at the sunrey-chain owner after the historical stop', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-blockchain-architecture').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-36',
    );
    assert.ok(declared, 'CHUNK-36 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });

  it('does not invent a validator, staking, or consensus-engine package', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain')), true);
    for (const rel of FORBIDDEN_VALIDATOR_ROOTS) {
      assert.equal(existsSync(join(REPO_ROOT, rel)), false, rel);
    }
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-36-stop.md')), true);
  });

  it('keeps TypeScript trust-layer sources free of a second consensus package', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/validator.ts')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/validators')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/consensus')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/validator-set.ts')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/signer-safety.ts')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'Cargo.toml')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/node/src/consensus/mod.rs')), true);
  });
});
