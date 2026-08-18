import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-96 wallet security constitution', () => {
  it('implements SunRey advanced wallet security on the canonical wallet owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-96-wallet-security.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-96');
    assert.ok(declaration.requires.includes('sunrey-wallet-security'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-wallet-security').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-wallet-security').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-wallet-security').owner, 'packages/sunrey-chain');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-96',
      );
      assert.ok(declared, 'CHUNK-96 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-wallet-security"/);
      assert.match(raw, /Chunk 96/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-96-wallet-security.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/chunk-96-wallet-security.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/wallet-authentication.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/wallet-transaction-authorization.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/wallet-recovery.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/wallet-key-rotation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/wallet-device-trust.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/wallet-security-incident.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/wallet/security/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/wallet-security')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-wallet-security')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/wallet-auth')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/device-trust')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/wallet-recovery-v2')), false);
  });
});
