-- V009 customer financial account product overlay and restrictions.
-- Ledger journals remain the accounting authority. This table is not a balance.

CREATE TABLE ledger.account_restriction (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  code TEXT NOT NULL CHECK (code IN (
    'DEBIT_BLOCKED',
    'CREDIT_BLOCKED',
    'WITHDRAWAL_BLOCKED',
    'TRANSFER_BLOCKED',
    'TRADING_BLOCKED',
    'CARD_BLOCKED',
    'COMPLIANCE_REVIEW'
  )),
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'RELEASED')),
  reason TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  applied_by_actor_id TEXT NOT NULL
);

CREATE INDEX account_restriction_account_state ON ledger.account_restriction (account_id, state);

CREATE TABLE ledger.account_product_overlay (
  account_id TEXT PRIMARY KEY,
  lifecycle TEXT CHECK (lifecycle IS NULL OR lifecycle IN (
    'PENDING',
    'ACTIVE',
    'RESTRICTED',
    'FROZEN',
    'CLOSING',
    'CLOSED'
  )),
  closed_at TIMESTAMPTZ,
  provider_id TEXT,
  provider_external_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

REVOKE ALL ON TABLE ledger.account_restriction FROM PUBLIC;
REVOKE ALL ON TABLE ledger.account_product_overlay FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.account_restriction TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.account_product_overlay TO ledger_writer;
GRANT SELECT ON TABLE ledger.account_restriction TO ledger_reader;
GRANT SELECT ON TABLE ledger.account_product_overlay TO ledger_reader;
