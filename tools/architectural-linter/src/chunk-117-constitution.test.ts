import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-117 MoonRey source claim compatibility constitution', () => {
  it('extends production oracles and productive capacity without a second mint', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-117.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-117');
    assert.ok(declaration.requires.includes('sunrey-production-oracles'));
    assert.ok(declaration.requires.includes('sunrey-productive-capacity'));
    assert.ok(declaration.requires.includes('sunrey-economic-asset-registry'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-oracles').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-productive-capacity').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-117');
    assert.ok(declared, 'CHUNK-117 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-117-moonrey-source-claim-enforcement.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-117-moonrey-source-claim-enforcement.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/source-taxonomy/validator.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/productive/claim-candidate/builder.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-source-taxonomy')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/source-claim-enforcement')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/productive-claim-candidate')), false);
  });
});
