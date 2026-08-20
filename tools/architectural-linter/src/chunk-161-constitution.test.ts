import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-161 operating-scope matrix', () => {
  it('extends mainnet readiness without a second legal engine', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-161.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-161');
    assert.ok(declaration.requires.includes('sunrey-mainnet-readiness'));
    assert.ok(declaration.requires.includes('kernel'));
    assert.equal(declaration.requires.includes('sunrey-licensing'), false);

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-operating-scope').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-operating-scope').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-161');
    assert.ok(declared, 'CHUNK-161 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/compliance/chunk-161-operating-scope-matrix.md')),
      true,
    );
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/mainnet/operating-scope/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/licensing')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/global-regulation')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/country-law')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/legal-engine')), false);
  });
});
