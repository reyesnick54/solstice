-- V030 Phase B Platform API idempotency and rate-limit stores.
-- Application HTTP runtime state only. Not a second ledger, mint, or
-- Application HTTP runtime state only. Not a second ledger, mint, or
-- Execution Authority. Production remains inactive.

CREATE SCHEMA IF NOT EXISTS platform_api;

CREATE TABLE platform_api.idempotency_record (
  scope_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('IN_PROGRESS', 'COMPLETED')),
  status_code INTEGER,
  response_body TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope_key, idempotency_key)
);

CREATE INDEX platform_api_idempotency_expiry
  ON platform_api.idempotency_record (expires_at);

CREATE TABLE platform_api.rate_limit_bucket (
  bucket_key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX platform_api_rate_limit_expiry
  ON platform_api.rate_limit_bucket (expires_at);

GRANT USAGE ON SCHEMA platform_api TO customer_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform_api TO customer_app;
