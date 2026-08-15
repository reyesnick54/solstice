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

describe('sunrey coin architecture guards', () => {
  it('rejects competing owners, invented tickers, and agent execution', () => {
    const files = walk(join(ROOT, 'packages/sunrey-coin/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/AuthorityIssuer\.issue|this\.issuer\.issue\(/.test(source), false, file);
      assert.equal(/ticker\s*[:=]\s*['"]?(SUNREY|SRN|SRY|REYN|RYN|RCOIN)/.test(source), false, file);
      assert.equal(/\b(SRN|SRY|RYN|RCOIN)\b/.test(source), false, file);
      assert.equal(/APY|APR|blended return|yield rate|market cap/i.test(source), false, file);
      if (file.endsWith('formula.ts')) {
        for (const trait of [
          'race',
          'religion',
          'ethnicity',
          'political',
          'sexual orientation',
          'disability',
          'genetic',
          'medical condition',
        ]) {
          assert.equal(source.toLowerCase().includes(trait), false, `${file} ${trait}`);
        }
      }
    }
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-ledger')), false);
    assert.equal(existsSync(join(ROOT, 'packages/reyn-ledger')), false);
    assert.equal(existsSync(join(ROOT, 'packages/reyn-coin')), false);
    assert.equal(existsSync(join(ROOT, 'packages/coin-ledger')), false);
    assert.equal(existsSync(join(ROOT, 'packages/crypto-ledger-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/token-ledger')), false);
    assert.equal(existsSync(join(ROOT, 'packages/coin-engine-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-exchange')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain')), false);
    const agent = walk(join(ROOT, 'packages/agent/src'));
    for (const file of agent) {
      const source = readFileSync(file, 'utf8');
      assert.equal(source.includes('packages/sunrey-coin'), false, file);
      assert.equal(source.includes('ExecutionAuthority'), false, file);
    }
  });
});
