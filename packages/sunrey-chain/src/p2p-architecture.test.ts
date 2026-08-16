import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const NODE = join(ROOT, 'packages/sunrey-chain/node');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (entry === 'target') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.rs')) {
      out.push(full);
    }
  }
  return out;
}

describe('sunrey chain development P2P module', () => {
  it('lives under the canonical owner and has no forbidden authority', () => {
    assert.equal(existsSync(join(NODE, 'src/lib.rs')), true);
    assert.equal(existsSync(join(NODE, 'src/handshake.rs')), true);
    assert.equal(existsSync(join(NODE, 'src/mempool.rs')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-p2p')), false);
    const files = walk(join(NODE, 'src'));
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      assert.equal(/AuthorityIssuer|postJournal|MAINNET_ENABLED|LIVE_CHAIN/.test(source), false, file);
    }
  });
});
