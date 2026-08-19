import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-119 canonical unit migration constitution', () => {
  it('migrates the productive pipeline onto the existing unit authority', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-119.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-119');
    assert.ok(declaration.requires.includes('sunrey-economic-unit-normalization'));
    assert.ok(declaration.requires.includes('sunrey-oracle-network'));
    assert.ok(declaration.requires.includes('sunrey-production-oracles'));
    assert.ok(declaration.requires.includes('sunrey-productive-capacity'));
    assert.ok(declaration.requires.includes('moonrey-source-taxonomy'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-unit-normalization').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-unit-normalization').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-119');
    assert.ok(declared, 'CHUNK-119 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-119-canonical-unit-migration.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-119-canonical-unit-migration.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/units/measurement.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-units')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/productive-units-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-normalization-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/measurement-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/unit-registry-v2')), false);
  });
});
