-- V008 customer financial account product overlay and restrictions.
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
