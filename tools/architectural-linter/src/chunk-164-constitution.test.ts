import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-164 production launch candidate freeze', () => {
  it('extends mainnet RC without a second release owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-164.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-164');
    assert.ok(declaration.requires.includes('sunrey-mainnet-rc'));
    assert.ok(declaration.requires.includes('sunrey-economic-rc'));
    assert.ok(declaration.requires.includes('sunrey-production-economic-authorization'));
    assert.ok(declaration.requires.includes('sunrey-production-launch-freeze'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-launch-freeze').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-launch-freeze').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-mainnet-rc').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-164');
    assert.ok(declared, 'CHUNK-164 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/operations/chunk-164-production-launch-freeze.md')),
      true,
    );
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/release-candidate/mainnet/launch-freeze/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/launch-candidate')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/release-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mainnet-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-release')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-manifest')), false);
  });
});
