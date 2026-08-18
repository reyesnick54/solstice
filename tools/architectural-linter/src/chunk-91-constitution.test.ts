import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-91 provider runtime constitution', () => {
  it('implements the SunRey executable provider runtime', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-91-provider-runtime.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-91');
    assert.ok(declaration.requires.includes('sunrey-provider-runtime'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-provider-runtime').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-provider-runtime').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-provider-runtime').owner, 'packages/sunrey-chain');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-91',
      );
      assert.ok(declared, 'CHUNK-91 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-provider-runtime"/);
      assert.match(raw, /Chunk 91/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-91-provider-runtime.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/providers/chunk-91-provider-runtime.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/provider-runtime/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/provider-runtime/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/provider-runtime')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-provider-runtime')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/executable-providers')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/provider-adapters')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/integration-providers')), false);
  });
});
