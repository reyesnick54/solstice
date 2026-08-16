import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');

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
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('sunrey chain architecture guards', () => {
  it('rejects a second ledger, invented tickers, raw keys, and agent execution', () => {
    const files = walk(join(ROOT, 'packages/sunrey-chain/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/AuthorityIssuer\.issue|this\.issuer\.issue\(/.test(source), false, file);
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/from ['"].*packages\/ledger/.test(source), false, file);
      assert.equal(/from ['"].*packages\/permissions/.test(source), false, file);
      assert.equal(/from ['"].*packages\/kernel/.test(source), false, file);
      assert.equal(/from ['"].*packages\/sunrey-coin/.test(source), false, file);
      assert.equal(/ticker\s*[:=]\s*['"]?(SUNREY|SRN|SRY|REYN|RYN|RCOIN)/.test(source), false, file);
      assert.equal(/\b(SRN|SRY|RYN|RCOIN)\b/.test(source), false, file);
      assert.equal(/APY|APR|blended return|yield rate|market cap/i.test(source), false, file);
      assert.equal(/from ['"].*services\//.test(source), false, file);
      assert.equal(/mainnet|testnet|rpcUrl|LIVE_CHAIN/i.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/reyn-chain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/on-chain-ledger')), false);
    assert.equal(existsSync(join(ROOT, 'packages/crypto-chain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain-node')), false);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain-protocol')), false);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain-network')), false);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain-consensus')), false);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain-runtime')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-node')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-blockchain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/moonrey-coin')), false);
    assert.equal(existsSync(join(ROOT, 'packages/moonrey-chain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-exchange')), true);
    const protocol = JSON.parse(
      readFileSync(join(ROOT, 'docs/architecture/sunrey-blockchain-protocol.json'), 'utf8'),
    ) as {
      productionBlockchainImplemented: boolean;
      tickers: { sunreyCoin: string; moonreyCoin: string };
      secondFiatLedger: boolean;
    };
    assert.equal(protocol.productionBlockchainImplemented, false);
    assert.equal(protocol.secondFiatLedger, false);
    assert.equal(protocol.tickers.sunreyCoin, 'NOT_ASSIGNED');
    assert.equal(protocol.tickers.moonreyCoin, 'NOT_ASSIGNED');
    const agent = walk(join(ROOT, 'packages/agent/src'));
    for (const file of agent) {
      const source = readFileSync(file, 'utf8');
      assert.equal(source.includes('packages/sunrey-chain'), false, file);
    }
  });
});
