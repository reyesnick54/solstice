-- V033 Phase D Prompt 1 — universal provider runtime control plane.
-- Registry, lifecycle, certification, health summary, routing, and
-- kill-switch state. Not a second ledger, mint, or Execution Authority.
-- Raw credentials are forbidden. Production remains inactive.

CREATE SCHEMA IF NOT EXISTS provider_runtime;

CREATE TABLE provider_runtime.registration (
  provider_id TEXT PRIMARY KEY,
  provider_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  capabilities TEXT[] NOT NULL,
  environment TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  enabled_jurisdictions TEXT[] NOT NULL,
  supported_currencies TEXT[] NOT NULL,
  supported_products TEXT[] NOT NULL,
  credential_secret_href TEXT,
  credential_key_version TEXT,
  credential_environment TEXT,
  webhook_adapter_id TEXT,
  webhook_environment TEXT,
  health_timeout_ms INTEGER NOT NULL,
  routing_priority INTEGER NOT NULL,
  certification_state TEXT NOT NULL,
  raw_credential_present BOOLEAN NOT NULL CHECK (raw_credential_present = FALSE),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (lifecycle_state IN (
    'DISABLED', 'SIMULATED', 'SANDBOX', 'CERTIFICATION',
    'PREPRODUCTION', 'LIMITED_LIVE', 'PRODUCTION', 'SUSPENDED'
  )),
  CHECK (environment IN ('LOCAL', 'TEST', 'SANDBOX', 'STAGING', 'PREPRODUCTION', 'PRODUCTION'))
);

CREATE TABLE provider_runtime.health_summary (
  provider_id TEXT PRIMARY KEY REFERENCES provider_runtime.registration (provider_id),
  state TEXT NOT NULL,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  latency_ms INTEGER,
  error_rate NUMERIC NOT NULL,
  consecutive_failures INTEGER NOT NULL,
  rate_limited BOOLEAN NOT NULL,
  circuit_state TEXT NOT NULL CHECK (circuit_state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE provider_runtime.certification (
  certification_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_runtime.registration (provider_id),
  adapter_version TEXT NOT NULL,
  environment TEXT NOT NULL,
  test_suite_version TEXT NOT NULL,
  test_date TIMESTAMPTZ NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('PASS', 'FAIL')),
  distinction TEXT NOT NULL CHECK (distinction IN (
    'UNTESTED', 'INTERNAL_ADAPTER_TESTED', 'EXTERNAL_PROVIDER_CERTIFIED'
  )),
  evidence_refs TEXT[] NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  unit_tests_are_not_external_certification BOOLEAN NOT NULL CHECK (unit_tests_are_not_external_certification = TRUE)
);

CREATE TABLE provider_runtime.kill_switch (
  switch_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_runtime.registration (provider_id),
  scope TEXT NOT NULL,
  target TEXT NOT NULL,
  active BOOLEAN NOT NULL,
  allow_read_only_reconciliation BOOLEAN NOT NULL,
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  frontend_exposed BOOLEAN NOT NULL CHECK (frontend_exposed = FALSE)
);

CREATE TABLE provider_runtime.routing_policy (
  provider_id TEXT PRIMARY KEY REFERENCES provider_runtime.registration (provider_id),
  routing_priority INTEGER NOT NULL,
  environment TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

GRANT USAGE ON SCHEMA provider_runtime TO customer_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA provider_runtime TO customer_app;
