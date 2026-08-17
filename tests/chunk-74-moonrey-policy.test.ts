import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('CHUNK-74 MoonRey issuance policy', () => {
  it('declares the governed policy capability on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'moonrey-policy-governance').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((row) => row.chunk === 'CHUNK-74');
    assert.ok(declared);
    assert.equal(declared.mustStop, false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/productive/policy-governance/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-policy')), false);
  });
});
