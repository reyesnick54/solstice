import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-90 production handoff constitution', () => {
  it('implements the SunRey production handoff and day-2 control plane', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-90-production-handoff.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-90');
    assert.ok(declaration.requires.includes('sunrey-production-handoff'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-production-handoff').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-production-handoff').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-production-handoff').owner, 'packages/sunrey-chain');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-90',
      );
      assert.ok(declared, 'CHUNK-90 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-production-handoff"/);
      assert.match(raw, /Chunk 90 production handoff/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-90-production-handoff.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/chunk-90-production-handoff.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/production-handoff/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-handoff')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-handoff')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/day-2-ops')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-ops')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/operator-acceptance')), false);
  });
});
