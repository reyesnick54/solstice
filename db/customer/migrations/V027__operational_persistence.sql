-- V027 Chunk 154 operational persistence and crash-recovery metadata.
-- Application state only. Not a second ledger and not a native-asset mint.
-- Quantity-bearing custody/exchange rows require an explicit native asset.

ALTER TABLE payments.payment_order ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE payments.rail_submission ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE payments.fx_quote ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE payments.fx_quote ADD COLUMN IF NOT EXISTS execution_ref TEXT;

CREATE TABLE payments.operational_payment (
  payment_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  rail_submission_id TEXT,
  provider_idempotency_key TEXT,
  quote_execution_ref TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE payments.operational_rail_submission (
  rail_submission_id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  execution_unknown BOOLEAN NOT NULL DEFAULT FALSE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE payments.operational_fx_execution (
  execution_id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  payment_id TEXT,
  provider_quote_ref TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE custody.operational_vault (
  vault_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 2),
  authorized_assets TEXT[] NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  not_quantity_authority BOOLEAN NOT NULL CHECK (not_quantity_authority = TRUE),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT operational_vault_assets CHECK (
    authorized_assets <@ ARRAY['SUNREY_COIN', 'MOONREY_COIN']::TEXT[]
    AND cardinality(authorized_assets) >= 1
  )
);

CREATE TABLE custody.operational_wallet (
  wallet_id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  asset_id TEXT NOT NULL CHECK (asset_id IN ('SUNREY_COIN', 'MOONREY_COIN')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE custody.operational_withdrawal (
  withdrawal_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  vault_id TEXT NOT NULL,
  wallet_id TEXT,
  asset_id TEXT NOT NULL CHECK (asset_id IN ('SUNREY_COIN', 'MOONREY_COIN')),
  quantity TEXT NOT NULL,
  state TEXT NOT NULL,
  submitted_once BOOLEAN NOT NULL,
  submission_id TEXT,
  provider_idempotency_key TEXT,
  journal_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE custody.operational_deposit (
  deposit_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  asset_id TEXT NOT NULL CHECK (asset_id IN ('SUNREY_COIN', 'MOONREY_COIN')),
  quantity TEXT NOT NULL,
  state TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE custody.operational_reservation (
  reservation_id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  asset_id TEXT NOT NULL CHECK (asset_id IN ('SUNREY_COIN', 'MOONREY_COIN')),
  quantity TEXT NOT NULL,
  released BOOLEAN NOT NULL,
  debited BOOLEAN NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE custody.operational_provider_submission (
  submission_id TEXT PRIMARY KEY,
  withdrawal_id TEXT,
  deposit_id TEXT,
  asset_id TEXT NOT NULL CHECK (asset_id IN ('SUNREY_COIN', 'MOONREY_COIN')),
  state TEXT NOT NULL,
  provider_idempotency_key TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sunrey_exchange.operational_order (
  order_id TEXT PRIMARY KEY,
  client_idempotency_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  hold_id TEXT,
  base_asset TEXT NOT NULL CHECK (base_asset IN ('SUNREY_COIN', 'MOONREY_COIN')),
  quote_asset TEXT NOT NULL CHECK (quote_asset IN ('SUNREY_COIN', 'MOONREY_COIN')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TIMESTAMPTZ NOT NULL,
  chain_remains_native_asset_authority BOOLEAN NOT NULL CHECK (chain_remains_native_asset_authority = TRUE) DEFAULT TRUE
);

CREATE TABLE sunrey_exchange.operational_reservation (
  reservation_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  asset_id TEXT NOT NULL CHECK (asset_id IN ('SUNREY_COIN', 'MOONREY_COIN')),
  quantity TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sunrey_exchange.operational_trade (
  trade_id TEXT PRIMARY KEY,
  buy_order_id TEXT NOT NULL,
  sell_order_id TEXT NOT NULL
);

CREATE TABLE sunrey_exchange.operational_settlement_intent (
  intent_id TEXT PRIMARY KEY,
  trade_id TEXT NOT NULL,
  base_asset TEXT NOT NULL CHECK (base_asset IN ('SUNREY_COIN', 'MOONREY_COIN')),
  quote_asset TEXT NOT NULL CHECK (quote_asset IN ('SUNREY_COIN', 'MOONREY_COIN')),
  submission TEXT NOT NULL CHECK (submission IN ('PENDING', 'KNOWN', 'SUBMISSION_UNKNOWN')),
  journal_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TIMESTAMPTZ NOT NULL,
  chain_remains_native_asset_authority BOOLEAN NOT NULL CHECK (chain_remains_native_asset_authority = TRUE) DEFAULT TRUE
);

CREATE TABLE customer.provider_operational_state (
  provider_id TEXT PRIMARY KEY,
  profile_version TEXT NOT NULL,
  profile_hash TEXT NOT NULL,
  acceptance_status TEXT NOT NULL,
  credential_descriptor_id TEXT,
  credential_version INTEGER,
  credential_reference_hash TEXT,
  endpoint_profile_ref TEXT,
  certification_ref TEXT,
  revalidation_state TEXT NOT NULL,
  suspension_state TEXT NOT NULL,
  raw_credential_present BOOLEAN NOT NULL CHECK (raw_credential_present = FALSE),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE customer.operational_outbox (
  event_id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PENDING', 'IN_FLIGHT', 'DELIVERED', 'DEAD_LETTER')),
  lease_expires_at TIMESTAMPTZ,
  not_a_journal BOOLEAN NOT NULL CHECK (not_a_journal = TRUE)
);

CREATE TABLE customer.operational_inbox (
  consumer_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  interrupted BOOLEAN NOT NULL,
  PRIMARY KEY (consumer_id, event_id)
);

REVOKE ALL ON TABLE payments.operational_payment FROM PUBLIC;
REVOKE ALL ON TABLE payments.operational_rail_submission FROM PUBLIC;
REVOKE ALL ON TABLE payments.operational_fx_execution FROM PUBLIC;
REVOKE ALL ON TABLE custody.operational_vault FROM PUBLIC;
REVOKE ALL ON TABLE custody.operational_wallet FROM PUBLIC;
REVOKE ALL ON TABLE custody.operational_withdrawal FROM PUBLIC;
REVOKE ALL ON TABLE custody.operational_deposit FROM PUBLIC;
REVOKE ALL ON TABLE custody.operational_reservation FROM PUBLIC;
REVOKE ALL ON TABLE custody.operational_provider_submission FROM PUBLIC;
REVOKE ALL ON TABLE sunrey_exchange.operational_order FROM PUBLIC;
REVOKE ALL ON TABLE sunrey_exchange.operational_reservation FROM PUBLIC;
REVOKE ALL ON TABLE sunrey_exchange.operational_trade FROM PUBLIC;
REVOKE ALL ON TABLE sunrey_exchange.operational_settlement_intent FROM PUBLIC;
REVOKE ALL ON TABLE customer.provider_operational_state FROM PUBLIC;
REVOKE ALL ON TABLE customer.operational_outbox FROM PUBLIC;
REVOKE ALL ON TABLE customer.operational_inbox FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE payments.operational_payment TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.operational_rail_submission TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE payments.operational_fx_execution TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE custody.operational_vault TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE custody.operational_wallet TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE custody.operational_withdrawal TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE custody.operational_deposit TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE custody.operational_reservation TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE custody.operational_provider_submission TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE sunrey_exchange.operational_order TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE sunrey_exchange.operational_reservation TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE sunrey_exchange.operational_trade TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE sunrey_exchange.operational_settlement_intent TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE customer.provider_operational_state TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE customer.operational_outbox TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE customer.operational_inbox TO customer_app;
