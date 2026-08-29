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

describe('access-fabric architecture guards', () => {
  it('rejects ledgers, Execution Authority, monetary assets, and competing owners', () => {
    const files = walk(join(ROOT, 'packages/access-fabric/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/new AuthorityIssuer\s*\(/.test(source), false, file);
      assert.equal(/issueExecutionAuthority\s*\(/.test(source), false, file);
      assert.equal(/MoonRey|SunRey Coin|Reyn Coin/.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/access-fabric-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/access-entitlements')), false);
    assert.equal(existsSync(join(ROOT, 'packages/human-worth-access')), false);
  });
});
