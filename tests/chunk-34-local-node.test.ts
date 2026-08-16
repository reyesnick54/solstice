import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 34R local SunRey node', () => {
  it('implements the local node at the canonical owner', () => {
    const manifest = loadManifest(ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').status, 'PLANNED');
    const declared = evaluateDeclaredChunks(ROOT, manifest).find((row) => row.chunk === 'CHUNK-34');
    assert.ok(declared);
    assert.equal(declared.mustStop, false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/rust/Cargo.toml')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/rust/crates/protocol/src/lib.rs')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/rust/crates/crypto/src/lib.rs')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/rust/crates/node/src/lib.rs')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-node')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-blockchain')), false);
    const protocol = JSON.parse(
      readFileSync(join(ROOT, 'docs/architecture/sunrey-blockchain-protocol.json'), 'utf8'),
    ) as { productionBlockchainImplemented: boolean; environment: string };
    assert.equal(protocol.productionBlockchainImplemented, false);
    assert.equal(protocol.environment, 'simulation');
    const vectors = JSON.parse(
      readFileSync(join(ROOT, 'packages/sunrey-chain/fixtures/protocol/vectors.json'), 'utf8'),
    ) as { genesis: { hash: string } };
    assert.equal(vectors.genesis.hash, '5716d8a36722b65f73c697e761ba572d13208f4edd1b708b4b095430cc22d14d');
  });
});
