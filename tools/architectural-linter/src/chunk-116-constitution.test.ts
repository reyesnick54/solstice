import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-116 MoonRey source-to-productive taxonomy constitution', () => {
  it('owns one mapping registry inside packages/sunrey-chain', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-116.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-116');
    assert.ok(declaration.requires.includes('moonrey-source-taxonomy'));
    assert.ok(declaration.requires.includes('sunrey-productive-capacity'));
    assert.ok(declaration.requires.includes('sunrey-oracle-network'));
    assert.ok(declaration.requires.includes('sunrey-monetary-constitution'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'moonrey-source-taxonomy').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'moonrey-source-taxonomy').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-116');
    assert.ok(declared, 'CHUNK-116 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-116-moonrey-source-taxonomy.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-116-moonrey-source-taxonomy.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/productive/source-taxonomy/registry.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-taxonomy')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/source-taxonomy')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/productive-taxonomy')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-source-taxonomy')), false);
  });
});
