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
    if (entry === 'node_modules' || entry === '.git' || entry === 'target') {
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
      const allowsTestNetwork =
        file.includes(`${join('src', 'testnet')}`) ||
        file.includes(`${join('src', 'mainnet')}`) ||
        file.includes(`${join('src', 'pqc')}`) ||
        file.endsWith(`${join('ops', 'crypto-cli.ts')}`) ||
        file.includes(`${join('src', 'supply-chain')}`) ||
        file.includes(`${join('src', 'audit')}`) ||
        file.endsWith(`${join('src', 'index.ts')}`) ||
        file.endsWith(`${join('wallet', 'types.ts')}`) ||
        file.endsWith(`${join('wallet', 'address.ts')}`) ||
        file.endsWith(`${join('wallet', 'builder.ts')}`) ||
        file.endsWith(`${join('wallet', 'index.ts')}`);
      if (allowsTestNetwork) {
        assert.equal(/LIVE_CHAIN|MAINNET_ENABLED/.test(source), false, file);
        assert.equal(/productionNetworkEnabled:\s*true/.test(source), false, file);
      } else {
        assert.equal(/mainnet|testnet|rpcUrl|LIVE_CHAIN/i.test(source), false, file);
      }
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
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-protocol')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-tx')), false);
    assert.equal(existsSync(join(ROOT, 'packages/moonrey')), false);
    assert.equal(existsSync(join(ROOT, 'packages/validators')), false);
    assert.equal(existsSync(join(ROOT, 'packages/staking')), false);
    assert.equal(existsSync(join(ROOT, 'packages/validator-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/governance')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-governance')), false);
    assert.equal(existsSync(join(ROOT, 'packages/machine-economy')), false);
    assert.equal(existsSync(join(ROOT, 'packages/machine-identity')), false);
    assert.equal(existsSync(join(ROOT, 'packages/oracle')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-oracle')), false);
    assert.equal(existsSync(join(ROOT, 'packages/oracle-network')), false);
    assert.equal(existsSync(join(ROOT, 'packages/fees')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-fees')), false);
    assert.equal(existsSync(join(ROOT, 'packages/gas')), false);
    assert.equal(existsSync(join(ROOT, 'packages/ibc')), false);
    assert.equal(existsSync(join(ROOT, 'packages/bridge')), false);
    assert.equal(existsSync(join(ROOT, 'packages/interop')), false);
    assert.equal(existsSync(join(ROOT, 'packages/light-client')), false);
    assert.equal(existsSync(join(ROOT, 'packages/relayer')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-ops')), false);
    assert.equal(existsSync(join(ROOT, 'packages/observability')), false);
    assert.equal(existsSync(join(ROOT, 'packages/disaster-recovery')), false);
    assert.equal(existsSync(join(ROOT, 'packages/wallet-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain-wallet')), false);
    assert.equal(existsSync(join(ROOT, 'packages/crypto-wallet')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-wallet-ledger')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-ops')), false);
    assert.equal(existsSync(join(ROOT, 'packages/validator-ops')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sentry')), false);
    assert.equal(existsSync(join(ROOT, 'packages/remote-signer')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-bench')), false);
    assert.equal(existsSync(join(ROOT, 'packages/performance')), false);
    assert.equal(existsSync(join(ROOT, 'packages/load-test')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-audit')), false);
    assert.equal(existsSync(join(ROOT, 'packages/audit')), false);
    assert.equal(existsSync(join(ROOT, 'packages/security-review')), false);
    assert.equal(existsSync(join(ROOT, 'packages/audit-evidence')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-testnet')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-faucet')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mainnet')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-mainnet')), false);
    assert.equal(existsSync(join(ROOT, 'packages/genesis-candidate')), false);
    assert.equal(existsSync(join(ROOT, 'packages/readiness-registry')), false);
    assert.equal(existsSync(join(ROOT, 'packages/activation-control')), false);
    assert.equal(existsSync(join(ROOT, 'packages/consensus-engine')), false);
    assert.equal(existsSync(join(ROOT, 'packages/tendermint')), false);
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

  it('keeps the transaction protocol from becoming a second ledger or JSON-hashed consensus', () => {
    const files = walk(join(ROOT, 'packages/sunrey-chain/src/protocol'));
    assert.equal(files.length > 0, true);
    for (const file of files) {
      if (file.endsWith('.test.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/class Money\b/.test(source), false, file);
      assert.equal(/Date\.now\s*\(|Math\.random\s*\(|fetch\s*\(/.test(source), false, file);
      assert.equal(/from ['"].*packages\/sunrey-coin/.test(source), false, file);
      if (file.endsWith('hash.ts')) {
        assert.equal(source.includes('JSON.stringify'), false, file);
        assert.equal(source.includes('canonicalJson'), false, file);
      }
    }
    const proto = readFileSync(join(ROOT, 'packages/sunrey-chain/protocol/v1/sunrey_tx_v1.proto'), 'utf8');
    assert.equal(proto.includes('syntax = "proto3"'), true);
    assert.equal(/\b(double|float)\s+|map</.test(proto), false);
    assert.equal(existsSync(join(ROOT, 'docs/architecture/chunk-32-resume.md')), true);
  });
});
