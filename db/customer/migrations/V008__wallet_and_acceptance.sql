-- V008 mobile wallet tokens and merchant SoftPOS / Tap-to-Pay metadata.
-- Opaque references only. Raw PAN, CVV, PIN, track data, tokenized PAN,
-- EMV/contactless card data, and provider secrets must never appear.
-- This is not a PCI, Apple, Google, or acquiring-license claim.

CREATE TABLE cards.device_payment_token (
  token_id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards.card (card_id),
  identity_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  wallet_provider TEXT NOT NULL CHECK (wallet_provider IN ('APPLE_WALLET', 'GOOGLE_WALLET')),
  network_token_reference TEXT NOT NULL,
  provider_reference TEXT NOT NULL UNIQUE,
  assurance_level TEXT NOT NULL,
  provisioning_method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'REQUESTED',
    'PENDING_VERIFICATION',
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED',
    'DELETED'
  )),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ,
  CONSTRAINT cards_wallet_token_ref_synthetic CHECK (network_token_reference LIKE 'sim_ntok_%'),
  CONSTRAINT cards_wallet_provider_ref_synthetic CHECK (provider_reference LIKE 'sim_wref_%')
);

CREATE TABLE cards.wallet_provisioning_attempt (
  attempt_id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  wallet_provider TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reasons TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE cards.wallet_callback (
  provider_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider_id, nonce),
  UNIQUE (provider_id, idempotency_key)
);

CREATE TABLE cards.merchant_acceptance (
  merchant_id TEXT PRIMARY KEY,
  business_identity_id TEXT NOT NULL,
  status TEXT NOT NULL,
  settlement_account_id TEXT NOT NULL,
  jurisdiction CHAR(2) NOT NULL,
  acceptance_capabilities TEXT[] NOT NULL,
  acquiring_license_claim TEXT NOT NULL CHECK (acquiring_license_claim = 'NONE'),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE cards.acceptance_device (
  device_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES cards.merchant_acceptance (merchant_id),
  provider_device_reference TEXT NOT NULL,
  identity_device_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'REMOVED')),
  attestation_reference TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT cards_acceptance_device_ref_synthetic CHECK (provider_device_reference LIKE 'sim_adev_%')
);

CREATE TABLE cards.acceptance_session (
  session_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES cards.merchant_acceptance (merchant_id),
  device_id TEXT NOT NULL REFERENCES cards.acceptance_device (device_id),
  provider TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE cards.merchant_payment (
  payment_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES cards.merchant_acceptance (merchant_id),
  device_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  amount_minor_units BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  merchant_reference TEXT NOT NULL,
  provider_transaction_ref TEXT,
  result TEXT,
  state TEXT NOT NULL,
  settlement_journal_id TEXT,
  fee_journal_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT cards_acceptance_txn_ref_synthetic CHECK (
    provider_transaction_ref IS NULL OR provider_transaction_ref LIKE 'sim_atxn_%'
  )
);

CREATE TABLE cards.acceptance_callback (
  provider_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider_id, nonce),
  UNIQUE (provider_id, idempotency_key)
);

CREATE TABLE cards.acceptance_reconciliation (
  subject_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('MATCHED', 'PENDING', 'MISMATCH', 'INVESTIGATION_REQUIRED')),
  mismatches TEXT[] NOT NULL,
  internal_journal_ids TEXT[] NOT NULL
);

REVOKE ALL ON TABLE cards.device_payment_token FROM PUBLIC;
REVOKE ALL ON TABLE cards.wallet_provisioning_attempt FROM PUBLIC;
REVOKE ALL ON TABLE cards.wallet_callback FROM PUBLIC;
REVOKE ALL ON TABLE cards.merchant_acceptance FROM PUBLIC;
REVOKE ALL ON TABLE cards.acceptance_device FROM PUBLIC;
REVOKE ALL ON TABLE cards.acceptance_session FROM PUBLIC;
REVOKE ALL ON TABLE cards.merchant_payment FROM PUBLIC;
REVOKE ALL ON TABLE cards.acceptance_callback FROM PUBLIC;
REVOKE ALL ON TABLE cards.acceptance_reconciliation FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE cards.device_payment_token TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.wallet_provisioning_attempt TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.wallet_callback TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.merchant_acceptance TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.acceptance_device TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.acceptance_session TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.merchant_payment TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.acceptance_callback TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.acceptance_reconciliation TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE cards.device_payment_token FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.wallet_provisioning_attempt FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.wallet_callback FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.merchant_acceptance FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.acceptance_device FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.acceptance_session FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.merchant_payment FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.acceptance_callback FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.acceptance_reconciliation FROM customer_app;
