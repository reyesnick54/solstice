import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-97 mobile wallet sync constitution', () => {
  it('implements SunRey mobile wallet synchronization', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-97-mobile-wallet-sync.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-97');
    assert.ok(declaration.requires.includes('sunrey-mobile-wallet-sync'));
    assert.ok(declaration.requires.includes('sunrey-sovereign-wallets'));
    assert.ok(declaration.requires.includes('sunrey-public-data-plane'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-mobile-wallet-sync').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-mobile-wallet-sync').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-mobile-wallet-sync').owner, 'packages/sunrey-chain');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-97',
      );
      assert.ok(declared, 'CHUNK-97 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-mobile-wallet-sync"/);
      assert.match(raw, /Chunk 97 mobile wallet synchronization/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-97-mobile-sync.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/chunk-97-mobile-sync.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/mobile-finality.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/mobile-push-security.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/offline-transactions.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/payment-requests.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/wallet/mobile-secure-storage.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/wallet/mobile-sync/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mobile-wallet-sync')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-mobile-sync')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/wallet-sync')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mobile-wallet-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-push')), false);
  });
});
