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

describe('personal data vault architecture guards', () => {
  it('rejects competing vaults, custom crypto, marketplace, and raw-payload leakage paths', () => {
    const files = walk(join(ROOT, 'packages/personal-data-vault/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/AuthorityIssuer/.test(source), false, file);
      assert.equal(/LIVE_DATA_MARKET_ENABLED\s*=\s*true/.test(source), false, file);
      assert.equal(/createCipheriv|createDecipheriv/.test(source), false, file);
      assert.equal(/Sol Coin|Pyramid Coin|PYR\b/.test(source), false, file);
      assert.equal(/data auction|token reward|sol coin mint/i.test(source), false, file);
      assert.equal(/financialBalance:\s*[1-9]/.test(source), false, file);
    }
    const agent = walk(join(ROOT, 'packages/agent/src'));
    for (const file of agent) {
      const source = readFileSync(file, 'utf8');
      assert.equal(source.includes('personal-data-vault'), false, file);
      assert.equal(/VAULT_\*|wildcard vault/i.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/user-data')), false);
    assert.equal(existsSync(join(ROOT, 'packages/data-wallet')), false);
    assert.equal(existsSync(join(ROOT, 'packages/data-ownership')), false);
    assert.equal(existsSync(join(ROOT, 'packages/privacy-vault')), false);
    assert.equal(existsSync(join(ROOT, 'packages/personal-data-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/data-vault')), false);
    assert.equal(existsSync(join(ROOT, 'packages/privacy-compute')), false);
    assert.equal(existsSync(join(ROOT, 'packages/personal-data-fabric')), false);
    assert.equal(existsSync(join(ROOT, 'packages/data-fabric')), false);
    assert.equal(existsSync(join(ROOT, 'packages/vault-v2')), false);
  });
});
