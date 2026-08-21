-- V032 Phase C treasury financial control: provider balances, settlement
-- records, reconciliation runs/breaks, suspense, daily close, alerts.
-- Not a second ledger. Externally reported balances are never applied
-- automatically to Ledger balances.

ALTER TABLE treasury.account DROP CONSTRAINT IF EXISTS account_kind_check;
ALTER TABLE treasury.account ADD CONSTRAINT account_kind_check CHECK (kind IN (
  'PROVIDER_SETTLEMENT',
  'CORRESPONDENT',
  'FX_CLEARING',
  'CORRIDOR_PREFUNDING',
  'LIQUIDITY',
  'CARD_SETTLEMENT_REF',
  'OPERATING',
  'CUSTOMER_FUNDS',
  'SETTLEMENT',
  'CLEARING',
  'PROVIDER_PREFUNDING',
  'FX_LIQUIDITY',
  'CARD_SETTLEMENT',
  'FEE',
  'SUSPENSE'
));

CREATE TABLE treasury.provider_balance (
  provider_balance_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_account TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  reported_minor BIGINT NOT NULL,
  available_minor BIGINT,
  reported_at TIMESTAMPTZ NOT NULL,
  statement_ref TEXT,
  evidence_source TEXT NOT NULL
);

CREATE TABLE treasury.settlement_record (
  settlement_id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  provider TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  gross_minor BIGINT NOT NULL,
  fees_minor BIGINT NOT NULL,
  net_minor BIGINT NOT NULL,
  expected_date TIMESTAMPTZ NOT NULL,
  actual_date TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('EXPECTED', 'SUBMITTED', 'SETTLED', 'FAILED', 'OVERDUE', 'PARTIAL')),
  provider_references TEXT[] NOT NULL,
  ledger_references TEXT[] NOT NULL,
  CONSTRAINT treasury_settlement_net CHECK (net_minor = gross_minor - fees_minor)
);

CREATE TABLE treasury.reconciliation_run (
  run_id TEXT PRIMARY KEY,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL,
  source_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  matched_count INTEGER NOT NULL,
  break_count INTEGER NOT NULL,
  break_ids TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX treasury_reconciliation_run_input
  ON treasury.reconciliation_run (provider, input_hash);

CREATE TABLE treasury.reconciliation_break (
  break_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES treasury.reconciliation_run (run_id),
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  domain TEXT NOT NULL,
  amount_minor BIGINT,
  currency CHAR(3),
  provider TEXT NOT NULL,
  internal_references TEXT[] NOT NULL,
  external_references TEXT[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'OPEN',
    'INVESTIGATING',
    'RESOLVED',
    'ACCEPTED_TIMING_DIFFERENCE',
    'ESCALATED'
  )),
  owner TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolution_evidence TEXT
);

CREATE TABLE treasury.suspense_item (
  suspense_id TEXT PRIMARY KEY,
  treasury_account_id TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  amount_minor BIGINT NOT NULL,
  reason TEXT NOT NULL,
  domain TEXT NOT NULL,
  provider TEXT,
  internal_references TEXT[] NOT NULL,
  external_references TEXT[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'REVIEW_REQUIRED', 'ATTRIBUTED', 'RELEASED')),
  created_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE treasury.daily_close (
  close_id TEXT PRIMARY KEY,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  legal_sufficiency TEXT NOT NULL CHECK (legal_sufficiency = 'NOT_A_REGULATORY_REPORT'),
  body_canonical TEXT NOT NULL
);

CREATE TABLE treasury.operational_alert (
  alert_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  domain TEXT NOT NULL,
  provider TEXT,
  currency CHAR(3),
  amount_minor BIGINT,
  message TEXT NOT NULL,
  reference_ids TEXT[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'CLEARED')),
  created_at TIMESTAMPTZ NOT NULL
);

REVOKE ALL ON TABLE treasury.provider_balance FROM PUBLIC;
REVOKE ALL ON TABLE treasury.settlement_record FROM PUBLIC;
REVOKE ALL ON TABLE treasury.reconciliation_run FROM PUBLIC;
REVOKE ALL ON TABLE treasury.reconciliation_break FROM PUBLIC;
REVOKE ALL ON TABLE treasury.suspense_item FROM PUBLIC;
REVOKE ALL ON TABLE treasury.daily_close FROM PUBLIC;
REVOKE ALL ON TABLE treasury.operational_alert FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE treasury.provider_balance TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE treasury.settlement_record TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE treasury.reconciliation_run TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE treasury.reconciliation_break TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE treasury.suspense_item TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE treasury.daily_close TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE treasury.operational_alert TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE treasury.provider_balance FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE treasury.settlement_record FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE treasury.reconciliation_run FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE treasury.reconciliation_break FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE treasury.suspense_item FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE treasury.daily_close FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE treasury.operational_alert FROM customer_app;
