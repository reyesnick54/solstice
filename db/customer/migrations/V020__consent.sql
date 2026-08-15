-- V020 Canonical Consent Ledger and Purpose Firewall.
-- Append-only authorization history. Not a financial ledger.
-- No raw personal payloads. No Execution Authority. No Reyn Coin.

CREATE SCHEMA IF NOT EXISTS consent;

CREATE TABLE consent.purpose (
  purpose_version TEXT PRIMARY KEY,
  purpose_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RETIRED', 'SUPERSEDED')),
  legal_hook TEXT NOT NULL CHECK (legal_hook IN (
    'RESEARCH_REQUIRED',
    'COUNSEL_REVIEW_REQUIRED',
    'COUNSEL_REVIEWED',
    'CONFIRMED_BY_COUNSEL'
  )),
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT consent_purpose_version_prefix CHECK (purpose_version LIKE 'purv_%'),
  CONSTRAINT consent_purpose_id_prefix CHECK (purpose_id LIKE 'pur_%'),
  CONSTRAINT consent_purpose_no_advertising CHECK (
    code NOT IN ('TARGETED_ADVERTISING', 'UNRELATED_SECONDARY_USE')
    AND body_canonical NOT LIKE '%TARGETED_ADVERTISING%'
  )
);

CREATE TABLE consent.recipient (
  recipient_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN (
    'SOLSTICE_SERVICE',
    'EXTERNAL_RESEARCH_PARTNER',
    'EXTERNAL_DATA_RECIPIENT'
  )),
  service_id TEXT NOT NULL,
  label TEXT NOT NULL,
  simulation_fixture BOOLEAN NOT NULL CHECK (simulation_fixture = TRUE),
  live_buyer BOOLEAN NOT NULL CHECK (live_buyer = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT consent_recipient_id_prefix CHECK (recipient_id LIKE 'rcp_%')
);

CREATE TABLE consent.record (
  consent_id TEXT NOT NULL,
  version TEXT NOT NULL,
  grant_id TEXT NOT NULL UNIQUE,
  subject_id TEXT NOT NULL,
  version_sequence INTEGER NOT NULL,
  recipient_id TEXT NOT NULL,
  purpose_id TEXT NOT NULL,
  purpose_version TEXT NOT NULL,
  purpose_code TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'DRAFT',
    'AWAITING_CONFIRMATION',
    'ACTIVE',
    'REVOKED',
    'EXPIRED',
    'SUPERSEDED',
    'REJECTED'
  )),
  effective_from TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  revision INTEGER NOT NULL,
  supersedes TEXT,
  body_canonical TEXT NOT NULL,
  PRIMARY KEY (consent_id, version),
  CONSTRAINT consent_id_prefix CHECK (consent_id LIKE 'cns_'),
  CONSTRAINT consent_version_prefix CHECK (version LIKE 'cnsv_'),
  CONSTRAINT consent_grant_id_prefix CHECK (grant_id LIKE 'cng_'),
  CONSTRAINT consent_no_financial_ledger CHECK (
    body_canonical NOT LIKE '%postJournal%'
    AND body_canonical NOT LIKE '%ExecutionAuthority%'
  )
);

CREATE TABLE consent.receipt (
  receipt_id TEXT PRIMARY KEY,
  consent_id TEXT NOT NULL,
  version TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL,
  consent_hash TEXT NOT NULL,
  immutable BOOLEAN NOT NULL CHECK (immutable = TRUE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT consent_receipt_id_prefix CHECK (receipt_id LIKE 'cnr_%')
);

CREATE TABLE consent.revocation (
  revocation_id TEXT PRIMARY KEY,
  consent_id TEXT NOT NULL,
  version TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL,
  erases_delivered_third_party_data BOOLEAN NOT NULL CHECK (erases_delivered_third_party_data = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT consent_revocation_id_prefix CHECK (revocation_id LIKE 'cnx_%')
);

CREATE TABLE consent.permit (
  permit_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  consent_id TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  purpose_id TEXT NOT NULL,
  purpose_version TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  allowed_operation TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  nonce TEXT NOT NULL,
  issuer TEXT NOT NULL,
  signature_hex TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT consent_permit_id_prefix CHECK (permit_id LIKE 'dup_%'),
  CONSTRAINT consent_permit_no_indefinite CHECK (expires_at > issued_at)
);

CREATE TABLE consent.decision (
  decision_id TEXT PRIMARY KEY,
  decision TEXT NOT NULL CHECK (decision IN ('ALLOW', 'DENY', 'REVIEW_REQUIRED')),
  reason_code TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  consent_id TEXT,
  purpose_id TEXT,
  permit_id TEXT,
  resource_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT consent_decision_id_prefix CHECK (decision_id LIKE 'cnd_%'),
  CONSTRAINT consent_decision_no_payload CHECK (
    body_canonical NOT LIKE '%"payload"%'
    AND body_canonical NOT LIKE '%plaintext%'
  )
);

CREATE TABLE consent.ledger_entry (
  sequence INTEGER PRIMARY KEY,
  consent_id TEXT NOT NULL,
  version TEXT NOT NULL,
  kind TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  hash TEXT NOT NULL,
  previous_hash TEXT,
  body_canonical TEXT NOT NULL,
  CONSTRAINT consent_ledger_not_financial CHECK (
    kind NOT IN ('JOURNAL_POSTED', 'EXECUTION_AUTHORITY_ISSUED')
    AND body_canonical NOT LIKE '%minorUnits%'
  )
);

REVOKE ALL ON SCHEMA consent FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA consent FROM PUBLIC;

GRANT USAGE ON SCHEMA consent TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA consent TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA consent FROM customer_app;
