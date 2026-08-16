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
    assert.match(v009.sql, /CREATE TABLE economic_graph.fact/);
    assert.match(v009.sql, /authoritative_balance BOOLEAN NOT NULL DEFAULT FALSE/);
    assert.match(v009.sql, /mutates_financial_state BOOLEAN NOT NULL DEFAULT FALSE/);
    assert.match(v009.sql, /GRANT USAGE ON SCHEMA economic_graph TO customer_app/);
    assert.equal(/\b(pan|cvv|private_key|api_key)\b/i.test(v009.sql.replace(/--[^\n]*/g, '')), false);
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

  it('customer V014 persists investment profiles without a balance column or live broker state', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v014 = files.find((file) => file.version === 14);
    assert.ok(v014);
    assert.match(v014.sql, /CREATE SCHEMA IF NOT EXISTS investment/);
    assert.match(v014.sql, /CREATE TABLE investment.profile/);
    assert.match(v014.sql, /CREATE TABLE investment.instrument/);
    assert.match(v014.sql, /CREATE TABLE investment.paper_order/);
    assert.match(v014.sql, /CREATE TABLE investment.lot/);
    assert.match(v014.sql, /live_state BOOLEAN NOT NULL CHECK \(live_state = FALSE\)/);
    assert.match(v014.sql, /investment_profile_no_balance/);
    assert.match(v014.sql, /GRANT USAGE ON SCHEMA investment TO customer_app/);
    assert.match(v014.sql, /investment_valuation_no_yield/);
    assert.equal(/\b(apy|apr)\b/i.test(v014.sql.replace(/--[^\n]*/g, '').replace(/NOT LIKE '%apy%'/gi, '').replace(/NOT LIKE '%APR%'/g, '')), false);
  });

  it('customer V012 persists PEVE snapshots and attribution without a financial ledger', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v012 = files.find((file) => file.version === 12);
    assert.ok(v012);
    assert.match(v012.sql, /CREATE SCHEMA IF NOT EXISTS peve/);
    assert.match(v012.sql, /CREATE TABLE peve.snapshot/);
    assert.match(v012.sql, /CREATE TABLE peve.attribution_entry/);
    assert.match(v012.sql, /peve_attribution_no_principal/);
    assert.match(v012.sql, /peve_snapshot_no_human_worth/);
    assert.match(v012.sql, /GRANT USAGE ON SCHEMA peve TO customer_app/);
    assert.equal(/\b(apy|apr)\b/i.test(v012.sql.replace(/--[^\n]*/g, '')), false);
    assert.equal(/CREATE TABLE peve\.journal/i.test(v012.sql), false);
  });

  it('customer V011 persists mandate versions and growth plans without guaranteed-return fields', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v011 = files.find((file) => file.version === 11);
    assert.ok(v011);
    assert.match(v011.sql, /CREATE SCHEMA IF NOT EXISTS growth/);
    assert.match(v011.sql, /CREATE TABLE growth.mandate_version/);
    assert.match(v011.sql, /CREATE TABLE growth.plan/);
    assert.match(v011.sql, /growth_plan_no_guaranteed_return/);
    assert.match(v011.sql, /GRANT USAGE ON SCHEMA growth TO customer_app/);
    assert.equal(/\b(apy|apr)\b/i.test(v011.sql.replace(/--[^\n]*/g, '')), false);
  });

  it('customer V013 persists Regulatory Digital Twin artifacts without a second policy store', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v013 = files.find((file) => file.version === 13);
    assert.ok(v013);
    assert.match(v013.sql, /CREATE SCHEMA IF NOT EXISTS regulatory_twin/);
    assert.match(v013.sql, /CREATE TABLE regulatory_twin.snapshot/);
    assert.match(v013.sql, /CREATE TABLE regulatory_twin.scenario_run/);
    assert.match(v013.sql, /CREATE TABLE regulatory_twin.candidate_set/);
    assert.match(v013.sql, /rdt_candidate_no_counsel/);
    assert.match(v013.sql, /GRANT USAGE ON SCHEMA regulatory_twin TO customer_app/);
    assert.match(v013.sql, /twin_id LIKE 'rtw_%'/);
    assert.match(v013.sql, /snapshot_id LIKE 'rsn_%'/);
    assert.equal(/CREATE TABLE customer\.policy_pack/.test(v013.sql), false);
  });

  it('customer V014 persists investment profiles without a balance column or live broker state', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v014 = files.find((file) => file.version === 14);
    assert.ok(v014);
    assert.match(v014.sql, /CREATE SCHEMA IF NOT EXISTS investment/);
    assert.match(v014.sql, /CREATE TABLE investment.profile/);
    assert.match(v014.sql, /CREATE TABLE investment.instrument/);
    assert.match(v014.sql, /CREATE TABLE investment.paper_order/);
    assert.match(v014.sql, /CREATE TABLE investment.lot/);
    assert.match(v014.sql, /live_state BOOLEAN NOT NULL CHECK \(live_state = FALSE\)/);
    assert.match(v014.sql, /investment_profile_no_balance/);
    assert.match(v014.sql, /GRANT USAGE ON SCHEMA investment TO customer_app/);
    assert.match(v014.sql, /investment_valuation_no_yield/);
    assert.equal(/\b(apy|apr)\b/i.test(v014.sql.replace(/--[^\n]*/g, '').replace(/NOT LIKE '%apy%'/gi, '').replace(/NOT LIKE '%APR%'/g, '')), false);
  });

  it('customer V015 persists risk budgets and assessments without a second ledger', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v015 = files.find((file) => file.version === 15);
    assert.ok(v015);
    assert.match(v015.sql, /CREATE SCHEMA IF NOT EXISTS risk/);
    assert.match(v015.sql, /CREATE TABLE risk.budget/);
    assert.match(v015.sql, /CREATE TABLE risk.assessment/);
    assert.match(v015.sql, /CREATE TABLE risk.portfolio_snapshot/);
    assert.match(v015.sql, /CREATE TABLE risk.stress_run/);
    assert.match(v015.sql, /GRANT USAGE ON SCHEMA risk TO customer_app/);
    assert.match(v015.sql, /risk_budget_id_prefix/);
    assert.equal(/CREATE TABLE risk\.journal/i.test(v015.sql), false);
    assert.equal(/\b(apy|apr)\b/i.test(v015.sql.replace(/--[^\n]*/g, '').replace(/NOT LIKE '%apy%'/gi, '').replace(/NOT LIKE '%APR%'/g, '')), false);
  });

  it('customer V016 persists model registry metadata without executable code or LIVE_APPROVED', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v016 = files.find((file) => file.version === 16);
    assert.ok(v016);
    assert.match(v016.sql, /CREATE SCHEMA IF NOT EXISTS model_registry/);
    assert.match(v016.sql, /CREATE TABLE model_registry.model_version/);
    assert.match(v016.sql, /CREATE TABLE model_registry.validation/);
    assert.match(v016.sql, /CREATE TABLE model_registry.approval/);
    assert.match(v016.sql, /model_no_executable/);
    assert.match(v016.sql, /model_no_live_approved/);
    assert.match(v016.sql, /lifecycle <> 'LIVE_APPROVED'/);
    assert.match(v016.sql, /GRANT USAGE ON SCHEMA model_registry TO customer_app/);
    const lifecycleIn = v016.sql.match(/lifecycle TEXT NOT NULL CHECK \(lifecycle IN \(([\s\S]*?)\)\)/);
    assert.ok(lifecycleIn);
    assert.equal(/LIVE_APPROVED/.test(lifecycleIn[1] ?? ''), false);
  });

  it('customer V017 persists Agentic Capital Mesh structured records without chain-of-thought', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v017 = files.find((file) => file.version === 17);
    assert.ok(v017);
    assert.equal(v017.filename, 'V017__agentic_capital_mesh.sql');
    assert.match(v017.sql, /CREATE SCHEMA IF NOT EXISTS capital_mesh/);
    assert.match(v017.sql, /CREATE TABLE capital_mesh.run/);
    assert.match(v017.sql, /CREATE TABLE capital_mesh.proposal/);
    assert.match(v017.sql, /strategy_validation <> 'VALIDATED'/);
    assert.match(v017.sql, /agent_votes_authorize BOOLEAN NOT NULL CHECK \(agent_votes_authorize = FALSE\)/);
    assert.match(v017.sql, /executable BOOLEAN NOT NULL CHECK \(executable = FALSE\)/);
    assert.match(v017.sql, /GRANT USAGE ON SCHEMA capital_mesh TO customer_app/);
    const sqlWithoutComments = v017.sql
      .replace(/--[^\n]*/g, '')
      .replace(/NOT LIKE '%BEGIN_PROMPT%'/gi, '');
    assert.equal(/chain.of.thought|BEGIN_PROMPT/i.test(sqlWithoutComments), false);
    assert.equal(/CREATE TABLE capital_mesh\.journal/i.test(v017.sql), false);
  });

  it('customer V018 persists Strategy Lab experiment records without live trading', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v018 = files.find((file) => file.version === 18);
    assert.ok(v018);
    assert.equal(v018.filename, 'V018__strategy_lab.sql');
    assert.match(v018.sql, /CREATE SCHEMA IF NOT EXISTS strategy_lab/);
    assert.match(v018.sql, /CREATE TABLE strategy_lab.strategy/);
    assert.match(v018.sql, /CREATE TABLE strategy_lab.experiment/);
    assert.match(v018.sql, /CREATE TABLE strategy_lab.backtest_run/);
    assert.match(v018.sql, /live_approved BOOLEAN NOT NULL CHECK \(live_approved = FALSE\)/);
    assert.match(v018.sql, /simulation_only BOOLEAN NOT NULL CHECK \(simulation_only = TRUE\)/);
    assert.match(v018.sql, /lifecycle NOT IN \('LIVE_APPROVED', 'LIVE_RUNNING', 'LIVE'\)/);
    assert.match(v018.sql, /GRANT USAGE ON SCHEMA strategy_lab TO customer_app/);
    assert.equal(/CREATE TABLE strategy_lab\.journal/i.test(v018.sql), false);
  });

  it('customer V019 persists Personal Data Vault metadata and ciphertext without plaintext payload columns', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v019 = files.find((file) => file.version === 19);
    assert.ok(v019);
    assert.equal(v019.filename, 'V019__personal_data_vault.sql');
    assert.match(v019.sql, /CREATE SCHEMA IF NOT EXISTS personal_data_vault/);
    assert.match(v019.sql, /CREATE TABLE personal_data_vault.vault/);
    assert.match(v019.sql, /CREATE TABLE personal_data_vault.asset/);
    assert.match(v019.sql, /CREATE TABLE personal_data_vault.payload/);
    assert.match(v019.sql, /CREATE TABLE personal_data_vault.access_audit/);
    assert.match(v019.sql, /authoritative_for_financial_state = FALSE/);
    assert.match(v019.sql, /pdv_asset_no_financial_balance/);
    assert.match(v019.sql, /pdv_payload_envelope_not_plaintext/);
    assert.match(v019.sql, /GRANT USAGE ON SCHEMA personal_data_vault TO customer_app/);
    assert.equal(/plaintext_payload/i.test(v019.sql), false);
  });

  it('customer V020 persists Consent Ledger history without a financial ledger or raw payload', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v020 = files.find((file) => file.version === 20);
    assert.ok(v020);
    assert.equal(v020.filename, 'V020__consent.sql');
    assert.match(v020.sql, /CREATE SCHEMA IF NOT EXISTS consent/);
    assert.match(v020.sql, /CREATE TABLE consent.record/);
    assert.match(v020.sql, /CREATE TABLE consent.purpose/);
    assert.match(v020.sql, /CREATE TABLE consent.permit/);
    assert.match(v020.sql, /CREATE TABLE consent.ledger_entry/);
    assert.match(v020.sql, /GRANT USAGE ON SCHEMA consent TO customer_app/);
    assert.equal(/CREATE TABLE consent\.journal/i.test(v020.sql), false);
    assert.equal(/plaintext/i.test(v020.sql.replace(/--[^\n]*/g, '').replace(/NOT LIKE '%plaintext%'/gi, '')), false);
  });

  it('customer V021 persists Clean Room metadata without decrypted payloads or coin issuance', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v021 = files.find((file) => file.version === 21);
    assert.ok(v021);
    assert.equal(v021.filename, 'V021__clean_room.sql');
    assert.match(v021.sql, /CREATE SCHEMA IF NOT EXISTS clean_room/);
    assert.match(v021.sql, /CREATE TABLE clean_room.session/);
    assert.match(v021.sql, /CREATE TABLE clean_room.receipt/);
    assert.match(v021.sql, /CREATE TABLE clean_room.contribution_ref/);
    assert.match(v021.sql, /DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED/);
    assert.match(v021.sql, /GRANT USAGE ON SCHEMA clean_room TO customer_app/);
    assert.equal(/CREATE TABLE clean_room\.journal/i.test(v021.sql), false);
    assert.equal(/coin_issued BOOLEAN NOT NULL CHECK \(coin_issued = FALSE\)/.test(v021.sql), true);
  });

  it('customer V022 persists SunRey Coin metadata without a second ledger or ticker', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v022 = files.find((file) => file.version === 22);
    assert.ok(v022);
    assert.equal(v022.filename, 'V022__sunrey_coin.sql');
    assert.match(v022.sql, /CREATE SCHEMA IF NOT EXISTS sunrey_coin/);
    assert.match(v022.sql, /CREATE TABLE sunrey_coin.asset/);
    assert.match(v022.sql, /CREATE TABLE sunrey_coin.supply_policy/);
    assert.match(v022.sql, /ticker_status TEXT NOT NULL CHECK \(ticker_status = 'NOT_ASSIGNED'\)/);
    assert.match(v022.sql, /GRANT USAGE ON SCHEMA sunrey_coin TO customer_app/);
    assert.equal(/CREATE TABLE sunrey_coin\.journal/i.test(v022.sql), false);
    assert.equal(/APY|APR|market_price|ticker_symbol/i.test(v022.sql), false);
  });

  it('customer V025 persists SunRey Exchange metadata without a balance column or second ledger', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v025 = files.find((file) => file.version === 25);
    assert.ok(v025);
    assert.equal(v025.filename, 'V025__sunrey_exchange.sql');
    assert.match(v025.sql, /CREATE SCHEMA IF NOT EXISTS sunrey_exchange/);
    assert.match(v025.sql, /CREATE TABLE sunrey_exchange.account/);
    assert.match(v025.sql, /CREATE TABLE sunrey_exchange.exchange_order/);
    assert.match(v025.sql, /CREATE TABLE sunrey_exchange.trade/);
    assert.match(v025.sql, /CREATE TABLE sunrey_exchange.settlement/);
    assert.match(v025.sql, /price_label TEXT NOT NULL CHECK \(price_label = 'SIMULATION_MARKET_PRICE'\)/);
    assert.match(v025.sql, /GRANT USAGE ON SCHEMA sunrey_exchange TO customer_app/);
    assert.equal(/CREATE TABLE sunrey_exchange\.journal/i.test(v025.sql), false);
    assert.equal(/CREATE TABLE sunrey_exchange\.\w*balance/i.test(v025.sql), false);
    assert.equal(/\bbalance\b/i.test(v025.sql), false);
    assert.equal(/APY|APR|market_cap|ticker_symbol/i.test(v025.sql), false);
  });

  it('customer V026 persists custody and surveillance metadata without a second ledger or keys', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v026 = files.find((file) => file.version === 26);
    assert.ok(v026);
    assert.equal(v026.filename, 'V026__exchange_controls.sql');
    assert.match(v026.sql, /CREATE SCHEMA IF NOT EXISTS custody/);
    assert.match(v026.sql, /CREATE SCHEMA IF NOT EXISTS market_surveillance/);
    assert.match(v026.sql, /CREATE TABLE custody.deposit/);
    assert.match(v026.sql, /CREATE TABLE custody.withdrawal/);
    assert.match(v026.sql, /CREATE TABLE custody.travel_rule_message/);
    assert.match(v026.sql, /CREATE TABLE market_surveillance.alert/);
    assert.match(v026.sql, /provider_balance_is_truth BOOLEAN NOT NULL CHECK \(provider_balance_is_truth = FALSE\)/);
    assert.match(v026.sql, /legal_conclusion BOOLEAN NOT NULL CHECK \(legal_conclusion = FALSE\)/);
    assert.equal(/private_key|mnemonic|seed_phrase/i.test(v026.sql), false);
    assert.equal(/CREATE TABLE custody\.journal/i.test(v026.sql), false);
    assert.equal(
      /\bbalance\b/i.test(
        v026.sql.replace(/--[^\n]*/g, '').replace(/provider_balance_is_truth/g, ''),
      ),
      false,
    );
  });

  it('customer V024 persists SunRey Chain metadata without a second ledger or live network', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v024 = files.find((file) => file.version === 24);
    assert.ok(v024);
    assert.equal(v024.filename, 'V024__sunrey_chain.sql');
    assert.match(v024.sql, /CREATE SCHEMA IF NOT EXISTS sunrey_chain/);
    assert.match(v024.sql, /CREATE TABLE sunrey_chain.write_intent/);
    assert.match(v024.sql, /CREATE TABLE sunrey_chain.operation/);
    assert.match(v024.sql, /CREATE TABLE sunrey_chain.receipt/);
    assert.match(v024.sql, /CREATE TABLE sunrey_chain.reconciliation/);
    assert.match(v024.sql, /network_mode TEXT NOT NULL CHECK \(network_mode = 'SIMULATION'\)/);
    assert.match(v024.sql, /GRANT USAGE ON SCHEMA sunrey_chain TO customer_app/);
    assert.equal(/CREATE TABLE sunrey_chain\.journal/i.test(v024.sql), false);
    assert.equal(/private_key TEXT|raw_pdv|plaintext_payload/i.test(v024.sql), false);
  });

  it('customer V023 persists information-market metadata without raw PDV or a second ledger', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'customer'));
    const v023 = files.find((file) => file.version === 23);
    assert.ok(v023);
    assert.equal(v023.filename, 'V023__information_market.sql');
    assert.match(v023.sql, /CREATE SCHEMA IF NOT EXISTS information_market/);
    assert.match(v023.sql, /CREATE TABLE information_market.request/);
    assert.match(v023.sql, /CREATE TABLE information_market.contribution/);
    assert.match(v023.sql, /raw_data_included BOOLEAN NOT NULL CHECK \(raw_data_included = FALSE\)/);
    assert.match(v023.sql, /GRANT USAGE ON SCHEMA information_market TO customer_app/);
    assert.equal(/CREATE TABLE information_market\.journal/i.test(v023.sql), false);
    assert.equal(/plaintext|vault_payload|decrypted/i.test(v023.sql), false);
  });

  it('ledger V005 widens journal asset columns for digital-asset identifiers', () => {
    const files = listMigrationFiles(migrationsRoot(REPO_ROOT, 'ledger'));
    const v005 = files.find((file) => file.version === 5);
    assert.ok(v005);
    assert.equal(v005.filename, 'V005__digital_asset_journals.sql');
    assert.match(v005.sql, /ALTER TABLE ledger\.ledger_account/);
    assert.match(v005.sql, /ALTER TABLE ledger\.journal/);
    assert.match(v005.sql, /ALTER TABLE ledger\.posting/);
    assert.match(v005.sql, /TYPE TEXT/);
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
