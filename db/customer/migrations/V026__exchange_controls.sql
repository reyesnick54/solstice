-- V026 Chunk 30R exchange control-plane metadata.
-- Not a second ledger. No wallet position column. No private keys or seed phrases.
-- Travel Rule payloads, if persisted later, must be ciphertext only.

CREATE SCHEMA IF NOT EXISTS custody;
CREATE SCHEMA IF NOT EXISTS market_surveillance;

CREATE TABLE custody.deposit (
  deposit_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  custody_account_id TEXT NOT NULL,
  notice_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  journal_id TEXT,
  provider_balance_is_truth BOOLEAN NOT NULL CHECK (provider_balance_is_truth = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE custody.destination (
  destination_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  address_hash TEXT NOT NULL,
  added_with_step_up BOOLEAN NOT NULL CHECK (added_with_step_up = TRUE),
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE custody.withdrawal (
  withdrawal_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  destination_id TEXT NOT NULL REFERENCES custody.destination (destination_id),
  state TEXT NOT NULL,
  journal_id TEXT,
  submitted_once BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE custody.travel_rule_message (
  message_id TEXT PRIMARY KEY,
  withdrawal_id TEXT NOT NULL REFERENCES custody.withdrawal (withdrawal_id),
  envelope_ciphertext TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL,
  pii_in_events BOOLEAN NOT NULL CHECK (pii_in_events = FALSE),
  legal_status TEXT NOT NULL CHECK (legal_status = 'RESEARCH_REQUIRED'),
  body_canonical TEXT NOT NULL
);

CREATE TABLE custody.reconciliation (
  reconciliation_id TEXT PRIMARY KEY,
  outcome TEXT NOT NULL,
  auto_corrected BOOLEAN NOT NULL CHECK (auto_corrected = FALSE),
  auto_created_assets BOOLEAN NOT NULL CHECK (auto_created_assets = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE market_surveillance.alert (
  alert_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  market_id TEXT NOT NULL,
  output_class TEXT NOT NULL CHECK (output_class = 'CANDIDATE_ALERT'),
  legal_conclusion BOOLEAN NOT NULL CHECK (legal_conclusion = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE sunrey_exchange.listing_decision (
  listing_id TEXT NOT NULL,
  listing_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status <> 'LIVE_APPROVED'),
  legal_review_state TEXT NOT NULL CHECK (legal_review_state IN ('RESEARCH_REQUIRED', 'COUNSEL_REVIEW_REQUIRED')),
  rdt_disposition TEXT NOT NULL,
  live_approved BOOLEAN NOT NULL CHECK (live_approved = FALSE),
  body_canonical TEXT NOT NULL,
  PRIMARY KEY (listing_id, listing_version)
);

CREATE TABLE sunrey_exchange.kill_switch (
  scope TEXT NOT NULL,
  target_id TEXT NOT NULL,
  active BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  PRIMARY KEY (scope, target_id)
);

REVOKE ALL ON SCHEMA custody FROM PUBLIC;
REVOKE ALL ON SCHEMA market_surveillance FROM PUBLIC;
GRANT USAGE ON SCHEMA custody TO customer_app;
GRANT USAGE ON SCHEMA market_surveillance TO customer_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA custody TO customer_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA market_surveillance TO customer_app;
GRANT SELECT, INSERT ON sunrey_exchange.listing_decision TO customer_app;
GRANT SELECT, INSERT ON sunrey_exchange.kill_switch TO customer_app;
