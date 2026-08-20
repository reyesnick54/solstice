import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-141 SunRey naming constitution', () => {
  it('owns canonical product identity inside packages/config', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-141.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-141');
    assert.ok(declaration.requires.includes('config'));
    assert.ok(declaration.requires.includes('sunrey-canonical-product-identity'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-canonical-product-identity').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-canonical-product-identity').owner, 'packages/config');
    assert.equal(evaluateCapability(manifest, 'config').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-141');
    assert.ok(declared, 'CHUNK-141 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/config/src/product-identity.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/sunrey-naming-constitution.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/branding')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/product-identity')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-brand')), false);
  });
});
