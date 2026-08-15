-- V006 simulated card platform.
-- Processor/token references only. Raw PAN, CVV, PIN, and track data
-- must never appear in these tables. This is not a PCI compliance claim.

CREATE SCHEMA IF NOT EXISTS cards;

CREATE TABLE cards.card_program (
  program_id TEXT PRIMARY KEY,
  legal_entity_id TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  funding_account_class TEXT NOT NULL,
  region TEXT NOT NULL,
  form_factors TEXT[] NOT NULL,
  supported_capabilities TEXT[] NOT NULL,
  simulation_enabled BOOLEAN NOT NULL,
  live_capability BOOLEAN NOT NULL CHECK (live_capability = FALSE),
  policy_capability_id TEXT NOT NULL,
  authorization_hold_ttl_ms BIGINT NOT NULL,
  clearing_overage_tolerance_minor BIGINT NOT NULL,
  network_sponsorship_claim TEXT NOT NULL CHECK (network_sponsorship_claim = 'NONE')
);

CREATE TABLE cards.card (
  card_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  funding_account_id TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  program_id TEXT NOT NULL REFERENCES cards.card_program (program_id),
  processor_card_ref TEXT NOT NULL UNIQUE,
  form_factor TEXT NOT NULL CHECK (form_factor IN ('VIRTUAL', 'PHYSICAL')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'FROZEN', 'SUSPENDED', 'CLOSED', 'EXPIRED')),
  controls_canonical TEXT NOT NULL,
  display_hint TEXT NOT NULL CHECK (display_hint = 'SIM-CARD'),
  requested_by_actor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT cards_card_no_balance CHECK (TRUE),
  CONSTRAINT cards_processor_ref_synthetic CHECK (
    processor_card_ref LIKE 'sim_tok_%' OR processor_card_ref LIKE 'sim_proc_%'
  )
);

CREATE TABLE cards.card_authorization (
  authorization_id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards.card (card_id),
  merchant_ref TEXT NOT NULL,
  merchant_category TEXT NOT NULL,
  amount_minor_units BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  country CHAR(2) NOT NULL,
  card_present BOOLEAN NOT NULL,
  ecommerce BOOLEAN NOT NULL,
  recurring BOOLEAN NOT NULL,
  processor_reference TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'DECLINE', 'REVIEW')),
  reason_code TEXT NOT NULL,
  hold_id TEXT,
  state TEXT NOT NULL,
  external_reason TEXT NOT NULL,
  fraud_evaluation_id TEXT,
  policy_version_id TEXT,
  kernel_decision_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE cards.card_clearing (
  clearing_id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards.card (card_id),
  authorization_id TEXT,
  amount_minor_units BIGINT NOT NULL,
  scenario TEXT NOT NULL,
  state TEXT NOT NULL,
  processor_reference TEXT NOT NULL,
  settlement_id TEXT,
  journal_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE cards.card_refund (
  refund_id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards.card (card_id),
  original_clearing_id TEXT,
  amount_minor_units BIGINT NOT NULL,
  processor_reference TEXT NOT NULL,
  journal_id TEXT,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE cards.card_dispute (
  dispute_id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards.card (card_id),
  customer_id TEXT NOT NULL,
  transaction_ref TEXT NOT NULL,
  reason_category TEXT NOT NULL,
  processor_reference TEXT NOT NULL,
  amount_minor_units BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  evidence_refs TEXT[] NOT NULL,
  deadline_at TIMESTAMPTZ,
  state TEXT NOT NULL,
  history_canonical TEXT NOT NULL,
  provisional_journal_id TEXT,
  final_journal_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE cards.network_token (
  token_ref TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards.card (card_id),
  token_requestor TEXT NOT NULL,
  device_ref TEXT,
  status TEXT NOT NULL,
  assurance TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT cards_token_ref_synthetic CHECK (token_ref LIKE 'sim_ntok_%')
);

CREATE TABLE cards.processor_callback (
  provider_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider_id, nonce),
  UNIQUE (provider_id, idempotency_key)
);

REVOKE ALL ON TABLE cards.card_program FROM PUBLIC;
REVOKE ALL ON TABLE cards.card FROM PUBLIC;
REVOKE ALL ON TABLE cards.card_authorization FROM PUBLIC;
REVOKE ALL ON TABLE cards.card_clearing FROM PUBLIC;
REVOKE ALL ON TABLE cards.card_refund FROM PUBLIC;
REVOKE ALL ON TABLE cards.card_dispute FROM PUBLIC;
REVOKE ALL ON TABLE cards.network_token FROM PUBLIC;
REVOKE ALL ON TABLE cards.processor_callback FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE cards.card_program TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.card TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.card_authorization TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.card_clearing TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.card_refund TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.card_dispute TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.network_token TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE cards.processor_callback TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE cards.card_program FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.card FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.card_authorization FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.card_clearing FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.card_refund FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.card_dispute FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.network_token FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE cards.processor_callback FROM customer_app;
