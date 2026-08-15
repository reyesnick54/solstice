-- V010 Treasury liquidity, reservations, routing, and operational controls.
-- Not a second ledger. Customer balances remain in the canonical ledger.
-- Simulation engineering thresholds are not regulatory capital requirements.

CREATE SCHEMA IF NOT EXISTS treasury;

CREATE TABLE treasury.account (
  treasury_account_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'PROVIDER_SETTLEMENT',
    'CORRESPONDENT',
    'FX_CLEARING',
    'CORRIDOR_PREFUNDING',
    'LIQUIDITY',
    'CARD_SETTLEMENT_REF'
  )),
  ownership TEXT NOT NULL CHECK (ownership IN (
    'TREASURY',
    'CORPORATE',
    'PROVIDER',
    'SIMULATION_SYSTEM'
  )),
  legal_entity_id TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  country CHAR(2) NOT NULL,
  provider TEXT NOT NULL,
  rail TEXT NOT NULL,
  corridor_id TEXT,
  ledger_account_id TEXT,
  card_settlement_ref TEXT,
  CONSTRAINT treasury_account_id_prefix CHECK (treasury_account_id LIKE 'ta_%'),
  CONSTRAINT treasury_no_customer_ownership CHECK (ownership <> 'CUSTOMER')
);

CREATE TABLE treasury.position (
  treasury_account_id TEXT PRIMARY KEY REFERENCES treasury.account (treasury_account_id),
  currency CHAR(3) NOT NULL,
  settled_minor BIGINT NOT NULL CHECK (settled_minor >= 0),
  available_minor BIGINT NOT NULL CHECK (available_minor >= 0),
  reserved_minor BIGINT NOT NULL CHECK (reserved_minor >= 0),
  pending_inbound_minor BIGINT NOT NULL CHECK (pending_inbound_minor >= 0),
  pending_outbound_minor BIGINT NOT NULL CHECK (pending_outbound_minor >= 0),
  operational_buffer_minor BIGINT NOT NULL CHECK (operational_buffer_minor >= 0),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE treasury.reservation (
  reservation_id TEXT PRIMARY KEY,
  treasury_account_id TEXT NOT NULL REFERENCES treasury.account (treasury_account_id),
  payment_id TEXT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED', 'CANCELLED')),
  idempotency_key TEXT NOT NULL UNIQUE,
  authority_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  CONSTRAINT treasury_reservation_id_prefix CHECK (reservation_id LIKE 'tres_%')
);

CREATE TABLE treasury.kill_switch (
  kill_switch_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  target TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE treasury.route_decision (
  payment_id TEXT PRIMARY KEY,
  routing_version TEXT NOT NULL,
  selected_route_id TEXT,
  explanation_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE treasury.concentration_snapshot (
  snapshot_id TEXT PRIMARY KEY,
  dimension TEXT NOT NULL,
  key TEXT NOT NULL,
  exposure_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  threshold_minor BIGINT NOT NULL,
  ratio_bps BIGINT NOT NULL,
  threshold_note TEXT NOT NULL CHECK (threshold_note LIKE 'RESEARCH_REQUIRED%'),
  captured_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE treasury.settlement_exposure (
  exposure_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('NORMAL', 'ELEVATED', 'RESTRICTED', 'HALTED')),
  payment_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE treasury.fx_inventory (
  currency CHAR(3) PRIMARY KEY,
  owned_minor BIGINT NOT NULL CHECK (owned_minor >= 0),
  reserved_minor BIGINT NOT NULL CHECK (reserved_minor >= 0),
  unsettled_minor BIGINT NOT NULL CHECK (unsettled_minor >= 0),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE treasury.rebalance_proposal (
  proposal_id TEXT PRIMARY KEY,
  source_treasury_account_id TEXT NOT NULL,
  destination_treasury_account_id TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL,
  narrative TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PROPOSED', 'REFUSED', 'EXECUTED', 'CANCELLED')),
  executable BOOLEAN NOT NULL,
  authority_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE treasury.forecast (
  forecast_id TEXT PRIMARY KEY,
  horizon_ms BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  body_canonical TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE treasury.reconciliation (
  reconciliation_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'MATCHED',
    'PENDING',
    'MISMATCH',
    'MISSING_INTERNAL',
    'MISSING_EXTERNAL',
    'INVESTIGATION_REQUIRED'
  )),
  mismatches TEXT[] NOT NULL,
  ledger_journal_ids TEXT[] NOT NULL,
  payment_id TEXT,
  reservation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

REVOKE ALL ON SCHEMA treasury FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA treasury FROM PUBLIC;

GRANT USAGE ON SCHEMA treasury TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA treasury TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA treasury FROM customer_app;
