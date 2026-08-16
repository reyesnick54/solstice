-- V025 SunRey Exchange metadata. Not a second ledger and not a live venue.
-- Stores accounts, listings, orders, trades, and reconciliation outcomes only.
-- No balance column. Balances are read from the canonical ledger.

CREATE SCHEMA IF NOT EXISTS sunrey_exchange;

CREATE TABLE sunrey_exchange.account (
  account_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  legal_entity_id TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  custody_account_id TEXT NOT NULL,
  cash_account_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE sunrey_exchange.listing (
  listing_id TEXT PRIMARY KEY,
  listing_version INTEGER NOT NULL,
  family TEXT NOT NULL,
  underlying_ref TEXT NOT NULL,
  settlement_model TEXT NOT NULL,
  status TEXT NOT NULL,
  legal_review_state TEXT NOT NULL CHECK (legal_review_state IN ('RESEARCH_REQUIRED', 'COUNSEL_REVIEW_REQUIRED')),
  risk_classification TEXT NOT NULL CHECK (risk_classification = 'SIMULATION_ONLY'),
  token_classification_claim TEXT NOT NULL CHECK (token_classification_claim = 'NONE'),
  body_canonical TEXT NOT NULL
);

CREATE TABLE sunrey_exchange.market (
  market_id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  book_id TEXT NOT NULL,
  base_listing_id TEXT NOT NULL REFERENCES sunrey_exchange.listing (listing_id),
  quote_listing_id TEXT,
  state TEXT NOT NULL,
  self_trade_policy TEXT NOT NULL,
  fee_schedule_id TEXT NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE sunrey_exchange.exchange_order (
  order_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  account_id TEXT NOT NULL REFERENCES sunrey_exchange.account (account_id),
  market_id TEXT NOT NULL REFERENCES sunrey_exchange.market (market_id),
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  quantity_scaled TEXT NOT NULL,
  remaining_scaled TEXT NOT NULL,
  status TEXT NOT NULL,
  client_idempotency_key TEXT NOT NULL UNIQUE,
  hold_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE sunrey_exchange.trade (
  trade_id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES sunrey_exchange.market (market_id),
  maker_order_id TEXT NOT NULL REFERENCES sunrey_exchange.exchange_order (order_id),
  taker_order_id TEXT NOT NULL REFERENCES sunrey_exchange.exchange_order (order_id),
  quantity_scaled TEXT NOT NULL,
  price_units TEXT NOT NULL,
  quote_minor TEXT NOT NULL,
  price_label TEXT NOT NULL CHECK (price_label = 'SIMULATION_MARKET_PRICE'),
  matched_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE sunrey_exchange.settlement (
  settlement_id TEXT PRIMARY KEY,
  trade_id TEXT NOT NULL UNIQUE REFERENCES sunrey_exchange.trade (trade_id),
  coin_journal_id TEXT,
  cash_journal_id TEXT,
  fee_journal_id TEXT,
  settled_at TIMESTAMPTZ NOT NULL,
  atomic BOOLEAN NOT NULL CHECK (atomic = TRUE),
  body_canonical TEXT NOT NULL
);

CREATE TABLE sunrey_exchange.reconciliation (
  reconciliation_id TEXT PRIMARY KEY,
  outcome TEXT NOT NULL,
  auto_corrected BOOLEAN NOT NULL CHECK (auto_corrected = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

REVOKE ALL ON SCHEMA sunrey_exchange FROM PUBLIC;
GRANT USAGE ON SCHEMA sunrey_exchange TO customer_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA sunrey_exchange TO customer_app;
