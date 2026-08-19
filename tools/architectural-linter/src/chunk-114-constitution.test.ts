import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-114 economic asset verification constitution', () => {
  it('extends the existing registry owner with a verification layer', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-114.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-114');
    assert.ok(declaration.requires.includes('sunrey-economic-asset-registry'));
    assert.ok(declaration.requires.includes('sunrey-economic-asset-verification'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-asset-registry').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-asset-registry').owner, 'packages/economic-asset-registry');
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-asset-verification').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-asset-verification').owner, 'packages/economic-asset-registry');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-114');
    assert.ok(declared, 'CHUNK-114 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-114-economic-asset-verification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-114-economic-asset-verification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-asset-registry/src/verification/engine.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/dataset-verification')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/data-rights-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-provenance')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/asset-rights')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-assets-v2')), false);
  });
});
