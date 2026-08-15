-- V022 SunRey Coin metadata. Not a second financial ledger.
-- Journals remain in the canonical ledger. No market price, ticker, or yield.

CREATE SCHEMA IF NOT EXISTS sunrey_coin;

CREATE TABLE sunrey_coin.asset (
  asset_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  precision INTEGER NOT NULL CHECK (precision >= 0),
  asset_class TEXT NOT NULL,
  status TEXT NOT NULL,
  simulation_enabled BOOLEAN NOT NULL CHECK (simulation_enabled = TRUE),
  live_enabled BOOLEAN NOT NULL CHECK (live_enabled = FALSE),
  ticker_status TEXT NOT NULL CHECK (ticker_status = 'NOT_ASSIGNED'),
  supply_policy_id TEXT NOT NULL,
  legal_classification TEXT NOT NULL CHECK (legal_classification = 'UNCLASSIFIED_SIMULATION'),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sunrey_coin.supply_policy (
  policy_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL CHECK (version >= 1),
  legal_state TEXT NOT NULL CHECK (legal_state = 'ENGINEERING_SIMULATION'),
  issuance_enabled BOOLEAN NOT NULL,
  transfer_enabled BOOLEAN NOT NULL,
  burn_enabled BOOLEAN NOT NULL,
  simulation_only BOOLEAN NOT NULL CHECK (simulation_only = TRUE),
  per_event_limit_scaled NUMERIC(38, 0) NOT NULL,
  per_period_limit_scaled NUMERIC(38, 0) NOT NULL,
  simulation_cap_scaled NUMERIC(38, 0) NOT NULL,
  formula_ref TEXT NOT NULL,
  rounding_mode TEXT NOT NULL CHECK (rounding_mode = 'FLOOR'),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sunrey_coin.contribution_vector (
  vector_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  contribution_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  purpose_id TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  replay_key TEXT NOT NULL,
  eligibility TEXT NOT NULL,
  scaled_units NUMERIC(38, 0) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT sunrey_coin_vector_replay UNIQUE (replay_key)
);

CREATE TABLE sunrey_coin.eligibility (
  eligibility_id TEXT PRIMARY KEY,
  vector_id TEXT NOT NULL REFERENCES sunrey_coin.contribution_vector (vector_id),
  state TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sunrey_coin.proposal (
  proposal_id TEXT PRIMARY KEY,
  vector_id TEXT NOT NULL REFERENCES sunrey_coin.contribution_vector (vector_id),
  subject_id TEXT NOT NULL,
  custody_account_id TEXT NOT NULL,
  scaled_units NUMERIC(38, 0) NOT NULL,
  financial_effect BOOLEAN NOT NULL CHECK (financial_effect = FALSE),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sunrey_coin.issuance_record (
  issuance_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES sunrey_coin.proposal (proposal_id),
  journal_id TEXT NOT NULL,
  execution_authority_id TEXT NOT NULL,
  intent_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sunrey_coin.transfer_record (
  transfer_id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL,
  source_account_id TEXT NOT NULL,
  destination_account_id TEXT NOT NULL,
  scaled_units NUMERIC(38, 0) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sunrey_coin.burn_record (
  burn_id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL,
  source_account_id TEXT NOT NULL,
  scaled_units NUMERIC(38, 0) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sunrey_coin.hold (
  hold_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  scaled_units NUMERIC(38, 0) NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'CAPTURED', 'RELEASED', 'EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ
);

CREATE TABLE sunrey_coin.reconciliation_snapshot (
  snapshot_id TEXT PRIMARY KEY,
  issued_scaled NUMERIC(38, 0) NOT NULL,
  burned_scaled NUMERIC(38, 0) NOT NULL,
  holdings_scaled NUMERIC(38, 0) NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sunrey_coin.custody_book (
  account_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

REVOKE ALL ON SCHEMA sunrey_coin FROM PUBLIC;
GRANT USAGE ON SCHEMA sunrey_coin TO customer_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA sunrey_coin TO customer_app;
