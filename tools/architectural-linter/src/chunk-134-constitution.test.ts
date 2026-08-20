import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-134 agriculture food water data fabric constitution', () => {
  it('owns the agriculture and water fabrics inside the existing production oracle owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-134.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-134');
    assert.ok(declaration.requires.includes('sunrey-production-oracles'));
    assert.ok(declaration.requires.includes('sunrey-provider-certification'));
    assert.ok(declaration.requires.includes('moonrey-source-taxonomy'));
    assert.ok(declaration.requires.includes('sunrey-agriculture-food-data-fabric'));
    assert.ok(declaration.requires.includes('sunrey-water-data-fabric'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-agriculture-food-data-fabric').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-agriculture-food-data-fabric').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-water-data-fabric').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-water-data-fabric').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-oracles').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-134');
    assert.ok(declared, 'CHUNK-134 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-134-agriculture-food-water-data-fabric.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-134-agriculture-food-water-data-fabric.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/production/provider-families/agriculture/types.ts')),
      true,
    );
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/production/provider-families/water/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/agriculture-oracle')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/food-data-fabric')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/water-oracle')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/water-data-fabric')), false);
  });
});
