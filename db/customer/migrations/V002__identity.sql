-- V002 identity: Solstice Identity records in the customer bounded database.
-- Identity is related to Customer but is not the same concept.
-- Never store private passkeys, session secrets, raw document images, or plaintext passwords.

CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE identity.person_identity (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'CLOSED')),
  home_jurisdiction CHAR(2) NOT NULL,
  customer_id TEXT,
  attributes_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 0)
);

CREATE TABLE identity.customer_link (
  identity_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE
);

CREATE TABLE identity.business_identity (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  legal_name_ref TEXT NOT NULL,
  registration_ref TEXT,
  jurisdiction CHAR(2) NOT NULL,
  business_status TEXT NOT NULL CHECK (business_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISSOLVED')),
  representatives_json JSONB NOT NULL,
  beneficial_owner_refs JSONB NOT NULL,
  control_person_refs JSONB NOT NULL,
  verification_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 0)
);

CREATE TABLE identity.webauthn_credential (
  credential_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  public_key_material TEXT NOT NULL,
  sign_count INTEGER NOT NULL CHECK (sign_count >= 0),
  transports JSONB NOT NULL,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  CONSTRAINT webauthn_no_private_material CHECK (
    public_key_material NOT ILIKE '%PRIVATE%'
    AND public_key_material NOT ILIKE '%BEGIN %KEY%'
  )
);

CREATE TABLE identity.session (
  session_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  authentication_strength TEXT NOT NULL,
  factors JSONB NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL,
  device_id TEXT,
  risk_state TEXT NOT NULL CHECK (risk_state IN ('CLEAR', 'ELEVATED', 'BLOCKED')),
  revocation_state TEXT NOT NULL CHECK (revocation_state IN ('ACTIVE', 'REVOKED', 'EXPIRED'))
);

CREATE TABLE identity.device (
  device_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  device_ref TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  authentication_method TEXT,
  trust_state TEXT NOT NULL CHECK (trust_state IN ('KNOWN', 'TRUSTED', 'REVIEW_REQUIRED', 'BLOCKED'))
);

CREATE TABLE identity.kyc_record (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  provider_ref TEXT NOT NULL,
  verification_state TEXT NOT NULL CHECK (
    verification_state IN ('NOT_STARTED', 'IN_PROGRESS', 'VERIFIED', 'FAILED', 'EXPIRED')
  ),
  verification_level TEXT NOT NULL CHECK (
    verification_level IN ('NONE', 'BASIC', 'STANDARD', 'ENHANCED')
  ),
  jurisdiction CHAR(2) NOT NULL,
  verified_attributes JSONB NOT NULL,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  reason_codes JSONB NOT NULL,
  evidence_refs JSONB NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1)
);

CREATE TABLE identity.capability_grant (
  grant_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('IDENTITY_SERVICE', 'ROLE', 'RELATIONSHIP')),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE identity.recovery_request (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (
    state IN ('REQUESTED', 'EVIDENCE_REQUIRED', 'STEP_UP_REQUIRED', 'APPROVED', 'DENIED', 'EXPIRED')
  ),
  evidence_refs JSONB NOT NULL,
  step_up_completed_at TIMESTAMPTZ,
  reason_codes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 0)
);

REVOKE ALL ON SCHEMA identity FROM PUBLIC;
GRANT USAGE ON SCHEMA identity TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA identity TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA identity FROM customer_app;
