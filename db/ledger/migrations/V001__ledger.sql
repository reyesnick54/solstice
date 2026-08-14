-- V001 ledger: accounts, journals, postings, control-plane audit, domain events.
-- Journals and postings are append-only. Corrections are compensating INSERT rows.
-- There is no account.balance column. Balances are derived from postings.

CREATE SCHEMA IF NOT EXISTS ledger;

CREATE TABLE ledger.product (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_class TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  legal_entity_id TEXT NOT NULL,
  jurisdiction CHAR(2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RETIRED'))
);

CREATE TABLE ledger.ledger_account (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_class TEXT NOT NULL CHECK (
    account_class IN (
      'DEMAND_DEPOSIT',
      'SAVINGS_DEPOSIT',
      'TIME_DEPOSIT',
      'BROKERAGE_CASH',
      'SECURITIES',
      'RETIREMENT',
      'DIGITAL_ASSET_CUSTODY',
      'STABLECOIN_CUSTODY',
      'REWARDS',
      'PENDING_SETTLEMENT',
      'CLASS_BRIDGE',
      'SIMULATED_FUNDING_SOURCE',
      'CORPORATE_OPERATING'
    )
  ),
  currency CHAR(3) NOT NULL,
  owner_id TEXT,
  fund_ownership TEXT NOT NULL CHECK (
    fund_ownership IN ('CUSTOMER', 'CORPORATE', 'SIMULATION', 'SYSTEM')
  )
);

-- Customer-facing account identity. Deliberately no balance column.
CREATE TABLE ledger.account (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  account_class TEXT NOT NULL CHECK (
    account_class IN (
      'DEMAND_DEPOSIT',
      'SAVINGS_DEPOSIT',
      'TIME_DEPOSIT',
      'BROKERAGE_CASH',
      'SECURITIES',
      'RETIREMENT',
      'DIGITAL_ASSET_CUSTODY',
      'STABLECOIN_CUSTODY',
      'REWARDS',
      'PENDING_SETTLEMENT',
      'CLASS_BRIDGE',
      'SIMULATED_FUNDING_SOURCE',
      'CORPORATE_OPERATING'
    )
  ),
  product_id TEXT NOT NULL,
  legal_entity_id TEXT NOT NULL,
  jurisdiction CHAR(2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING_OPEN', 'OPEN', 'FROZEN', 'CLOSED')),
  opened_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 0)
);

CREATE TABLE ledger.action_intent (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  action_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  payload_canonical JSONB NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT
);

CREATE UNIQUE INDEX action_intent_idempotency_key ON ledger.action_intent (idempotency_key);

-- Issuance audit. HMAC signing material is never stored.
CREATE TABLE ledger.execution_authority_record (
  authority_id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  account_id TEXT NOT NULL,
  intent_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  amount_minor_units NUMERIC(38, 0) CHECK (amount_minor_units IS NULL OR amount_minor_units >= 0),
  amount_currency CHAR(3),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  signature_sha256 CHAR(64) NOT NULL
);

CREATE TABLE ledger.account_open_outcome (
  intent_id TEXT PRIMARY KEY,
  outcome TEXT NOT NULL CHECK (outcome IN ('OPENED', 'KERNEL_REFUSED', 'REJECTED')),
  account_id TEXT,
  decision_status TEXT NOT NULL,
  evidence_record_id TEXT NOT NULL,
  code TEXT,
  message TEXT,
  recorded_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE ledger.journal (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  execution_authority_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  asset CHAR(3) NOT NULL,
  class_bridge_name TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT journal_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE TABLE ledger.posting (
  id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL REFERENCES ledger.journal (id),
  account_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  currency CHAR(3) NOT NULL,
  minor_units NUMERIC(38, 0) NOT NULL CHECK (minor_units > 0),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  CONSTRAINT posting_journal_ordinal UNIQUE (journal_id, ordinal)
);

CREATE TABLE ledger.domain_event (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  occurred_at TIMESTAMPTZ NOT NULL,
  payload_canonical JSONB NOT NULL
);

CREATE FUNCTION ledger.forbid_financial_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger financial records are append-only; post a compensating entry'
    USING ERRCODE = 'read_only_sql_transaction';
END;
$$;

CREATE TRIGGER journal_append_only
  BEFORE UPDATE OR DELETE ON ledger.journal
  FOR EACH ROW EXECUTE FUNCTION ledger.forbid_financial_mutation();

CREATE TRIGGER posting_append_only
  BEFORE UPDATE OR DELETE ON ledger.posting
  FOR EACH ROW EXECUTE FUNCTION ledger.forbid_financial_mutation();

CREATE TRIGGER action_intent_append_only
  BEFORE UPDATE OR DELETE ON ledger.action_intent
  FOR EACH ROW EXECUTE FUNCTION ledger.forbid_financial_mutation();

CREATE TRIGGER execution_authority_record_append_only
  BEFORE UPDATE OR DELETE ON ledger.execution_authority_record
  FOR EACH ROW EXECUTE FUNCTION ledger.forbid_financial_mutation();

CREATE TRIGGER domain_event_append_only
  BEFORE UPDATE OR DELETE ON ledger.domain_event
  FOR EACH ROW EXECUTE FUNCTION ledger.forbid_financial_mutation();

-- Deferred so a balanced multi-row INSERT can commit. Unbalanced journals are rejected.
-- This function never rewrites amounts.
CREATE FUNCTION ledger.assert_journal_balanced()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  debit_sum NUMERIC(38, 0);
  credit_sum NUMERIC(38, 0);
  posting_count INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN minor_units ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN minor_units ELSE 0 END), 0),
    COUNT(*)
  INTO debit_sum, credit_sum, posting_count
  FROM ledger.posting
  WHERE journal_id = NEW.journal_id;

  IF posting_count < 2 THEN
    RAISE EXCEPTION 'journal % must have at least two postings'
      , NEW.journal_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF debit_sum <> credit_sum THEN
    RAISE EXCEPTION 'journal % is unbalanced: debits % <> credits %'
      , NEW.journal_id, debit_sum, credit_sum
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER posting_journal_balanced
  AFTER INSERT ON ledger.posting
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION ledger.assert_journal_balanced();

CREATE FUNCTION ledger.assert_no_commingling()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ownerships TEXT[];
  missing INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO missing
  FROM ledger.posting p
  LEFT JOIN ledger.ledger_account la ON la.id = p.account_id
  WHERE p.journal_id = NEW.journal_id
    AND la.id IS NULL;

  IF missing > 0 THEN
    RAISE EXCEPTION 'journal % references an unknown ledger account'
      , NEW.journal_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT ARRAY_AGG(DISTINCT la.fund_ownership)
  INTO ownerships
  FROM ledger.posting p
  JOIN ledger.ledger_account la ON la.id = p.account_id
  WHERE p.journal_id = NEW.journal_id;

  IF ownerships @> ARRAY['CUSTOMER']::TEXT[] AND ownerships @> ARRAY['CORPORATE']::TEXT[] THEN
    RAISE EXCEPTION 'journal % commingles CUSTOMER and CORPORATE funds'
      , NEW.journal_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER posting_no_commingling
  AFTER INSERT ON ledger.posting
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION ledger.assert_no_commingling();

REVOKE ALL ON SCHEMA ledger FROM PUBLIC;
GRANT USAGE ON SCHEMA ledger TO ledger_writer;
GRANT USAGE ON SCHEMA ledger TO ledger_reader;

REVOKE ALL ON TABLE ledger.journal FROM PUBLIC;
REVOKE ALL ON TABLE ledger.posting FROM PUBLIC;
REVOKE ALL ON TABLE ledger.action_intent FROM PUBLIC;
REVOKE ALL ON TABLE ledger.execution_authority_record FROM PUBLIC;
REVOKE ALL ON TABLE ledger.domain_event FROM PUBLIC;
REVOKE ALL ON TABLE ledger.account FROM PUBLIC;
REVOKE ALL ON TABLE ledger.ledger_account FROM PUBLIC;
REVOKE ALL ON TABLE ledger.account_open_outcome FROM PUBLIC;
REVOKE ALL ON TABLE ledger.product FROM PUBLIC;

GRANT SELECT, INSERT ON TABLE ledger.journal TO ledger_writer;
GRANT SELECT, INSERT ON TABLE ledger.posting TO ledger_writer;
GRANT SELECT, INSERT ON TABLE ledger.action_intent TO ledger_writer;
GRANT SELECT, INSERT ON TABLE ledger.execution_authority_record TO ledger_writer;
GRANT SELECT, INSERT ON TABLE ledger.domain_event TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.account TO ledger_writer;
GRANT SELECT, INSERT ON TABLE ledger.ledger_account TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.account_open_outcome TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.product TO ledger_writer;
GRANT USAGE, SELECT ON SEQUENCE ledger.domain_event_id_seq TO ledger_writer;

GRANT SELECT ON ALL TABLES IN SCHEMA ledger TO ledger_reader;
