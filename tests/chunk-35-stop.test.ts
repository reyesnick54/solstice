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
    if (entry === 'node_modules' || entry === '.git') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.md') || entry.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

describe('CHUNK-35 P2P / mempool / sync stop', () => {
  it('stops while the local deterministic node and P2P capabilities are PLANNED', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').status, 'PLANNED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').status, 'PLANNED');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-35',
    );
    assert.ok(declared, 'CHUNK-35 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, true);
    assert.deepEqual(declared.missing, ['sunrey-local-node', 'sunrey-p2p']);
  });

  it('does not invent a second chain, node, P2P, mempool, or consensus package', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain')), true);
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

  it('has no P2P implementation in sunrey-chain and no local-node implementation docs', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-34-local-node.md')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-33-crypto-suite.md')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-31-transport.md')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/local-sunrey-devnet.md')), false);

    const chainFiles = walk(join(REPO_ROOT, 'packages/sunrey-chain/src'));
    for (const file of chainFiles) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/PeerManager|Mempool|gossip|handshake|libp2p|NoiseXX/i.test(source), false, file);
      assert.equal(/AuthorityIssuer\.issue|this\.issuer\.issue\(/.test(source), false, file);
      assert.equal(/postJournal\s*\(/.test(source), false, file);
    }
  });
});
