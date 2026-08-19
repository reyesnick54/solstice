import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-113 economic asset registry constitution', () => {
  it('owns one metadata registry above source-specific systems', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-113.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-113');
    assert.ok(declaration.requires.includes('sunrey-economic-asset-registry'));
    assert.ok(declaration.requires.includes('sunrey-human-economic-contributions'));
    assert.ok(declaration.requires.includes('sunrey-monetary-constitution'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-asset-registry').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-asset-registry').owner, 'packages/economic-asset-registry');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-113');
    assert.ok(declared, 'CHUNK-113 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-113-economic-asset-registry-foundation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-113-economic-asset-registry-foundation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-asset-registry/src/registry.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/dataset-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-assets')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/data-assets-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/universal-data-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/tokenized-data')), false);
  });
});
