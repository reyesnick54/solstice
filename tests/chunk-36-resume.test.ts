import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';
import { fourValidatorDevelopmentHash } from '../packages/sunrey-chain/src/validators/index.ts';

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

describe('CHUNK-36R validator registry / lifecycle', () => {
  it('implements sunrey-validators on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
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
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-36-resume.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-36-validator-lifecycle.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/validator-development.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/validator-key-compromise.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/validator-signer-safety.md')), true);
  });

  it('implements validator registry, signer, and epoch modules on the canonical owner', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/validators/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/validators/src/lib.rs')), true);
    assert.equal(fourValidatorDevelopmentHash().length, 64);
  });
});
