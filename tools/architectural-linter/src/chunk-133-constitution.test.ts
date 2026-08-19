import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-133 resource extraction data fabric constitution', () => {
  it('owns the resource fabric inside the existing production oracle owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-133.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-133');
    assert.ok(declaration.requires.includes('sunrey-production-oracles'));
    assert.ok(declaration.requires.includes('sunrey-provider-certification'));
    assert.ok(declaration.requires.includes('moonrey-source-taxonomy'));
    assert.ok(declaration.requires.includes('sunrey-resource-extraction-data-fabric'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-resource-extraction-data-fabric').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-resource-extraction-data-fabric').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-oracles').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-133');
    assert.ok(declared, 'CHUNK-133 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-133-resource-extraction-data-fabric.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-133-resource-extraction-data-fabric.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/production/provider-families/resources/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/resource-oracles')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/minerals-data')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/extraction-fabric')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/resource-data-fabric')), false);
  });
});
