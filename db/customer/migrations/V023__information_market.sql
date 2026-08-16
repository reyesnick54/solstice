-- V023 Information market metadata. Not a second ledger and not raw PDV.
-- Proof of contribution stores hashes and refs only.

CREATE SCHEMA IF NOT EXISTS information_market;

CREATE TABLE information_market.requester (
  requester_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  legal_entity_ref TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  verification_state TEXT NOT NULL,
  status TEXT NOT NULL,
  simulation_fixture BOOLEAN NOT NULL CHECK (simulation_fixture = TRUE),
  live_verified_institution BOOLEAN NOT NULL CHECK (live_verified_institution = FALSE),
  body_canonical TEXT NOT NULL
);

CREATE TABLE information_market.request (
  request_id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES information_market.requester (requester_id),
  product_type TEXT NOT NULL,
  purpose_ref TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  status TEXT NOT NULL,
  legal_review_state TEXT NOT NULL CHECK (legal_review_state = 'RESEARCH_REQUIRED'),
  created_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  body_canonical TEXT NOT NULL
);

CREATE TABLE information_market.attestation (
  attestation_id TEXT PRIMARY KEY,
  subject_ref TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  purpose_ref TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  source_record_revealed BOOLEAN NOT NULL CHECK (source_record_revealed = FALSE),
  body_canonical TEXT NOT NULL
);

CREATE TABLE information_market.opportunity (
  opportunity_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES information_market.request (request_id),
  subject_id TEXT NOT NULL,
  purpose_ref TEXT NOT NULL,
  decision TEXT,
  dark_pattern BOOLEAN NOT NULL CHECK (dark_pattern = FALSE),
  body_canonical TEXT NOT NULL
);

CREATE TABLE information_market.contribution (
  contribution_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES information_market.request (request_id),
  opportunity_id TEXT NOT NULL REFERENCES information_market.opportunity (opportunity_id),
  subject_ref TEXT NOT NULL,
  consent_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  computation_receipt_id TEXT,
  provenance_hash TEXT,
  settlement_ref TEXT,
  raw_data_included BOOLEAN NOT NULL CHECK (raw_data_included = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE information_market.settlement_ref (
  settlement_ref TEXT PRIMARY KEY,
  contribution_id TEXT NOT NULL REFERENCES information_market.contribution (contribution_id),
  asset TEXT NOT NULL,
  intent_id TEXT NOT NULL,
  journal_id TEXT,
  transfer_id TEXT,
  realization TEXT NOT NULL CHECK (realization = 'REALIZED'),
  body_canonical TEXT NOT NULL
);

CREATE TABLE information_market.demand_observation (
  observed_at TIMESTAMPTZ PRIMARY KEY,
  request_count INTEGER NOT NULL,
  is_coin_price BOOLEAN NOT NULL CHECK (is_coin_price = FALSE),
  is_human_worth BOOLEAN NOT NULL CHECK (is_human_worth = FALSE),
  is_token_valuation BOOLEAN NOT NULL CHECK (is_token_valuation = FALSE),
  body_canonical TEXT NOT NULL
);

REVOKE ALL ON SCHEMA information_market FROM PUBLIC;
GRANT USAGE ON SCHEMA information_market TO customer_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA information_market TO customer_app;
