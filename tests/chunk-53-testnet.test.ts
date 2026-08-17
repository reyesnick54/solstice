import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '..');

describe('CHUNK-53 public testnet', () => {
  it('marks the public testnet capability implemented on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-public-testnet').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-public-testnet').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-53',
    );
    assert.ok(declared, 'CHUNK-53 declaration must exist');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });

  it('does not invent a competing testnet workspace package', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/testnet/genesis.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-53-public-testnet.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/testnet/README.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-testnet')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-faucet')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/testnet')), false);
  });
});
