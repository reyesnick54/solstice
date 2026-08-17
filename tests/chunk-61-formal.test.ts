import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '..');

describe('CHUNK-61 SunRey formal models', () => {
  it('marks sunrey-formal-assurance implemented on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-formal-assurance').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-formal-assurance').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-61',
    );
    assert.ok(declared, 'CHUNK-61 declaration must exist');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });

  it('does not invent a competing formal-methods workspace package', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/formal/registry/formal-model-registry.json')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/formal/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/assurance/chunk-61-formal-models.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/formal')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/tla')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/model-checker')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-formal')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'tools/formal')), false);
  });
});
