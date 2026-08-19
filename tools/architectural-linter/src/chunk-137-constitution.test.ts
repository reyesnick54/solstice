import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-137 goods and services data fabric constitution', () => {
  it('owns the fabric inside the existing production oracle owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-137.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-137');
    assert.ok(declaration.requires.includes('sunrey-production-oracles'));
    assert.ok(declaration.requires.includes('sunrey-provider-certification'));
    assert.ok(declaration.requires.includes('moonrey-source-taxonomy'));
    assert.ok(declaration.requires.includes('moonrey-economic-event-attribution'));
    assert.ok(declaration.requires.includes('sunrey-goods-services-data-fabric'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-goods-services-data-fabric').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-goods-services-data-fabric').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-oracles').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-137');
    assert.ok(declared, 'CHUNK-137 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-137-goods-services-data-fabric.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-137-goods-services-data-fabric.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/production/provider-families/goods/types.ts')),
      true,
    );
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/production/provider-families/service-delivery/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/goods-oracles')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/commerce-data-fabric')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/services-oracle')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-commerce')), false);
  });
});
