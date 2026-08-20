import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { allowlistFingerprint } from './naming-allowlist.ts';
import { extractLegacyTokens } from './naming-classification.ts';
import {
  buildNamingInventory,
  collectPublicSurfaceDebt,
  evaluatePublicSurfaceGuard,
  inventoryIsDeterministic,
  protocolIdentifiersUnchanged,
  runNamingAudit,
  scanLegacyOccurrences,
} from './naming-audit.ts';
import { GITHUB_REPOSITORY_PATH, GITHUB_REPOSITORY_RENAMED } from './product-identity.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('SunRey naming audit', () => {
  it('does not count irrelevant substrings', () => {
    assert.deepEqual(extractLegacyTokens('absolsticefoo and parasolstice'), []);
    const tokens = extractLegacyTokens('Solstice and SOLSTICE_UK and @solstice/config and solstice.identity/1');
    assert.deepEqual(
      tokens.map((item) => item.token),
      ['Solstice', 'SOLSTICE_UK', '@solstice/config', 'solstice.identity/1'],
    );
  });

  it('inventory is deterministic', () => {
    const files = [
      'README.md',
      'package.json',
      'packages/persistence/src/env.ts',
      'db/customer/migrations/V001__customer.sql',
      'packages/permissions/src/verified-seal.ts',
    ];
    assert.equal(inventoryIsDeterministic(REPO_ROOT, files), true);
    const first = buildNamingInventory(scanLegacyOccurrences(REPO_ROOT, files));
    const second = buildNamingInventory(scanLegacyOccurrences(REPO_ROOT, files));
    assert.equal(JSON.stringify(first), JSON.stringify(second));
  });

  it('allowlist fingerprint is deterministic', () => {
    assert.equal(allowlistFingerprint(), allowlistFingerprint());
  });

  it('new active public Solstice string fails the guard', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-naming-'));
    mkdirSync(join(dir, 'docs/architecture'), { recursive: true });
    writeFileSync(join(dir, 'README.md'), 'Welcome to Solstice Banking\n');
    writeFileSync(
      join(dir, 'docs/architecture/sunrey-naming-public-debt.json'),
      `${JSON.stringify({ schemaVersion: 1, note: 'empty', entries: [] }, null, 2)}\n`,
    );
    const result = runNamingAudit(dir, ['README.md']);
    assert.equal(result.ok, false);
    assert.equal(result.publicFindings.length > 0, true);
    assert.equal(result.publicFindings[0]?.token, 'Solstice');
  });

  it('allowed historical occurrence passes the guard', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-naming-hist-'));
    mkdirSync(join(dir, 'db/customer/migrations'), { recursive: true });
    mkdirSync(join(dir, 'docs/architecture'), { recursive: true });
    writeFileSync(join(dir, 'db/customer/migrations/V001__customer.sql'), 'CREATE DATABASE solstice_customer;\n');
    writeFileSync(
      join(dir, 'docs/architecture/sunrey-naming-public-debt.json'),
      `${JSON.stringify({ schemaVersion: 1, note: 'empty', entries: [] }, null, 2)}\n`,
    );
    const result = runNamingAudit(dir, ['db/customer/migrations/V001__customer.sql']);
    assert.equal(result.ok, true);
    assert.equal(result.publicFindings.length, 0);
    assert.equal(result.inventory.occurrences[0]?.allowlisted, true);
    assert.equal(result.inventory.occurrences[0]?.recommendedAction, 'PRESERVE_IMMUTABLE');
  });

  it('known public-surface debt passes and is not treated as allowlisted', () => {
    const occurrences = scanLegacyOccurrences(REPO_ROOT, ['README.md', 'package.json']);
    const debt = { schemaVersion: 1 as const, note: 'test', entries: collectPublicSurfaceDebt(occurrences) };
    const findings = evaluatePublicSurfaceGuard(occurrences, debt);
    assert.equal(findings.length, 0);
    const publicMust = occurrences.filter(
      (item) => item.classification === 'PUBLIC_PRODUCT_NAME' && item.recommendedAction === 'MUST_MIGRATE',
    );
    assert.equal(
      publicMust.every((item) => item.allowlisted === false),
      true,
    );
  });

  it('audit does not change protocol identifiers', () => {
    assert.equal(protocolIdentifiersUnchanged(REPO_ROOT), true);
    runNamingAudit(REPO_ROOT, [
      'packages/sunrey-sdk/src/ids.ts',
      'packages/permissions/src/verified-seal.ts',
      'packages/identity/src/actor-context.ts',
      'packages/security/src/crypto-guard.ts',
      'packages/sunrey-sdk/src/builders.ts',
    ]);
    assert.equal(protocolIdentifiersUnchanged(REPO_ROOT), true);
  });

  it('repo name is not proposed for modification', () => {
    assert.equal(GITHUB_REPOSITORY_RENAMED, false);
    assert.equal(GITHUB_REPOSITORY_PATH, 'reyesnick54/solstice');
    const occurrences = scanLegacyOccurrences(REPO_ROOT, ['packages/config/src/product-identity.ts']);
    const repoPath = occurrences.find((item) => item.lineText.includes('GITHUB_REPOSITORY_PATH'));
    assert.ok(repoPath);
    assert.equal(repoPath.recommendedAction, 'HISTORICAL_ONLY');
    assert.notEqual(repoPath.recommendedAction, 'MUST_MIGRATE');
  });
});
