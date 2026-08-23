-- V039 Phase H Prompt 1 — Personal Data Vault productization metadata.
-- Canonical JSON / identifiers only. No plaintext personal payload.
-- Not a second vault, fabric, ledger, or Execution Authority.

CREATE TABLE personal_data_vault.record_metadata (
  asset_id TEXT PRIMARY KEY REFERENCES personal_data_vault.asset (asset_id),
  subject_id TEXT NOT NULL,
  registry_category TEXT NOT NULL,
  data_kind TEXT NOT NULL,
  verification_state TEXT NOT NULL,
  consent_reference TEXT,
  disputed BOOLEAN NOT NULL,
  object_ref TEXT,
  change_reason TEXT,
  body_canonical TEXT NOT NULL,
  CONSTRAINT pdv_meta_no_plaintext CHECK (
    body_canonical NOT LIKE '%"plaintext"%'
    AND body_canonical NOT LIKE '%"payloadJson"%'
    AND body_canonical NOT LIKE '%"proposedPayload"%'
    AND body_canonical NOT LIKE '%"rawPii"%'
  )
);

CREATE TABLE personal_data_vault.correction (
  correction_id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  proposed_payload_present BOOLEAN NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT pdv_cor_id_prefix CHECK (correction_id LIKE 'pdcor_%'),
  CONSTRAINT pdv_cor_no_payload CHECK (
    body_canonical NOT LIKE '%"plaintext"%'
    AND body_canonical NOT LIKE '%"proposedPayload"%'
    AND body_canonical NOT LIKE '%"payloadJson"%'
  )
);

CREATE TABLE personal_data_vault.export_job (
  export_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  manifest_sha256 TEXT,
  record_count INTEGER NOT NULL,
  legal_portability_claim BOOLEAN NOT NULL CHECK (legal_portability_claim = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT pdv_export_job_id CHECK (export_id LIKE 'pdxj_%')
);

CREATE TABLE personal_data_vault.agent_category (
  subject_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  PRIMARY KEY (subject_id, category_id)
);

REVOKE ALL ON TABLE personal_data_vault.record_metadata FROM PUBLIC;
REVOKE ALL ON TABLE personal_data_vault.correction FROM PUBLIC;
REVOKE ALL ON TABLE personal_data_vault.export_job FROM PUBLIC;
REVOKE ALL ON TABLE personal_data_vault.agent_category FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE personal_data_vault.record_metadata TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE personal_data_vault.correction TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE personal_data_vault.export_job TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE personal_data_vault.agent_category TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE personal_data_vault.record_metadata FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE personal_data_vault.correction FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE personal_data_vault.export_job FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE personal_data_vault.agent_category FROM customer_app;
