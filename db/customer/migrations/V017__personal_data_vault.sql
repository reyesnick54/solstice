-- V017 Personal Data Vault.
-- Encrypted envelopes and minimized metadata only.
-- No plaintext personal payload columns. Not a second identity or ledger.

CREATE SCHEMA IF NOT EXISTS personal_data_vault;

CREATE TABLE personal_data_vault.vault (
  vault_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL UNIQUE,
  customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  kek_key_id TEXT NOT NULL,
  kek_version INTEGER NOT NULL,
  subject_key_handle_canonical TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT pdv_vault_id_prefix CHECK (vault_id LIKE 'pdv_%')
);

CREATE TABLE personal_data_vault.asset (
  asset_id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL REFERENCES personal_data_vault.vault (vault_id),
  subject_id TEXT NOT NULL,
  category TEXT NOT NULL,
  schema_id TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  source_id TEXT NOT NULL,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('PERSONAL', 'SENSITIVE', 'HIGHLY_SENSITIVE', 'RESTRICTED')),
  current_version_id TEXT,
  current_payload_id TEXT,
  content_sha256 TEXT,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN (
    'ACTIVE',
    'SUPERSEDED',
    'DELETION_REQUESTED',
    'DELETED',
    'RETAINED_BY_POLICY'
  )),
  contribution_mark TEXT NOT NULL CHECK (contribution_mark IN ('NOT_MARKED', 'ELIGIBLE_FOR_CONTRIBUTION_REVIEW')),
  authoritative_for_financial_state BOOLEAN NOT NULL CHECK (authoritative_for_financial_state = FALSE),
  financial_balance TEXT,
  token_balance TEXT,
  expected_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT pdv_asset_id_prefix CHECK (asset_id LIKE 'pda_%'),
  CONSTRAINT pdv_asset_no_financial_balance CHECK (financial_balance IS NULL),
  CONSTRAINT pdv_asset_no_token_balance CHECK (token_balance IS NULL),
  CONSTRAINT pdv_asset_no_plaintext CHECK (
    body_canonical NOT LIKE '%"plaintext"%'
    AND body_canonical NOT LIKE '%"rawPii"%'
  )
);

CREATE TABLE personal_data_vault.asset_version (
  version_id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES personal_data_vault.asset (asset_id),
  subject_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  payload_id TEXT,
  content_sha256 TEXT,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'SUPERSEDED', 'DELETED', 'TOMBSTONED')),
  kek_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT pdv_version_id_prefix CHECK (version_id LIKE 'pdver_%')
);

CREATE TABLE personal_data_vault.payload (
  payload_id TEXT PRIMARY KEY,
  content_sha256 TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  shredded BOOLEAN NOT NULL,
  envelope_canonical TEXT NOT NULL,
  CONSTRAINT pdv_payload_id_prefix CHECK (payload_id LIKE 'pld_%'),
  CONSTRAINT pdv_payload_envelope_not_plaintext CHECK (
    envelope_canonical LIKE '%"ciphertext"%'
    AND envelope_canonical NOT LIKE '%"plaintext"%'
  )
);

CREATE TABLE personal_data_vault.ingestion (
  ingestion_id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_record_ref TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  source_revision INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT pdv_ingestion_id_prefix CHECK (ingestion_id LIKE 'pdi_%'),
  CONSTRAINT pdv_ingestion_idempotent UNIQUE (source_id, source_record_ref, idempotency_key)
);

CREATE TABLE personal_data_vault.derivation (
  derivation_id TEXT PRIMARY KEY,
  output_asset_id TEXT NOT NULL,
  method TEXT NOT NULL,
  method_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT pdv_derivation_id_prefix CHECK (derivation_id LIKE 'pddv_%')
);

CREATE TABLE personal_data_vault.access_audit (
  access_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  purpose_ref TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('ALLOWED', 'DENIED')),
  reason TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT pdv_access_id_prefix CHECK (access_id LIKE 'pdar_%'),
  CONSTRAINT pdv_access_no_payload CHECK (
    body_canonical NOT LIKE '%"plaintext"%'
    AND body_canonical NOT LIKE '%"payloadJson"%'
  )
);

CREATE TABLE personal_data_vault.export_manifest (
  export_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  manifest_sha256 TEXT NOT NULL,
  legal_portability_claim BOOLEAN NOT NULL CHECK (legal_portability_claim = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT pdv_export_id_prefix CHECK (export_id LIKE 'pdx_%')
);

CREATE TABLE personal_data_vault.deletion_request (
  request_id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('DELETE_ALLOWED', 'RETENTION_REQUIRED', 'REVIEW_REQUIRED')),
  policy_id TEXT,
  policy_source TEXT,
  completed_at TIMESTAMPTZ,
  body_canonical TEXT NOT NULL,
  CONSTRAINT pdv_deletion_id_prefix CHECK (request_id LIKE 'pdd_%')
);

REVOKE ALL ON SCHEMA personal_data_vault FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA personal_data_vault FROM PUBLIC;

GRANT USAGE ON SCHEMA personal_data_vault TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA personal_data_vault TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA personal_data_vault FROM customer_app;
