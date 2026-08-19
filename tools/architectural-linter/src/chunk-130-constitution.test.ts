import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-130 compute and AI data fabric constitution', () => {
  it('owns the compute fabric inside the existing production oracle owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-130.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-130');
    assert.ok(declaration.requires.includes('sunrey-production-oracles'));
    assert.ok(declaration.requires.includes('sunrey-compute-ai-data-fabric'));
    assert.ok(declaration.requires.includes('sunrey-economic-unit-normalization'));
    assert.ok(declaration.requires.includes('sunrey-provider-certification'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-compute-ai-data-fabric').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-compute-ai-data-fabric').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-oracles').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-130');
    assert.ok(declared, 'CHUNK-130 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-130-compute-ai-data-fabric.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-130-compute-ai-data-fabric.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/production/provider-families/compute/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/compute-oracle')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/ai-compute-provider')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/gpu-metering')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/compute-data-fabric')), false);
  });
});
