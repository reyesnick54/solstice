import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { AGENT_ISOLATION } from './isolation.ts';

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

describe('Personal Economy Agent isolation', () => {
  it('does not import platform, kernel, ledger, or Execution Authority', () => {
    const root = join(import.meta.dirname);
    for (const file of walk(root)) {
      const source = readFileSync(file, 'utf8');
      for (const forbidden of AGENT_ISOLATION.mayNotImport) {
        if (file.endsWith('isolation.ts')) {
          continue;
        }
        assert.equal(
          source.includes(forbidden),
          false,
          `${file} must not mention ${forbidden}`,
        );
      }
    }
  });
});
