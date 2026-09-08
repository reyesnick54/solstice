-- V044 consumer native-custody wallet product metadata.
-- Wallet rows are customer-facing product state only. They are not a ledger,
-- token-balance authority, signing authority, or permission to use mainnet.

CREATE SCHEMA IF NOT EXISTS custody;

CREATE TABLE custody.consumer_wallet (
  wallet_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  asset_id TEXT NOT NULL CHECK (asset_id IN ('SUNREY_COIN', 'MOONREY_COIN')),
  network_id TEXT NOT NULL CHECK (network_id = 'SUNREY_CHAIN'),
  custody_model TEXT NOT NULL CHECK (custody_model IN ('SUNREY_NATIVE', 'EXTERNAL_CUSTODY', 'INTERNAL_OPERATIONAL')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'RESTRICTED', 'FROZEN', 'CLOSED')),
  withdrawal_enabled BOOLEAN NOT NULL,
  provider_ref TEXT,
  custody_account_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  production_money_movement BOOLEAN NOT NULL CHECK (production_money_movement = FALSE) DEFAULT FALSE,
  production_signing_authorized BOOLEAN NOT NULL CHECK (production_signing_authorized = FALSE) DEFAULT FALSE,
  not_a_ledger BOOLEAN NOT NULL CHECK (not_a_ledger = TRUE) DEFAULT TRUE,
  UNIQUE (customer_id, asset_id)
);

CREATE INDEX consumer_wallet_customer_created_idx
  ON custody.consumer_wallet (customer_id, created_at, wallet_id);

REVOKE ALL ON SCHEMA custody FROM PUBLIC;
GRANT USAGE ON SCHEMA custody TO customer_app;
REVOKE ALL ON TABLE custody.consumer_wallet FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE custody.consumer_wallet TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE custody.consumer_wallet FROM customer_app;
