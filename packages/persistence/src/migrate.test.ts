import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { listMigrationFiles, migrationsRoot, sha256Hex } from './migrate.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

describe('versioned SQL migrations', () => {
  it('customer V002 adds identity schema without private credentials', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v002 = files.find((file) => file.version === 2);
    assert.ok(v002);
    assert.match(v002.sql, /CREATE SCHEMA IF NOT EXISTS identity/);
    assert.match(v002.sql, /CREATE TABLE identity.person_identity/);
    assert.match(v002.sql, /CREATE TABLE identity.webauthn_credential/);
    assert.match(v002.sql, /webauthn_no_private_material/);
    assert.equal(/\b(private_key|password_hash|session_secret)\b/i.test(v002.sql), false);
  });

  it('lists contiguous immutable checksummed files for each domain', () => {
    for (const domain of ['customer', 'ledger', 'evidence', 'security'] as const) {
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

  it('ledger V002 adds outbox, inbox, and dead-letter tables', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'ledger'));
    const v002 = files.find((file) => file.version === 2);
    assert.ok(v002);
    assert.match(v002.sql, /CREATE TABLE ledger\.outbox/);
    assert.match(v002.sql, /CREATE TABLE ledger\.inbox/);
    assert.match(v002.sql, /CREATE TABLE ledger\.dead_letter/);
    assert.match(v002.sql, /PRIMARY KEY \(consumer_id, event_id\)/);
  });

  it('customer V003 persists policy packs without executable rule code', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v003 = files.find((file) => file.version === 3);
    assert.ok(v003);
    assert.match(v003.sql, /CREATE TABLE customer\.policy_pack/);
    assert.match(v003.sql, /CREATE TABLE customer\.policy_version/);
    assert.match(v003.sql, /CREATE TABLE customer\.policy_rule/);
    assert.match(v003.sql, /CREATE TABLE customer\.legal_entity_capability/);
    assert.match(v003.sql, /CREATE TABLE customer\.manual_review_case/);
    assert.match(v003.sql, /screening_requirements/);
    assert.equal(/plpgsql|EXECUTE FUNCTION|eval\(/i.test(v003.sql), false);
  });

  it('customer V004 persists compliance fabric without raw PII', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v004 = files.find((file) => file.version === 4);
    assert.ok(v004);
    assert.match(v004.sql, /CREATE SCHEMA IF NOT EXISTS compliance/);
    assert.match(v004.sql, /CREATE TABLE compliance\.screening_result/);
    assert.match(v004.sql, /CREATE TABLE compliance\.case_record/);
    assert.match(v004.sql, /CREATE TABLE compliance\.human_decision/);
    assert.equal(/article_body|full_name|date_of_birth|ssn|legal_name_plain/i.test(v004.sql), false);
  });

  it('customer V005 stores payment records without raw account coordinates', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v005 = files.find((file) => file.version === 5);
    assert.ok(v005);
    assert.match(v005.sql, /CREATE SCHEMA IF NOT EXISTS payments/);
    assert.match(v005.sql, /coordinate_ref/);
    assert.equal(/\b(iban|account_number|routing_number)\b/i.test(v005.sql.replace(/--[^\n]*/g, '')), false);
  });

  it('customer V006 persists rail adapter records without credentials or raw coordinates', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v006 = files.find((file) => file.version === 6);
    assert.ok(v006);
    assert.match(v006.sql, /CREATE TABLE payments\.rail_submission/);
    assert.match(v006.sql, /CREATE TABLE payments\.provider_callback/);
    assert.match(v006.sql, /CREATE TABLE payments\.settlement_report/);
    assert.match(v006.sql, /CREATE TABLE payments\.inbound_rail_payment/);
    assert.equal(/\b(api_key|client_secret|iban|account_number)\b/i.test(v006.sql.replace(/--[^\n]*/g, '')), false);
  });

  it('customer V009 persists Personal Economic Graph projection without authoritative balances', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v009 = files.find((file) => file.version === 9);
    assert.ok(v009);
    assert.match(v009.sql, /CREATE SCHEMA IF NOT EXISTS economic_graph/);
    assert.match(v009.sql, /CREATE TABLE economic_graph.graph/);
    assert.match(v009.sql, /GRANT USAGE ON SCHEMA economic_graph TO customer_app/);
    assert.equal(/authoritative_balance BOOLEAN NOT NULL DEFAULT FALSE/.test(v009.sql), true);
  });

  it('customer V010 persists treasury liquidity without a second ledger or customer ownership', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v010 = files.find((file) => file.version === 10);
    assert.ok(v010);
    assert.match(v010.sql, /CREATE SCHEMA IF NOT EXISTS treasury/);
    assert.match(v010.sql, /CREATE TABLE treasury.account/);
    assert.match(v010.sql, /CREATE TABLE treasury.reservation/);
    assert.match(v010.sql, /treasury_no_customer_ownership/);
    assert.equal(/\bCREATE TABLE[\s\S]*\bbalance\b/i.test(v010.sql), false);
  });

  it('customer V008 stores wallet and SoftPOS records without PAN, CVV, or EMV data', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v008 = files.find((file) => file.version === 8);
    assert.ok(v008);
    assert.match(v008.sql, /CREATE TABLE cards\.device_payment_token/);
    assert.match(v008.sql, /CREATE TABLE cards\.acceptance_device/);
    assert.match(v008.sql, /CREATE TABLE cards\.acceptance_session/);
    assert.match(v008.sql, /CREATE TABLE cards\.merchant_payment/);
    assert.equal(/\b(pan|cvv|cvc|pin|track_data|magstripe|emv_data|tokenized_pan)\b/i.test(v008.sql.replace(/--[^\n]*/g, '')), false);
  });

  it('customer V007 stores card records without PAN or CVV', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v007 = files.find((file) => file.version === 7);
    assert.ok(v007);
    assert.match(v007.sql, /CREATE SCHEMA IF NOT EXISTS cards/);
    assert.match(v007.sql, /processor_card_ref/);
    assert.equal(/\b(pan|cvv|cvc|pin|track_data|magstripe)\b/i.test(v007.sql.replace(/--[^\n]*/g, '')), false);
  });

  it('security V001 stores metadata only and forbids private key material', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'security'));
    const v001 = files.find((file) => file.version === 1);
    assert.ok(v001);
    assert.match(v001.sql, /CREATE TABLE security\.key_metadata/);
    assert.match(v001.sql, /key_metadata_no_private_material/);
    assert.equal(/private_key|kms_plaintext|seed_phrase|recovery_phrase/i.test(v001.sql), false);
  });

  it('ledger V003 treats inbox as delivery state without a domain_event FK', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'ledger'));
    const v003 = files.find((file) => file.version === 3);
    assert.ok(v003);
    assert.match(v003.sql, /DROP CONSTRAINT IF EXISTS inbox_event_id_fkey/);
  });

  it('ledger V004 persists banking-core metadata without a balance column', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'ledger'));
    const v004 = files.find((file) => file.version === 4);
    assert.ok(v004);
    assert.match(v004.sql, /CREATE TABLE ledger\.funds_hold/);
    assert.match(v004.sql, /CREATE TABLE ledger\.pending_settlement/);
    assert.match(v004.sql, /CREATE TABLE ledger\.fee_assessment/);
    assert.match(v004.sql, /CREATE TABLE ledger\.reconciliation_item/);
    assert.match(v004.sql, /CREATE TABLE ledger\.account_coordinate/);
    assert.equal(/\bCREATE TABLE[\s\S]*\bbalance\b/i.test(v004.sql), false);
  });
});
