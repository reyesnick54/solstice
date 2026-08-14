-- V004 payments / FX simulation records.
-- Account coordinates are stored as a hash plus a display hint only.
-- Raw IBAN, ABA, or account numbers must never appear in these tables.

CREATE SCHEMA IF NOT EXISTS payments;

CREATE TABLE payments.beneficiary (
  beneficiary_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('PERSON', 'BUSINESS')),
  destination_country CHAR(2) NOT NULL,
  currency CHAR(3) NOT NULL,
  legal_name TEXT NOT NULL,
  coordinate_scheme TEXT NOT NULL,
  coordinate_ref TEXT NOT NULL,
  display_hint TEXT NOT NULL,
  screening_status TEXT NOT NULL CHECK (
    screening_status IN ('NOT_SCREENED', 'CLEAR', 'PEP', 'SANCTIONED', 'FRAUD')
  ),
  screening_ref TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'REVIEW', 'BLOCKED', 'DISABLED')),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE payments.fx_quote (
  quote_id TEXT PRIMARY KEY,
  base_currency CHAR(3) NOT NULL,
  quote_currency CHAR(3) NOT NULL,
  source_minor_units BIGINT NOT NULL,
  destination_minor_units BIGINT NOT NULL,
  market_numerator BIGINT NOT NULL,
  market_denominator BIGINT NOT NULL,
  provider_numerator BIGINT NOT NULL,
  provider_denominator BIGINT NOT NULL,
  customer_numerator BIGINT NOT NULL,
  customer_denominator BIGINT NOT NULL,
  fee_minor_units BIGINT NOT NULL,
  amount_debited_minor_units BIGINT NOT NULL,
  amount_credited_minor_units BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  rate_source TEXT NOT NULL,
  pricing_version TEXT NOT NULL,
  corridor_id TEXT NOT NULL,
  legal_entity_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ACCEPTED', 'EXPIRED'))
);

CREATE TABLE payments.payment_order (
  payment_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  source_account_id TEXT NOT NULL,
  beneficiary_id TEXT NOT NULL,
  source_currency CHAR(3) NOT NULL,
  destination_currency CHAR(3) NOT NULL,
  source_minor_units BIGINT NOT NULL,
  destination_minor_units BIGINT NOT NULL,
  fee_minor_units BIGINT NOT NULL,
  amount_debited_minor_units BIGINT NOT NULL,
  quote_id TEXT NOT NULL,
  purpose_reference TEXT NOT NULL,
  corridor_id TEXT NOT NULL,
  route_id TEXT,
  hold_id TEXT,
  settlement_ref TEXT,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  journal_ids TEXT[] NOT NULL,
  evidence_ids TEXT[] NOT NULL
);

CREATE TABLE payments.reconciliation (
  payment_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('MATCHED', 'INVESTIGATION_REQUIRED')),
  mismatches TEXT[] NOT NULL,
  internal_journal_ids TEXT[] NOT NULL,
  provider_settlement_ref TEXT
);

REVOKE ALL ON TABLE payments.beneficiary FROM PUBLIC;
REVOKE ALL ON TABLE payments.fx_quote FROM PUBLIC;
REVOKE ALL ON TABLE payments.payment_order FROM PUBLIC;
REVOKE ALL ON TABLE payments.reconciliation FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE payments.beneficiary TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.fx_quote TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.payment_order TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.reconciliation TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE payments.beneficiary FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE payments.fx_quote FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE payments.payment_order FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE payments.reconciliation FROM customer_app;
