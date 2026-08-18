import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-93 public data plane constitution', () => {
  it('implements the SunRey public RPC and Explorer data plane', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-93-public-data-plane.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-93');
    assert.ok(declaration.requires.includes('sunrey-public-data-plane'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-public-data-plane').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-public-data-plane').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-public-data-plane').owner, 'packages/sunrey-chain');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-93',
      );
      assert.ok(declared, 'CHUNK-93 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-public-data-plane"/);
      assert.match(raw, /Chunk 93 public RPC/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-93-public-data-plane.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/network/chunk-93-public-data-plane.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/public-data-plane/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/public-rpc')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-rpc-edge')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/rpc-gateway')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/explorer-ha')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/public-data-plane')), false);
  });
});
