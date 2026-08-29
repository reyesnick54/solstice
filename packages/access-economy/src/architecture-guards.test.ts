import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ACCESS_ECONOMY_ISOLATION } from './isolation.ts';

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

describe('access economy architecture guards', () => {
  it('stays a domain model and does not become settlement, pricing, or execution authority', () => {
    const files = walk(join(ROOT, 'packages/access-economy/src'));
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
      for (const forbidden of ACCESS_ECONOMY_ISOLATION.mustNotImport) {
        if (forbidden === 'packages/domain') {
          continue;
        }
        assert.equal(source.includes(`../../${forbidden}`), false, `${file} imports ${forbidden}`);
        assert.equal(source.includes(`@solstice/${forbidden.replace('packages/', '')}`), false, `${file} npm-imports ${forbidden}`);
      }
    }

    for (const alias of ACCESS_ECONOMY_ISOLATION.forbiddenCompetingPackages) {
      assert.equal(existsSync(join(ROOT, alias)), false, alias);
    }

    assert.equal(ACCESS_ECONOMY_ISOLATION.pricingImplemented, false);
    assert.equal(ACCESS_ECONOMY_ISOLATION.reservationExecutionImplemented, false);
    assert.equal(ACCESS_ECONOMY_ISOLATION.exchangeIntegrationImplemented, false);
    assert.equal(ACCESS_ECONOMY_ISOLATION.issuesExecutionAuthority, false);
    assert.equal(ACCESS_ECONOMY_ISOLATION.authorizesMinting, false);
    assert.equal(ACCESS_ECONOMY_ISOLATION.authorizesSettlement, false);
  });
});
