import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { listMigrationFiles, migrationsRoot, sha256Hex } from './migrate.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

describe('versioned SQL migrations', () => {
  it('lists contiguous immutable checksummed files for each domain', () => {
    for (const domain of ['customer', 'ledger', 'evidence'] as const) {
      const files = listMigrationFiles(migrationsRoot(REPO_ROOT, domain));
      assert.ok(files.length >= 1, domain);
      assert.equal(files[0]!.version, 1);
      for (let i = 0; i < files.length; i += 1) {
        assert.equal(files[i]!.version, i + 1);
        assert.equal(files[i]!.checksum, sha256Hex(files[i]!.sql));
        assert.match(files[i]!.filename, /^V\d+__/);
      }
    }
  });

  it('rejects a renamed or edited applied-style checksum change', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-migrate-'));
    writeFileSync(join(dir, 'V001__ok.sql'), 'SELECT 1;\n');
    const first = listMigrationFiles(dir);
    writeFileSync(join(dir, 'V001__ok.sql'), 'SELECT 2;\n');
    const second = listMigrationFiles(dir);
    assert.notEqual(first[0]!.checksum, second[0]!.checksum);
  });

  it('rejects a version gap', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-migrate-gap-'));
    writeFileSync(join(dir, 'V001__a.sql'), 'SELECT 1;\n');
    writeFileSync(join(dir, 'V003__c.sql'), 'SELECT 3;\n');
    assert.throws(() => listMigrationFiles(dir), /contiguous/);
  });

  it('ledger V001 has no account balance column and is append-only', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'ledger'));
    const v001 = files.find((file) => file.version === 1);
    assert.ok(v001);
    const accountTable = v001.sql.match(
      /CREATE TABLE ledger\.account \(([\s\S]*?)\);/,
    );
    assert.ok(accountTable);
    assert.equal(/\bbalance\b/i.test(accountTable[1] ?? ''), false);
    assert.match(v001.sql, /no account\.balance column/);
    assert.match(v001.sql, /forbid_financial_mutation/);
    assert.match(v001.sql, /journal_append_only/);
    assert.match(v001.sql, /posting_append_only/);
    assert.match(v001.sql, /assert_journal_balanced/);
    assert.match(v001.sql, /NUMERIC\(38, 0\)/);
  });
});
