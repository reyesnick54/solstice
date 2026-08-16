import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
    } else if (entry.endsWith('.ts') || entry.endsWith('.rs') || entry.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

describe('CHUNK-35R P2P / mempool / sync', () => {
  it('marks local-node and P2P implemented on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-35',
    );
    assert.ok(declared, 'CHUNK-35 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });

  it('does not invent a second chain, node, P2P, mempool, or consensus package', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/node/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-node')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-p2p')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/p2p')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/libp2p')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mempool')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/devnet')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/gossip')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consensus')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-consensus')), false);
  });

  it('keeps the historical stop and records the implementation', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-35-stop.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-35-resume.md')), true);
    const adr = readFileSync(
      join(REPO_ROOT, 'docs/architecture/adr/ADR-0023-sunrey-blockchain-networking-p2p.md'),
      'utf8',
    );
    assert.match(adr, /Quinn/);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/local-sunrey-devnet.md')), true);
    const stop = readFileSync(join(REPO_ROOT, 'docs/architecture/chunk-35-stop.md'), 'utf8');
    assert.match(stop, /historical/i);
  });

  it('forbids networking from minting, journaling, or issuing authority', () => {
    const files = walk(join(REPO_ROOT, 'packages/sunrey-chain/node/src'));
    assert.ok(files.some((file) => file.endsWith('lib.rs')));
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      assert.equal(/AuthorityIssuer|postJournal|LIVE_CHAIN|MAINNET_ENABLED/.test(source), false, file);
    }
  });
});
