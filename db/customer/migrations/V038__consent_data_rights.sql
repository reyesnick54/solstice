-- V038 Consent and data-rights productization overlays.
-- Extends the Consent Ledger. Not a second consent system, ledger, or mint.
-- No raw personal payloads. Historical processing is retained.

CREATE TABLE IF NOT EXISTS consent.rights_request (
  request_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN (
    'ACCESS',
    'EXPORT',
    'CORRECTION',
    'DELETION',
    'RESTRICTION',
    'OBJECTION',
    'CONSENT_WITHDRAWAL'
  )),
  state TEXT NOT NULL CHECK (state IN (
    'SUBMITTED',
    'IDENTITY_VERIFICATION_REQUIRED',
    'IN_REVIEW',
    'APPROVED',
    'PARTIALLY_APPROVED',
    'DENIED',
    'PROCESSING',
    'COMPLETED'
  )),
  jurisdiction TEXT NOT NULL,
  applicable BOOLEAN NOT NULL,
  rationale TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  evidence_ref TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT consent_rights_id_prefix CHECK (request_id LIKE 'drr_%'),
  CONSTRAINT consent_rights_no_raw_payload CHECK (
    body_canonical NOT LIKE '%plaintext%'
    AND body_canonical NOT LIKE '%rawPayload%'
  )
);

CREATE TABLE IF NOT EXISTS consent.hin_participation (
  subject_id TEXT PRIMARY KEY,
  participation_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN (
    'NOT_ENROLLED',
    'ENROLLED',
    'PAUSED',
    'WITHDRAWN',
    'RESTRICTED'
  )),
  financial_services_remain_open BOOLEAN NOT NULL CHECK (financial_services_remain_open = TRUE),
  updated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT consent_hin_id_prefix CHECK (participation_id LIKE 'hinp_%')
);

CREATE TABLE IF NOT EXISTS consent.license_grant (
  license_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  licensee_id TEXT NOT NULL,
  purpose_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED', 'SUPERSEDED', 'SUSPENDED')),
  query_limit INTEGER NOT NULL CHECK (query_limit >= 0),
  queries_used INTEGER NOT NULL CHECK (queries_used >= 0),
  unrestricted_database_access BOOLEAN NOT NULL CHECK (unrestricted_database_access = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT consent_license_id_prefix CHECK (license_id LIKE 'lic_%')
);

CREATE TABLE IF NOT EXISTS consent.access_audit (
  audit_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  purpose_id TEXT NOT NULL,
  category TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('ALLOW', 'DENY', 'REQUIRE_CONSENT', 'REQUIRE_REVIEW')),
  resource_ref TEXT,
  raw_value_logged BOOLEAN NOT NULL CHECK (raw_value_logged = FALSE),
  CONSTRAINT consent_audit_id_prefix CHECK (audit_id LIKE 'daa_%')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON consent.rights_request TO customer_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON consent.hin_participation TO customer_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON consent.license_grant TO customer_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON consent.access_audit TO customer_app;
