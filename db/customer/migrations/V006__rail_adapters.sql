-- V006 simulated rail adapter records.
-- Provider payloads, credentials, and raw account coordinates must never
-- appear in these tables. Store opaque references and payload hashes only.

CREATE TABLE payments.rail_submission (
  rail_submission_id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  rail TEXT NOT NULL,
  amount_minor_units BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  source_reference TEXT NOT NULL,
  destination_reference TEXT NOT NULL,
  beneficiary_reference TEXT NOT NULL,
  purpose_reference TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  correlation_id TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  settlement_class TEXT NOT NULL,
  status TEXT NOT NULL,
  execution_unknown BOOLEAN NOT NULL DEFAULT FALSE,
  provider_payment_id TEXT,
  rail_reference TEXT,
  settlement_reference TEXT,
  return_reference TEXT,
  trace_reference TEXT,
  rejection_class TEXT
);

CREATE TABLE payments.rail_status_history (
  history_id BIGSERIAL PRIMARY KEY,
  rail_submission_id TEXT NOT NULL REFERENCES payments.rail_submission (rail_submission_id),
  status TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  payload_hash TEXT
);

CREATE TABLE payments.provider_callback (
  provider_event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROCESSED', 'DEAD_LETTER'))
);

CREATE TABLE payments.provider_health (
  provider TEXT PRIMARY KEY,
  health TEXT NOT NULL CHECK (health IN ('AVAILABLE', 'DEGRADED', 'UNAVAILABLE', 'MAINTENANCE')),
  consecutive_failures INTEGER NOT NULL,
  last_failure_kind TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE payments.settlement_report (
  report_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL,
  currency CHAR(3) NOT NULL,
  fees_minor_units BIGINT NOT NULL,
  gross_minor_units BIGINT NOT NULL,
  net_minor_units BIGINT NOT NULL,
  external_reference TEXT NOT NULL,
  integrity_hash TEXT NOT NULL
);

CREATE TABLE payments.rail_return (
  return_reference TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  original_submission_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  amount_minor_units BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE payments.inbound_rail_payment (
  inbound_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  rail TEXT NOT NULL,
  amount_minor_units BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  destination_account_id TEXT,
  destination_customer_id TEXT,
  destination_reference TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  purpose_reference TEXT NOT NULL,
  status TEXT NOT NULL,
  screening_ref TEXT,
  journal_ids TEXT[] NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  payload_hash TEXT NOT NULL
);

CREATE TABLE payments.rail_reconciliation (
  payment_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  mismatches TEXT[] NOT NULL,
  internal_journal_ids TEXT[] NOT NULL,
  provider_settlement_ref TEXT,
  rail_submission_id TEXT
);

REVOKE ALL ON TABLE payments.rail_submission FROM PUBLIC;
REVOKE ALL ON TABLE payments.rail_status_history FROM PUBLIC;
REVOKE ALL ON TABLE payments.provider_callback FROM PUBLIC;
REVOKE ALL ON TABLE payments.provider_health FROM PUBLIC;
REVOKE ALL ON TABLE payments.settlement_report FROM PUBLIC;
REVOKE ALL ON TABLE payments.rail_return FROM PUBLIC;
REVOKE ALL ON TABLE payments.inbound_rail_payment FROM PUBLIC;
REVOKE ALL ON TABLE payments.rail_reconciliation FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE payments.rail_submission TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.rail_status_history TO customer_app;
GRANT USAGE, SELECT ON SEQUENCE payments.rail_status_history_history_id_seq TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.provider_callback TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.provider_health TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.settlement_report TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.rail_return TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.inbound_rail_payment TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.rail_reconciliation TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE payments.rail_submission FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE payments.rail_status_history FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE payments.provider_callback FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE payments.provider_health FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE payments.settlement_report FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE payments.rail_return FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE payments.inbound_rail_payment FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE payments.rail_reconciliation FROM customer_app;
