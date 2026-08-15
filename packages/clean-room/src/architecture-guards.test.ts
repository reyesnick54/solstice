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

describe('clean room architecture guards', () => {
  it('rejects journals, Execution Authority, coin issuance, and competing owners', () => {
    const files = walk(join(ROOT, 'packages/clean-room/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/AuthorityIssuer/.test(source), false, file);
      assert.equal(/ExecutionAuthority/.test(source), false, file);
      assert.equal(/SunRey Coin ticker|REYN\b|RYN\b|RCOIN/.test(source), false, file);
      assert.equal(/epsilon budget|differential privacy mechanism/i.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/privacy-compute')), false);
    assert.equal(existsSync(join(ROOT, 'packages/data-clean-room')), false);
    assert.equal(existsSync(join(ROOT, 'packages/secure-data-room')), false);
    assert.equal(existsSync(join(ROOT, 'packages/research-room')), false);
    assert.equal(existsSync(join(ROOT, 'packages/clean-room-v2')), false);
    const agent = walk(join(ROOT, 'packages/agent/src'));
    for (const file of agent) {
      const source = readFileSync(file, 'utf8');
      assert.equal(source.includes('packages/clean-room'), false, file);
    }
  });
});
