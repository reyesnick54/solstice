import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'target') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.rs') || entry.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

describe('CHUNK-37 Tendermint-family BFT consensus core', () => {
  it('marks blockchain-consensus implemented on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'blockchain-consensus').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'blockchain-consensus').protected, true);
    assert.equal(evaluateCapability(manifest, 'blockchain-consensus').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-37',
    );
    assert.ok(declared, 'CHUNK-37 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });

  it('does not invent a tendermint, consensus-engine, or bft package', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/consensus/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/tendermint')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/cometbft')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consensus-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/bft')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain-consensus')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consensus')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-consensus')), false);
  });

  it('records the development engine without claiming production readiness', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-37-bft-consensus-core.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/consensus-development.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/consensus/ALGORITHM.md')),
      true,
    );
    const adr = readFileSync(
      join(REPO_ROOT, 'docs/architecture/adr/ADR-0017-sunrey-blockchain-consensus-architecture.md'),
      'utf8',
    );
    assert.match(adr, /development Tendermint-class/);
    assert.match(adr, /not implemented/i);
    const protocol = JSON.parse(
      readFileSync(join(REPO_ROOT, 'docs/architecture/sunrey-blockchain-protocol.json'), 'utf8'),
    ) as {
      productionBlockchainImplemented: boolean;
      consensus: { algorithmImplemented: boolean; productionConsensusImplemented: boolean };
    };
    assert.equal(protocol.productionBlockchainImplemented, false);
    assert.equal(protocol.consensus.algorithmImplemented, true);
    assert.equal(protocol.consensus.productionConsensusImplemented, false);
  });

  it('keeps consensus from posting journals or issuing authority', () => {
    const files = walk(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/consensus/src'));
    assert.ok(files.some((file) => file.endsWith('lib.rs')));
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/AuthorityIssuer/.test(source), false, file);
      assert.equal(/LIVE_CHAIN_ENABLED/.test(source), false, file);
    }
  });
});
