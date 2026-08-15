import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { PEVE_ISOLATION } from './isolation.ts';

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

describe('PEVE isolation', () => {
  it('does not post journals, issue Execution Authority, or become a second PEG', () => {
    const root = join(import.meta.dirname);
    for (const file of walk(root)) {
      const source = readFileSync(file, 'utf8');
      if (file.endsWith('isolation.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      assert.equal(source.includes('postJournal('), false, `${file} must not post journals`);
      assert.equal(source.includes('AuthorityIssuer'), false, `${file} must not issue Execution Authority`);
      assert.equal(source.includes('ComplianceKernel'), false, `${file} must not import the Kernel`);
      assert.equal(source.includes('new EconomicGraphService'), false, `${file} must not become a second PEG`);
    }
    assert.equal(PEVE_ISOLATION.postsJournals, false);
    assert.equal(PEVE_ISOLATION.executionAuthorityIssued, false);
    assert.equal(PEVE_ISOLATION.isSecondPeg, false);
    assert.equal(PEVE_ISOLATION.isHumanWorthScore, false);
    assert.equal(PEVE_ISOLATION.isCreditScore, false);
  });

  it('does not create a competing value-engine package', () => {
    const repo = join(import.meta.dirname, '../../../..');
    for (const alias of PEVE_ISOLATION.mayNotBecome) {
      assert.equal(existsSync(join(repo, alias)), false, `${alias} must not exist`);
    }
  });
});
