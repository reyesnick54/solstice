import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-149 production provider credential plane constitution', () => {
  it('owns the credential plane inside packages/security', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-149.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-149');
    assert.ok(declaration.requires.includes('sunrey-production-provider-credential-plane'));
    assert.ok(declaration.requires.includes('security'));
    assert.ok(declaration.requires.includes('sunrey-provider-runtime'));
    assert.ok(declaration.requires.includes('sunrey-production-provider-acceptance'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-provider-credential-plane').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-provider-credential-plane').owner, 'packages/security');
    assert.equal(evaluateCapability(manifest, 'sunrey-provider-runtime').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-149');
    assert.ok(declared, 'CHUNK-149 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-149-provider-credential-plane.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security/src/regulated/credentials/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/secrets')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/credentials')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/provider-security')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/provider-runtime-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/external-connectivity')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/vendor-runtime')), false);
  });
});
