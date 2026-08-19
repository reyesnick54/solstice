import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { AI_RUNTIME_ISOLATION } from './isolation.ts';

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

describe('chunk 101 architecture guards', () => {
  it('stays on the inference plane', () => {
    const files = walk(join(ROOT, 'packages/ai-runtime/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts') || file.endsWith('isolation.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/openAccount\s*\(/.test(source), false, file);
      assert.equal(/new AuthorityIssuer/.test(source), false, file);
      assert.equal(/LIVE_\w+\s*=\s*true/.test(source), false, file);
      assert.equal(/ENVIRONMENT\s*=\s*'live'/.test(source), false, file);
      assert.equal(/\bAPY\b|\bAPR\b|blended return|guaranteed profit/i.test(source), false, file);
      assert.equal(/\bfetch\s*\(/.test(source), false, file);
      assert.equal(/https?:\/\//.test(source), false, file);
      assert.equal(/parseFloat\s*\(/.test(source), false, file);
    }
    for (const alias of AI_RUNTIME_ISOLATION.forbiddenCompetingPackages) {
      assert.equal(existsSync(join(ROOT, alias)), false, alias);
    }
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-agent/src/engine.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/model-registry/src/registry.ts')), true);
  });
});
