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

describe('market surveillance architecture guards', () => {
  it('cannot freeze money, issue EA, or support SunRey Coin price', () => {
    const files = walk(join(ROOT, 'packages/market-surveillance/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/postJournal|AuthorityIssuer|ExecutionAuthority/.test(source), false, file);
      assert.equal(/from ['"].*packages\/ledger/.test(source), false, file);
      assert.equal(/manufacture volume|support price|guarantee appreciation/i.test(source), false, file);
      assert.equal(/from ['"].*services\//.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/market-surveillance')), true);
    assert.equal(existsSync(join(ROOT, 'packages/surveillance-v2')), false);
    const agent = walk(join(ROOT, 'packages/agent/src'));
    for (const file of agent) {
      const source = readFileSync(file, 'utf8');
      assert.equal(source.includes('packages/market-surveillance'), false, file);
    }
  });
});
