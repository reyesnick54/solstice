import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-132 logistics storage data fabric constitution', () => {
  it('owns the fabric inside the existing production oracle owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-132.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-132');
    assert.ok(declaration.requires.includes('sunrey-production-oracles'));
    assert.ok(declaration.requires.includes('sunrey-logistics-storage-data-fabric'));
    assert.ok(declaration.requires.includes('sunrey-economic-unit-normalization'));
    assert.ok(declaration.requires.includes('moonrey-economic-event-attribution'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-logistics-storage-data-fabric').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-logistics-storage-data-fabric').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-oracles').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-132');
    assert.ok(declared, 'CHUNK-132 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-132-logistics-storage-data-fabric.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-132-logistics-storage-data-fabric.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/production/provider-families/logistics/adapter.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/logistics-data-fabric')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/freight-oracles')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/warehouse-storage-oracles')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-logistics')), false);
  });
});
