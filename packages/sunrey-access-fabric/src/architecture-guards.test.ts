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

describe('sunrey access fabric architecture guards', () => {
  it('does not own productive truth, act as oracle, or issue execution authority', () => {
    const files = walk(join(ROOT, 'packages/sunrey-access-fabric/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts') || file.endsWith('/fabric.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/AuthorityIssuer/.test(source), false, file);
      assert.equal(/ExecutionAuthority/.test(source), false, file);
      assert.equal(/MoonReyIssuanceAuthorization/.test(source), false, file);
      assert.equal(/registerProductiveObject/.test(source), false, file);
      assert.equal(/finalizeOracleFact/.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/access-fabric')), true);
    assert.equal(existsSync(join(ROOT, 'packages/productive-economy-data')), false);
    assert.equal(existsSync(join(ROOT, 'packages/moonrey-data-fabric')), false);
    assert.equal(existsSync(join(ROOT, 'packages/access-fabric-v2')), false);
  });
});
