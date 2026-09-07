-- V043 consumer internal payment operational metadata.
-- Canonical balances and amount authority remain in ledger journals.
-- This table exists only to make the Consumer BFF payment resource and
-- idempotency key restart-safe in the internal sandbox. It is not a ledger,
-- not a rail settlement record, and cannot enable production money movement.

CREATE TABLE payments.consumer_internal_payment (
  payment_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  source_account_id TEXT NOT NULL,
  destination_account_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  journal_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status = 'SETTLED'),
  body_canonical JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  production_money_movement BOOLEAN NOT NULL CHECK (production_money_movement = FALSE) DEFAULT FALSE,
  not_a_ledger BOOLEAN NOT NULL CHECK (not_a_ledger = TRUE) DEFAULT TRUE
);

CREATE INDEX consumer_internal_payment_customer_created_idx
  ON payments.consumer_internal_payment (customer_id, created_at DESC);

REVOKE ALL ON TABLE payments.consumer_internal_payment FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.consumer_internal_payment TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE payments.consumer_internal_payment FROM customer_app;
