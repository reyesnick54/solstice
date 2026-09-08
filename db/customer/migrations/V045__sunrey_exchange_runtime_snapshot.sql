-- V045 exact restart snapshot for the canonical SunRey Exchange core.
-- This is application metadata only: not a financial ledger, not chain state,
-- not a balance authority, and not permission to activate live trading.

CREATE TABLE sunrey_exchange.runtime_snapshot (
  snapshot_revision BIGINT PRIMARY KEY CHECK (snapshot_revision > 0),
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  production_active BOOLEAN NOT NULL CHECK (production_active = FALSE) DEFAULT FALSE,
  live_trading_enabled BOOLEAN NOT NULL CHECK (live_trading_enabled = FALSE) DEFAULT FALSE,
  not_a_ledger BOOLEAN NOT NULL CHECK (not_a_ledger = TRUE) DEFAULT TRUE
);

CREATE INDEX sunrey_exchange_runtime_snapshot_created_idx
  ON sunrey_exchange.runtime_snapshot (created_at DESC, snapshot_revision DESC);

REVOKE ALL ON TABLE sunrey_exchange.runtime_snapshot FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE sunrey_exchange.runtime_snapshot TO customer_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE sunrey_exchange.runtime_snapshot FROM customer_app;
