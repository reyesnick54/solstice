-- V046 Internal Alpha consumer exchange durable state.
-- Application workflow metadata only: not a ledger, not chain authority, not live trading.

CREATE TABLE sunrey_exchange.consumer_alpha_state (
  customer_id TEXT NOT NULL,
  lifecycle_mode TEXT NOT NULL DEFAULT 'READY',
  body_canonical TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0) DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  production_active BOOLEAN NOT NULL CHECK (production_active = FALSE) DEFAULT FALSE,
  live_trading_enabled BOOLEAN NOT NULL CHECK (live_trading_enabled = FALSE) DEFAULT FALSE,
  not_a_ledger BOOLEAN NOT NULL CHECK (not_a_ledger = TRUE) DEFAULT TRUE,
  PRIMARY KEY (customer_id, lifecycle_mode)
);

CREATE INDEX consumer_alpha_state_updated_idx
  ON sunrey_exchange.consumer_alpha_state (updated_at DESC, customer_id);

CREATE TABLE sunrey_exchange.consumer_alpha_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('ORDER', 'DEPOSIT', 'WITHDRAWAL', 'SETTLEMENT')),
  resource_id TEXT NOT NULL,
  response_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  production_active BOOLEAN NOT NULL CHECK (production_active = FALSE) DEFAULT FALSE,
  live_trading_enabled BOOLEAN NOT NULL CHECK (live_trading_enabled = FALSE) DEFAULT FALSE,
  not_a_ledger BOOLEAN NOT NULL CHECK (not_a_ledger = TRUE) DEFAULT TRUE
);

CREATE INDEX consumer_alpha_idempotency_customer_idx
  ON sunrey_exchange.consumer_alpha_idempotency (customer_id, resource_type, created_at DESC);

REVOKE ALL ON TABLE sunrey_exchange.consumer_alpha_state FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE sunrey_exchange.consumer_alpha_state TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE sunrey_exchange.consumer_alpha_state FROM customer_app;

REVOKE ALL ON TABLE sunrey_exchange.consumer_alpha_idempotency FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE sunrey_exchange.consumer_alpha_idempotency TO customer_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE sunrey_exchange.consumer_alpha_idempotency FROM customer_app;
