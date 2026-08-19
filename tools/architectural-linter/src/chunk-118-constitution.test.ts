import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-118 canonical economic unit constitution', () => {
  it('owns one normalization authority inside packages/sunrey-chain', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-118.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-118');
    assert.ok(declaration.requires.includes('sunrey-economic-unit-normalization'));
    assert.ok(declaration.requires.includes('sunrey-oracle-network'));
    assert.ok(declaration.requires.includes('sunrey-productive-capacity'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-unit-normalization').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-unit-normalization').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-118');
    assert.ok(declared, 'CHUNK-118 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-118-canonical-economic-units.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-118-canonical-economic-units.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/units/registry.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/unit-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-units')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-units')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/normalization')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/canonical-units')), false);
  });
});
