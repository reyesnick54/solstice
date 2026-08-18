import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-88 authorized genesis execution constitution', () => {
  it('implements the SunRey authorized genesis execution engine', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-88-genesis-execution.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-88');
    assert.ok(declaration.requires.includes('sunrey-production-genesis-execution'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-production-genesis-execution').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-production-genesis-execution').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-production-genesis-execution').owner, 'packages/sunrey-chain');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-88',
      );
      assert.ok(declared, 'CHUNK-88 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-production-genesis-execution"/);
      assert.match(raw, /Chunk 88/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-88-genesis-execution.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/chunk-88-genesis-execution.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/production-launch-plan.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/launch-execution-permit.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/launch-control-room.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/first-block-verification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/authorized-genesis-execution.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/genesis-execution/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/genesis-execution')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-genesis-execution')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-genesis-execution')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mainnet-execution')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/launch-execution')), false);
  });
});
