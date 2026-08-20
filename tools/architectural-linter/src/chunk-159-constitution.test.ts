import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-159 main-branch integrity lock constitution', () => {
  it('owns repository integrity on the existing architecture-linting layer', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-159.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-159');
    assert.ok(declaration.requires.includes('architecture-linting'));
    assert.ok(declaration.requires.includes('sunrey-repository-integrity'));
    assert.ok(declaration.requires.includes('sunrey-production-handoff'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'architecture-linting').owner, 'tools/architectural-linter');
    assert.equal(evaluateCapability(manifest, 'sunrey-repository-integrity').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-repository-integrity').owner, 'tools/architectural-linter');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-handoff').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-159');
    assert.ok(declared, 'CHUNK-159 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-159-main-branch-integrity-lock.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/merge-integrity-policy.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/integrity-baseline.json')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'scripts/check-json-integrity.mjs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'scripts/check-merge-integrity.mjs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/repository-integrity')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/architecture-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/merge-manager')), false);
  });
});
