-- V024 SunRey Chain metadata. Not a second ledger and not a live network.
-- Stores commitments, receipts, and reconciliation outcomes only.

CREATE SCHEMA IF NOT EXISTS sunrey_chain;

CREATE TABLE sunrey_chain.write_intent (
  intent_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  source_subsystem TEXT NOT NULL,
  source_record_reference TEXT NOT NULL,
  payload_commitment TEXT NOT NULL,
  data_class TEXT NOT NULL CHECK (data_class = 'ON_CHAIN_SAFE'),
  jurisdiction_cell TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  economic_value_movement BOOLEAN NOT NULL CHECK (economic_value_movement = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE sunrey_chain.operation (
  operation_id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL REFERENCES sunrey_chain.write_intent (intent_id),
  adapter_id TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  network_id TEXT NOT NULL,
  network_mode TEXT NOT NULL CHECK (network_mode = 'SIMULATION'),
  record_type TEXT NOT NULL,
  payload_commitment TEXT NOT NULL,
  state TEXT NOT NULL,
  transaction_id TEXT,
  receipt_id TEXT,
  confirmations INTEGER NOT NULL,
  unknown_after_broadcast BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE sunrey_chain.receipt (
  receipt_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES sunrey_chain.operation (operation_id),
  transaction_id TEXT NOT NULL,
  payload_commitment TEXT NOT NULL,
  accepted BOOLEAN NOT NULL,
  finalized BOOLEAN NOT NULL,
  reorg_observed BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  raw_data_included BOOLEAN NOT NULL CHECK (raw_data_included = FALSE),
  private_key_included BOOLEAN NOT NULL CHECK (private_key_included = FALSE),
  body_canonical TEXT NOT NULL
);

CREATE TABLE sunrey_chain.reconciliation (
  reconciliation_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES sunrey_chain.operation (operation_id),
  outcome TEXT NOT NULL,
  source_record_reference TEXT NOT NULL,
  intent_commitment TEXT NOT NULL,
  chain_commitment TEXT,
  auto_fixed BOOLEAN NOT NULL CHECK (auto_fixed = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE sunrey_chain.health (
  adapter_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  network_mode TEXT NOT NULL CHECK (network_mode = 'SIMULATION'),
  height INTEGER NOT NULL,
  reason TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

REVOKE ALL ON SCHEMA sunrey_chain FROM PUBLIC;
GRANT USAGE ON SCHEMA sunrey_chain TO customer_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA sunrey_chain TO customer_app;
