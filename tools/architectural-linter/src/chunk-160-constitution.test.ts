import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-160 external production evidence registry', () => {
  it('extends mainnet readiness without a competing evidence owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-160.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-160');
    assert.ok(declaration.requires.includes('sunrey-mainnet-readiness'));
    assert.ok(declaration.requires.includes('evidence'));
    assert.ok(declaration.requires.includes('sunrey-external-production-evidence'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-external-production-evidence').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-external-production-evidence').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-160');
    assert.ok(declared, 'CHUNK-160 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/operations/chunk-160-external-evidence-registry.md')),
      true,
    );
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/mainnet/external-evidence/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/legal')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/licenses')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/external-audit')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/compliance-evidence')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/evidence-v2')), false);
  });
});
