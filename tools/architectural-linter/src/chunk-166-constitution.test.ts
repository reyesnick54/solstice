import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-166 staged capability activation', () => {
  it('extends post-genesis stabilization without a second activation owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-166.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-166');
    assert.ok(declaration.requires.includes('sunrey-post-genesis-stabilization'));
    assert.ok(declaration.requires.includes('sunrey-production-economic-activation-firewall'));
    assert.ok(declaration.requires.includes('sunrey-production-operating-scope'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-post-genesis-stabilization').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-post-genesis-stabilization').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-166');
    assert.ok(declared, 'CHUNK-166 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/operations/chunk-166-staged-capability-activation.md')),
      true,
    );
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/post-genesis/staged-activation/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/activation')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/canary')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mainnet-launch')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/product-switches')), false);
  });
});
