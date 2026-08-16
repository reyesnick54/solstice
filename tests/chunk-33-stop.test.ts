import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '..');
const CHUNKS_DIR = join(REPO_ROOT, 'docs/architecture/chunks');
const ARCH_DIR = join(REPO_ROOT, 'docs/architecture');

function chunkFiles(prefix: string): string[] {
  return readdirSync(CHUNKS_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .sort();
}

function architectureDocs(prefix: string): string[] {
  return readdirSync(ARCH_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.md'))
    .sort();
}

describe('CHUNK-33 historical process-gate stop', () => {
  it('keeps the historical stop record and competing crypto roots absent', () => {
    assert.equal(existsSync(join(ARCH_DIR, 'chunk-33-stop.md')), true);
    assert.equal(existsSync(join(ARCH_DIR, 'chunk-33-post-quantum-security.md')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security')), false);
    assert.ok(chunkFiles('chunk-31-').includes('chunk-31-sunrey-blockchain.json'));
    assert.ok(architectureDocs('chunk-31-').includes('chunk-31-sunrey-blockchain-production-architecture.md'));
  });

  it('does not create a competing cryptographic root', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/quantum-security')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/pqc-core')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-agility')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/post-quantum')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto')), false);
  });

  it('declares CHUNK-33 without treating implemented security as permission to proceed', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'security').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'security').owner, 'packages/security');
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-33',
    );
    assert.ok(declared, 'CHUNK-33 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });
});
