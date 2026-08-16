import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '..');
const CHUNKS_DIR = join(REPO_ROOT, 'docs/architecture/chunks');

function chunkFiles(prefix: string): string[] {
  return readdirSync(CHUNKS_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .sort();
}

describe('CHUNK-33R crypto-agility implementation', () => {
  it('implements the CryptoSuite foundation after Chunks 31 and 32R', () => {
    assert.ok(chunkFiles('chunk-33-').includes('chunk-33-post-quantum-security.json'));
    assert.equal(chunkFiles('chunk-31-').length > 0, true);
    assert.equal(chunkFiles('chunk-32-').length > 0, true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-32-resume.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-33-stop.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-33-crypto-agility.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/cryptographic-inventory.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/cryptographic-inventory.json')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/sunrey-blockchain-threat-model.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security/src/crypto-suite.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security/src/ed25519-provider.ts')), true);
  });

  it('does not create a competing cryptographic root', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/quantum-security')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/pqc-core')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-agility')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/post-quantum')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain-crypto')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security-v2')), false);
  });

  it('declares CHUNK-33 against implemented security and the new registry capability', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'security').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'security').owner, 'packages/security');
    assert.equal(evaluateCapability(manifest, 'crypto-suite-registry').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-33',
    );
    assert.ok(declared, 'CHUNK-33 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });
});
