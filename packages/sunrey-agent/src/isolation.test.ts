import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { SUNREY_AGENT_ISOLATION } from './isolation.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('sunrey-agent isolation', () => {
  it('does not issue Execution Authority or post journals', () => {
    const root = join(import.meta.dirname);
    for (const file of walk(root)) {
      if (file.endsWith('isolation.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      const imports = source
        .split('\n')
        .filter((line) => /^\s*import\s/.test(line))
        .join('\n');
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/openAccount\s*\(/.test(source), false, file);
      assert.equal(/AuthorityIssuer/.test(imports), false, file);
      assert.equal(/new AuthorityIssuer/.test(source), false, file);
    }
  });

  it('does not create competing authority packages', () => {
    const repo = join(import.meta.dirname, '..', '..', '..');
    for (const alias of SUNREY_AGENT_ISOLATION.forbiddenCompetingPackages) {
      assert.equal(existsSync(join(repo, alias)), false, alias);
    }
  });
});
