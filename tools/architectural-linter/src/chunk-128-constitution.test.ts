import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-128 provider certification constitution', () => {
  it('owns certification inside the existing production oracle owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-128.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-128');
    assert.ok(declaration.requires.includes('sunrey-production-oracles'));
    assert.ok(declaration.requires.includes('sunrey-provider-certification'));
    assert.ok(declaration.requires.includes('sunrey-economic-unit-normalization'));
    assert.ok(declaration.requires.includes('moonrey-source-taxonomy'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-provider-certification').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-provider-certification').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-oracles').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-128');
    assert.ok(declared, 'CHUNK-128 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-128-provider-certification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-128-provider-certification.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/production/certification/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/provider-certification')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/oracle-certification')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/conformance-sandbox')), false);
  });
});
