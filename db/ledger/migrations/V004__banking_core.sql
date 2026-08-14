-- V004 banking core: holds, pending settlement, fees, statements,
-- reconciliation, and synthetic external coordinates.
-- Journals and postings remain the authoritative financial records.
-- There is still no account.balance column.

CREATE TABLE ledger.funds_hold (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  amount_minor_units NUMERIC(38, 0) NOT NULL CHECK (amount_minor_units > 0),
  purpose TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'CAPTURED', 'RELEASED', 'EXPIRED', 'CANCELLED')),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  capture_journal_id TEXT,
  epoch INTEGER NOT NULL CHECK (epoch >= 0),
  CONSTRAINT funds_hold_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX funds_hold_account_state ON ledger.funds_hold (account_id, state);

CREATE TABLE ledger.pending_settlement (
  id TEXT PRIMARY KEY,
  source_account_id TEXT NOT NULL,
  pending_account_id TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  amount_minor_units NUMERIC(38, 0) NOT NULL CHECK (amount_minor_units > 0),
  state TEXT NOT NULL CHECK (state IN ('INITIATED', 'PENDING', 'SETTLED', 'RETURNED', 'REVERSED')),
  initiate_journal_id TEXT,
  settle_journal_id TEXT,
  return_journal_id TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT pending_settlement_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE TABLE ledger.fee_assessment (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  fee_type TEXT NOT NULL CHECK (fee_type IN ('FIXED', 'BASIS_POINTS')),
  currency CHAR(3) NOT NULL,
  assessed_minor_units NUMERIC(38, 0) NOT NULL CHECK (assessed_minor_units > 0),
  fixed_minor_units NUMERIC(38, 0),
  basis_points_numerator NUMERIC(38, 0),
  basis_points_denominator NUMERIC(38, 0),
  journal_id TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fee_assessment_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE TABLE ledger.reversal_record (
  id TEXT PRIMARY KEY,
  original_journal_id TEXT NOT NULL,
  compensating_journal_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT reversal_record_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE TABLE ledger.interest_accrual (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  rate_version_id TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  principal_minor_units NUMERIC(38, 0) NOT NULL,
  accrued_minor_units NUMERIC(38, 0) NOT NULL,
  rounding TEXT NOT NULL,
  journal_id TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT interest_accrual_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE TABLE ledger.customer_statement (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  opening_minor_units NUMERIC(38, 0) NOT NULL,
  closing_minor_units NUMERIC(38, 0) NOT NULL,
  credits_minor_units NUMERIC(38, 0) NOT NULL,
  debits_minor_units NUMERIC(38, 0) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE ledger.reconciliation_item (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  internal_minor_units NUMERIC(38, 0) NOT NULL,
  external_minor_units NUMERIC(38, 0) NOT NULL,
  difference_minor_units NUMERIC(38, 0) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('MATCHED', 'PENDING', 'MISMATCH', 'INVESTIGATION_REQUIRED')),
  external_statement_ref TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE ledger.account_coordinate (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  scheme TEXT NOT NULL CHECK (
    scheme IN ('SIMULATED_DOMESTIC', 'SIMULATED_ROUTING', 'SIMULATED_IBAN', 'SIMULATED_BIC')
  ),
  value TEXT NOT NULL,
  synthetic BOOLEAN NOT NULL CHECK (synthetic = TRUE),
  live_assignable BOOLEAN NOT NULL CHECK (live_assignable = FALSE)
);

CREATE TABLE ledger.product_metadata (
  product_id TEXT PRIMARY KEY,
  insurance_claim TEXT NOT NULL CHECK (insurance_claim IN ('NONE', 'DECLARED_INSURED')),
  simulation_label TEXT NOT NULL
);

REVOKE ALL ON TABLE ledger.funds_hold FROM PUBLIC;
REVOKE ALL ON TABLE ledger.pending_settlement FROM PUBLIC;
REVOKE ALL ON TABLE ledger.fee_assessment FROM PUBLIC;
REVOKE ALL ON TABLE ledger.reversal_record FROM PUBLIC;
REVOKE ALL ON TABLE ledger.interest_accrual FROM PUBLIC;
REVOKE ALL ON TABLE ledger.customer_statement FROM PUBLIC;
REVOKE ALL ON TABLE ledger.reconciliation_item FROM PUBLIC;
REVOKE ALL ON TABLE ledger.account_coordinate FROM PUBLIC;
REVOKE ALL ON TABLE ledger.product_metadata FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE ledger.funds_hold TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.pending_settlement TO ledger_writer;
GRANT SELECT, INSERT ON TABLE ledger.fee_assessment TO ledger_writer;
GRANT SELECT, INSERT ON TABLE ledger.reversal_record TO ledger_writer;
GRANT SELECT, INSERT ON TABLE ledger.interest_accrual TO ledger_writer;
GRANT SELECT, INSERT ON TABLE ledger.customer_statement TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.reconciliation_item TO ledger_writer;
GRANT SELECT, INSERT ON TABLE ledger.account_coordinate TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.product_metadata TO ledger_writer;

GRANT SELECT ON TABLE ledger.funds_hold TO ledger_reader;
GRANT SELECT ON TABLE ledger.pending_settlement TO ledger_reader;
GRANT SELECT ON TABLE ledger.fee_assessment TO ledger_reader;
GRANT SELECT ON TABLE ledger.reversal_record TO ledger_reader;
GRANT SELECT ON TABLE ledger.interest_accrual TO ledger_reader;
GRANT SELECT ON TABLE ledger.customer_statement TO ledger_reader;
GRANT SELECT ON TABLE ledger.reconciliation_item TO ledger_reader;
GRANT SELECT ON TABLE ledger.account_coordinate TO ledger_reader;
GRANT SELECT ON TABLE ledger.product_metadata TO ledger_reader;
