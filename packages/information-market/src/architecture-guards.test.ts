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

describe('information market architecture guards', () => {
  it('rejects competing owners, invented tickers, marketplace mint, and agent execution', () => {
    const files = walk(join(ROOT, 'packages/information-market/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/AuthorityIssuer\.issue|this\.issuer\.issue\(/.test(source), false, file);
      assert.equal(/ticker\s*[:=]\s*['"]?(SUNREY|SRN|SRY|REYN|RYN|RCOIN)/.test(source), false, file);
      assert.equal(/\b(SRN|SRY|RYN|RCOIN)\b/.test(source), false, file);
      assert.equal(/APY|APR|blended return|yield rate|market cap/i.test(source), false, file);
      assert.equal(/from ['"].*services\//.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/pyramid-data-exchange')), false);
    assert.equal(existsSync(join(ROOT, 'packages/data-exchange')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-data-exchange')), false);
    assert.equal(existsSync(join(ROOT, 'packages/personal-oracle')), false);
    assert.equal(existsSync(join(ROOT, 'packages/information-market-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/proof-of-contribution')), false);
    assert.equal(existsSync(join(ROOT, 'packages/human-information-network')), false);
    assert.equal(existsSync(join(ROOT, 'packages/data-marketplace')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-exchange')), true);
    const agent = walk(join(ROOT, 'packages/agent/src'));
    for (const file of agent) {
      const source = readFileSync(file, 'utf8');
      assert.equal(source.includes('packages/information-market'), false, file);
    }
  });
});
