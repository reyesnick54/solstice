import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-115 economic asset integration fabric constitution', () => {
  it('extends the existing registry owner instead of creating a second one', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-115.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-115');
    assert.ok(declaration.requires.includes('sunrey-economic-asset-registry'));
    assert.ok(declaration.requires.includes('sunrey-human-information-network'));
    assert.ok(declaration.requires.includes('sunrey-human-economic-contributions'));
    assert.ok(declaration.requires.includes('sunrey-oracle-network'));
    assert.ok(declaration.requires.includes('sunrey-productive-capacity'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-asset-registry').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-asset-registry').owner, 'packages/economic-asset-registry');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-115');
    assert.ok(declared, 'CHUNK-115 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-115-economic-asset-integration-fabric.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-115-economic-asset-integration-fabric.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-asset-registry/src/port.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/information-market/src/network/economic-asset-adapter.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-economic-contribution/src/economic-asset-adapter.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/economic-asset-adapter.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/productive/economic-asset-adapter.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/dataset-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-assets')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/data-assets-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/universal-data-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/tokenized-data')), false);
  });
});
