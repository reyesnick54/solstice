-- V064 HELIOS M05 — durable capital market bar storage for equity/index historical ingestion.
-- Reference data only; not Execution Authority.

CREATE TABLE growth.helios_market_bar (
  bar_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  canonical_instrument_id TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  provenance_hash TEXT NOT NULL,
  duplicate_detected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_market_bar_id_nonempty CHECK (char_length(bar_id) > 0),
  CONSTRAINT helios_market_bar_timeframe CHECK (timeframe IN ('1m', '5m', '15m', '1h', '1d')),
  CONSTRAINT helios_market_bar_no_ea CHECK (body_canonical NOT LIKE '%ExecutionAuthority%')
);

CREATE UNIQUE INDEX helios_market_bar_identity_idx
  ON growth.helios_market_bar (provider_id, canonical_instrument_id, timeframe, period_start);

CREATE INDEX helios_market_bar_instrument_timeframe_idx
  ON growth.helios_market_bar (canonical_instrument_id, timeframe, period_start DESC);

GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_market_bar TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_market_bar FROM customer_app;
