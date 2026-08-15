-- V021 Canonical Privacy Clean Room metadata.
-- Sessions, jobs, templates, budgets, decisions, receipts, and
-- contribution-computation references. No decrypted Vault payloads.
-- No financial journals. No Execution Authority. No SunRey Coin.

CREATE SCHEMA IF NOT EXISTS clean_room;

CREATE TABLE clean_room.session (
  session_id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  purpose_id TEXT NOT NULL,
  purpose_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'CREATED',
    'AUTHORIZATION_PENDING',
    'AUTHORIZED',
    'RUNNING',
    'COMPLETED',
    'DENIED',
    'FAILED',
    'EXPIRED',
    'REVOKED'
  )),
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT clean_room_session_id_prefix CHECK (session_id LIKE 'crs_'),
  CONSTRAINT clean_room_session_no_payload CHECK (
    body_canonical NOT LIKE '%plaintext%'
    AND body_canonical NOT LIKE '%SELECT *%'
  )
);

CREATE TABLE clean_room.job (
  job_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT clean_room_job_id_prefix CHECK (job_id LIKE 'crj_'),
  CONSTRAINT clean_room_job_no_sql CHECK (
    body_canonical NOT LIKE '%"sql"%'
    AND body_canonical NOT LIKE '%postJournal%'
  )
);

CREATE TABLE clean_room.query_template (
  template_version TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  code TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RETIRED')),
  body_canonical TEXT NOT NULL,
  CONSTRAINT clean_room_template_version_prefix CHECK (template_version LIKE 'crtv_')
);

CREATE TABLE clean_room.dataset_ref (
  dataset_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  subject_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  plaintext_persisted BOOLEAN NOT NULL CHECK (plaintext_persisted = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT clean_room_dataset_id_prefix CHECK (dataset_id LIKE 'crd_')
);

CREATE TABLE clean_room.privacy_policy (
  policy_version TEXT PRIMARY KEY,
  label TEXT NOT NULL CHECK (label IN ('ENGINEERING_POLICY', 'RESEARCH_REQUIRED')),
  body_canonical TEXT NOT NULL,
  CONSTRAINT clean_room_policy_version_prefix CHECK (policy_version LIKE 'ppv_')
);

CREATE TABLE clean_room.query_budget (
  session_id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  purpose_id TEXT NOT NULL,
  queries_used INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  differential_privacy TEXT NOT NULL CHECK (differential_privacy = 'DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED'),
  body_canonical TEXT NOT NULL
);

CREATE TABLE clean_room.join_token_metadata (
  join_key_id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  purpose_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT clean_room_join_id_prefix CHECK (join_key_id LIKE 'pjk_'),
  CONSTRAINT clean_room_join_no_canonical_identity CHECK (
    body_canonical NOT LIKE '%canonicalIdentity%'
  )
);

CREATE TABLE clean_room.egress_decision (
  decision_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('RELEASE', 'REDACT', 'SUPPRESS', 'REVIEW_REQUIRED', 'DENY')),
  reason_code TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT clean_room_egress_id_prefix CHECK (decision_id LIKE 'cre_')
);

CREATE TABLE clean_room.receipt (
  receipt_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  result_hash TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  raw_input_included BOOLEAN NOT NULL CHECK (raw_input_included = FALSE),
  immutable BOOLEAN NOT NULL CHECK (immutable = TRUE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT clean_room_receipt_id_prefix CHECK (receipt_id LIKE 'crr_'),
  CONSTRAINT clean_room_receipt_no_raw CHECK (
    body_canonical NOT LIKE '%rawInputData%'
    AND body_canonical NOT LIKE '%minorUnits%'
  )
);

CREATE TABLE clean_room.contribution_ref (
  contribution_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  purpose_id TEXT NOT NULL,
  coin_issued BOOLEAN NOT NULL CHECK (coin_issued = FALSE),
  market_price_assigned BOOLEAN NOT NULL CHECK (market_price_assigned = FALSE),
  settled_earnings BOOLEAN NOT NULL CHECK (settled_earnings = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT clean_room_contribution_id_prefix CHECK (contribution_id LIKE 'ccc_')
);

REVOKE ALL ON SCHEMA clean_room FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA clean_room FROM PUBLIC;

GRANT USAGE ON SCHEMA clean_room TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA clean_room TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA clean_room FROM customer_app;
