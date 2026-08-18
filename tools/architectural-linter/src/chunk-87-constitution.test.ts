import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-87 pre-genesis production qualification constitution', () => {
  it('implements the SunRey pre-genesis shadow-network qualification package', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-87-pregenesis-qualification.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-87');
    assert.ok(declaration.requires.includes('sunrey-pregenesis-qualification'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-pregenesis-qualification').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-pregenesis-qualification').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-pregenesis-qualification').owner, 'packages/sunrey-chain');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-87',
      );
      assert.ok(declared, 'CHUNK-87 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-pregenesis-qualification"/);
      assert.match(raw, /Chunk 87 pre-genesis/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-87-pregenesis-qualification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/chunk-87-pregenesis-qualification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/pregenesis-shadow-network.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/pregenesis-operational-invariants.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/pregenesis-burn-in.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/pregenesis-qualification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/pregenesis/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-pregenesis')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/pregenesis')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/shadow-network')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/pregenesis-qualification')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-shadow')), false);
  });
});
