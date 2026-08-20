import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-150 external economic provider candidate constitution', () => {
  it('extends existing oracle owners and does not create a second capability', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-150.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-150');
    assert.ok(declaration.requires.includes('sunrey-production-oracles'));
    assert.ok(declaration.requires.includes('sunrey-provider-certification'));
    assert.ok(declaration.requires.includes('sunrey-economic-data-connector-runtime'));
    assert.ok(declaration.requires.includes('sunrey-unified-economic-data-fabric'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-oracles').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-provider-certification').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-data-connector-runtime').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-unified-economic-data-fabric').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-150');
    assert.ok(declared, 'CHUNK-150 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-150-external-economic-provider-candidates.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-150-external-economic-provider-candidates.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/production/external-provider-candidate/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/external-oracle-providers')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/oracle-provider-candidates')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/external-economic-oracles')), false);
  });
});
