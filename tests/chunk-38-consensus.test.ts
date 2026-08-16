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
    } else if (entry.endsWith('.ts') || entry.endsWith('.rs') || entry.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

describe('CHUNK-38 networked BFT consensus', () => {
  it('marks development validators and consensus implemented on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'blockchain-consensus').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'blockchain-consensus').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').status, 'IMPLEMENTED');

    for (const chunk of ['CHUNK-36', 'CHUNK-37', 'CHUNK-38']) {
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === chunk,
      );
      assert.ok(declared, `${chunk} declaration must exist`);
      assert.equal(declared.mustStop, false, chunk);
      assert.deepEqual(declared.missing, []);
    }
  });

  it('does not invent a consensus or validator workspace package', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/node/src/consensus/mod.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consensus')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-consensus')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/tendermint')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/validators')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-38-networked-consensus.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/four-validator-devnet.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/consensus-partition-recovery.md')), true);
  });

  it('forbids consensus from minting, journaling, or issuing authority', () => {
    const files = walk(join(REPO_ROOT, 'packages/sunrey-chain/node/src/consensus'));
    assert.ok(files.some((file) => file.endsWith('engine.rs')));
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      assert.equal(/AuthorityIssuer|postJournal|LIVE_CHAIN|MAINNET_ENABLED/.test(source), false, file);
    }
  });
});
