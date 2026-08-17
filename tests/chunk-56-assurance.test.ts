import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '..');

describe('CHUNK-56 SunRey fuzzing and property assurance', () => {
  it('marks sunrey-assurance implemented on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-assurance').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-assurance').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-56',
    );
    assert.ok(declared, 'CHUNK-56 declaration must exist');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });

  it('does not invent a competing assurance workspace package', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/assurance/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/assurance/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/assurance/chunk-56-fuzzing.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-test')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/fuzz')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/assurance')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'tools/sunrey-test')), false);
  });
});
