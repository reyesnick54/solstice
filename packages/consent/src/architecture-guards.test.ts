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

describe('consent architecture guards', () => {
  it('rejects financial journals, Execution Authority, wildcards, and competing owners', () => {
    const files = walk(join(ROOT, 'packages/consent/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/AuthorityIssuer/.test(source), false, file);
      assert.equal(/ExecutionAuthority/.test(source), false, file);
      assert.equal(/Reyn Coin|Pyramid Coin|Sol Coin/.test(source), false, file);
      assert.equal(/ALL_DATA|ALL_PURPOSES|FOREVER/.test(source) && !file.endsWith('taxonomy.ts'), false, file);
    }
    const agent = walk(join(ROOT, 'packages/agent/src'));
    for (const file of agent) {
      const source = readFileSync(file, 'utf8');
      assert.equal(source.includes('personal-data-vault'), false, file);
      assert.equal(/pg\.|CREATE TABLE/.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/privacy-consent')), false);
    assert.equal(existsSync(join(ROOT, 'packages/user-consent')), false);
    assert.equal(existsSync(join(ROOT, 'packages/permissions-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/purpose-firewall')), false);
    assert.equal(existsSync(join(ROOT, 'packages/consent-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/privacy-compute')), false);
    assert.equal(existsSync(join(ROOT, 'packages/data-clean-room')), false);
  });
});
