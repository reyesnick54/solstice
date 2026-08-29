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
function stripStructuralMarkers(source: string): string {
  return source
    .replace(/isActionIntent:\s*false/g, '')
    .replace(/isExecutionAuthority:\s*false/g, '');
}

describe('ACCESS-01 architecture guards', () => {
  it('stays an access orchestration fabric and does not become a second financial authority', () => {
    const files = walk(join(ROOT, 'packages/access-economy/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts') || file.endsWith('isolation.ts') || file.endsWith('taxonomy.ts')) {
        continue;
      }
      const source = stripStructuralMarkers(readFileSync(file, 'utf8'));
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/openAccount\s*\(/.test(source), false, file);
      assert.equal(/new AuthorityIssuer/.test(source), false, file);
      assert.equal(/ComplianceKernel/.test(source), false, file);
      assert.equal(/ActionIntent/.test(source), false, file);
      assert.equal(/LIVE_\w+\s*=\s*true/.test(source), false, file);
      assert.equal(/ENVIRONMENT\s*=\s*'live'/.test(source), false, file);
      assert.equal(/\bAPY\b|\bAPR\b|blended return|guaranteed profit|access coin|social credit/i.test(source), false, file);
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
    assert.equal(existsSync(join(ROOT, 'packages/kernel/src/kernel.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/permissions/src/execution-authority.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/ledger/src/journal.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-exchange/src/service.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/personal-economic-graph/src/service.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/agent/src/service.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-agent/src/engine.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/regulatory-twin/src/service.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/evidence/src/vault.ts')), true);

    assert.equal(ACCESS_ECONOMY_ISOLATION.financialStateMutation, false);
    assert.equal(ACCESS_ECONOMY_ISOLATION.executionAuthorityRequired, false);
    assert.equal(ACCESS_ECONOMY_ISOLATION.kernelAuthorizationRequired, false);
    assert.equal(ACCESS_ECONOMY_ISOLATION.mintingImplemented, false);
    assert.equal(ACCESS_ECONOMY_ISOLATION.settlementImplemented, false);
    assert.equal(ACCESS_ECONOMY_ISOLATION.accessCoinImplemented, false);
    assert.equal(ACCESS_ECONOMY_ISOLATION.productionActivated, false);
  });
});
