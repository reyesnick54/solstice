import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { HUMAN_CONTRIBUTION_ISOLATION } from './isolation.ts';

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

describe('chunk 104 architecture guards', () => {
  it('stays an ontology and does not become a second financial authority', () => {
    const files = walk(join(ROOT, 'packages/human-economic-contribution/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts') || file.endsWith('isolation.ts') || file.endsWith('verification-demo.ts')) {
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
      assert.equal(/new AuthorityIssuer|issueExecutionAuthority/.test(source), false, file);
      assert.equal(/valuationAmount\s*[:=]\s*(?!null)/.test(source) && /valuationAmount\s*[:=]\s*[0-9]/.test(source), false, file);
      for (const forbidden of HUMAN_CONTRIBUTION_ISOLATION.mustNotImport) {
        if (forbidden === 'packages/domain') {
          continue;
        }
        assert.equal(source.includes(`../../${forbidden}`), false, `${file} imports ${forbidden}`);
        assert.equal(source.includes(`@solstice/${forbidden.replace('packages/', '')}`), false, `${file} npm-imports ${forbidden}`);
      }
    }
    for (const alias of HUMAN_CONTRIBUTION_ISOLATION.forbiddenCompetingPackages) {
      assert.equal(existsSync(join(ROOT, alias)), false, alias);
    }
    assert.equal(existsSync(join(ROOT, 'packages/personal-economic-graph/src/service.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/platform/src/value/service.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/information-market/src/network/engine.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/human-economic-contribution/src/valuation/constitution.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/human-valuation-engine')), false);
    assert.equal(HUMAN_CONTRIBUTION_ISOLATION.valuationImplemented, false);
    assert.equal(HUMAN_CONTRIBUTION_ISOLATION.valuationConstitutionImplemented, true);
    assert.equal(HUMAN_CONTRIBUTION_ISOLATION.valuationEngineComputesSettlement, false);
    assert.equal(HUMAN_CONTRIBUTION_ISOLATION.mintingImplemented, false);
    assert.equal(HUMAN_CONTRIBUTION_ISOLATION.financialStateMutation, false);
    assert.equal(HUMAN_CONTRIBUTION_ISOLATION.productionValuationActivated, false);
  });
});
