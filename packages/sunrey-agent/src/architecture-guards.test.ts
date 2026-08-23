import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
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

describe('chunk 98 architecture guards', () => {
  it('does not create a second authority, wallet, exchange, risk engine, or ledger', () => {
    const files = walk(join(ROOT, 'packages/sunrey-agent/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/LIVE_\w+\s*=\s*true/.test(source), false, file);
      assert.equal(/ENVIRONMENT\s*=\s*'live'/.test(source), false, file);
      assert.equal(/\bAPY\b|\bAPR\b|blended return|guaranteed profit/i.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/ai-authority')), false);
    assert.equal(existsSync(join(ROOT, 'packages/agent-authority')), false);
    assert.equal(existsSync(join(ROOT, 'packages/user-agent-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/agent-execution')), false);
    assert.equal(existsSync(join(ROOT, 'packages/financial-automation')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mandate-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/agent-safety')), false);
    assert.equal(existsSync(join(ROOT, 'packages/eval-platform')), false);
    assert.equal(existsSync(join(ROOT, 'packages/agent-observability')), false);
    assert.equal(existsSync(join(ROOT, 'packages/kill-switch')), false);
  });
});
