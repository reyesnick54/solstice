import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-153 dual-asset custody provider candidate constitution', () => {
  it('owns dual-asset custody inside packages/custody', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-153.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-153');
    assert.ok(declaration.requires.includes('custody'));
    assert.ok(declaration.requires.includes('security'));
    assert.ok(declaration.requires.includes('sunrey-institutional-custody'));
    assert.ok(declaration.requires.includes('sunrey-production-provider-credential-plane'));
    assert.ok(declaration.requires.includes('sunrey-regulated-provider-candidates'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'custody').owner, 'packages/custody');
    assert.equal(evaluateCapability(manifest, 'security').owner, 'packages/security');
    assert.equal(evaluateCapability(manifest, 'sunrey-dual-asset-custody-provider-candidate').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-dual-asset-custody-provider-candidate').owner, 'packages/custody');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-provider-credential-plane').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-regulated-provider-candidates').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-153');
    assert.ok(declared, 'CHUNK-153 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/custody/chunk-153-dual-asset-custody-provider-candidate.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/custody/src/provider-candidate/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-custody')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-custody-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/key-vault')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/hsm-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mpc-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/custody-provider-v2')), false);
  });
});
