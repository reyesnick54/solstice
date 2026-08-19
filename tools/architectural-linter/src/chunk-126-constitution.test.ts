import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-126 MoonRey V2 shadow economics constitution', () => {
  it('owns one shadow-evaluation layer inside packages/sunrey-chain policy-governance', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-126.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-126');
    assert.ok(declaration.requires.includes('moonrey-v2-shadow-economics'));
    assert.ok(declaration.requires.includes('moonrey-productive-value-function'));
    assert.ok(declaration.requires.includes('moonrey-policy-governance'));
    assert.ok(declaration.requires.includes('sunrey-monetary-constitution'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'moonrey-v2-shadow-economics').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'moonrey-v2-shadow-economics').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-126');
    assert.ok(declared, 'CHUNK-126 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-126-moonrey-v2-shadow-migration.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-126-moonrey-v2-shadow-migration.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/productive/policy-governance/shadow-economics/index.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-shadow')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/value-migration')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-v2-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/shadow-economics')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-cutover')), false);
  });
});
