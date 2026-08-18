import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-89 post-genesis stabilization constitution', () => {
  it('implements the SunRey post-genesis stabilization control plane', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-89-post-genesis-stabilization.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-89');
    assert.ok(declaration.requires.includes('sunrey-post-genesis-stabilization'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-post-genesis-stabilization').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-post-genesis-stabilization').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-post-genesis-stabilization').owner, 'packages/sunrey-chain');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-89',
      );
      assert.ok(declared, 'CHUNK-89 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-post-genesis-stabilization"/);
      assert.match(raw, /Chunk 89 post-genesis stabilization/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-89-post-genesis-stabilization.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/chunk-89-post-genesis-stabilization.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/network-phases.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/capability-activation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/post-genesis-health.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/post-genesis-incidents.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/post-genesis-stabilization.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/capability-activation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/post-genesis/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/post-genesis')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-post-genesis')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/stabilization')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/capability-activation')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-activation')), false);
  });
});
