import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-125 productive value settlement constitution', () => {
  it('bridges GPUV to MoonRey without a second mint', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-125.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-125');
    assert.ok(declaration.requires.includes('moonrey-productive-value-settlement'));
    assert.ok(declaration.requires.includes('sunrey-monetary-constitution'));
    assert.ok(declaration.requires.includes('moonrey-productive-value-function'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'moonrey-productive-value-settlement').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'moonrey-productive-value-settlement').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-125');
    assert.ok(declared, 'CHUNK-125 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-125-moonrey-value-settlement-bridge.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/productive/policy-governance/value-settlement/bridge.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-mint')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/gpuv-token')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/value-settlement')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-conversion')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/productive-settlement')), false);
  });
});
