-- V030 consumer authentication: login handles, password/TOTP credentials,
-- refresh sessions, auth challenges, and security events.
-- Extends identity schema. Not a second identity system.
-- Never store plaintext passwords, TOTP secrets, refresh tokens, or raw PII.
-- Authentication is not KYC and does not grant Execution Authority.

ALTER TABLE identity.session
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS user_agent_hash TEXT;

ALTER TABLE identity.device
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS risk_state TEXT NOT NULL DEFAULT 'CLEAR',
  ADD COLUMN IF NOT EXISTS authentication_strength TEXT;

ALTER TABLE identity.device
  DROP CONSTRAINT IF EXISTS device_risk_state_check;
ALTER TABLE identity.device
  ADD CONSTRAINT device_risk_state_check CHECK (risk_state IN ('CLEAR', 'ELEVATED', 'BLOCKED'));

CREATE TABLE identity.login_handle (
  handle_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('EMAIL', 'PHONE')),
  lookup_hash TEXT NOT NULL,
  verification_state TEXT NOT NULL CHECK (verification_state IN ('UNVERIFIED', 'VERIFIED')),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (kind, lookup_hash)
);

CREATE TABLE identity.password_credential (
  credential_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL UNIQUE,
  kdf TEXT NOT NULL CHECK (kdf = 'scrypt'),
  salt_hex TEXT NOT NULL,
  digest_hex TEXT NOT NULL,
  n INTEGER NOT NULL CHECK (n >= 16384),
  r INTEGER NOT NULL CHECK (r >= 8),
  p INTEGER NOT NULL CHECK (p >= 1),
  dk_len INTEGER NOT NULL CHECK (dk_len >= 32),
  created_at TIMESTAMPTZ NOT NULL,
  rotated_at TIMESTAMPTZ,
  CONSTRAINT password_credential_no_plaintext CHECK (
    salt_hex NOT ILIKE '%password%'
    AND digest_hex NOT ILIKE '%password%'
  )
);

CREATE TABLE identity.totp_credential (
  credential_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL UNIQUE,
  secret_envelope JSONB NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT totp_secret_is_envelope CHECK (
    secret_envelope ? 'ciphertext'
    AND NOT (secret_envelope ? 'secret')
    AND NOT (secret_envelope ? 'plaintext')
  )
);

CREATE TABLE identity.refresh_session (
  refresh_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  family_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by TEXT,
  reuse_detected_at TIMESTAMPTZ
);

CREATE TABLE identity.auth_challenge (
  challenge_id TEXT PRIMARY KEY,
  identity_id TEXT,
  purpose TEXT NOT NULL CHECK (
    purpose IN (
      'MFA_LOGIN',
      'MFA_STEP_UP',
      'TOTP_ENROLL',
      'RECOVERY',
      'PASSKEY_REGISTRATION',
      'PASSKEY_AUTHENTICATION'
    )
  ),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL CHECK (failed_attempts >= 0),
  session_id TEXT,
  device_id TEXT,
  factors JSONB NOT NULL
);

CREATE TABLE identity.security_event (
  event_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  identity_id TEXT,
  session_id TEXT,
  device_id TEXT,
  authentication_strength TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  reason_code TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE identity.terms_acknowledgement (
  identity_id TEXT PRIMARY KEY,
  terms_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL
);

REVOKE ALL ON TABLE identity.login_handle FROM PUBLIC;
REVOKE ALL ON TABLE identity.password_credential FROM PUBLIC;
REVOKE ALL ON TABLE identity.totp_credential FROM PUBLIC;
REVOKE ALL ON TABLE identity.refresh_session FROM PUBLIC;
REVOKE ALL ON TABLE identity.auth_challenge FROM PUBLIC;
REVOKE ALL ON TABLE identity.security_event FROM PUBLIC;
REVOKE ALL ON TABLE identity.terms_acknowledgement FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE identity.login_handle TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE identity.password_credential TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE identity.totp_credential TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE identity.refresh_session TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE identity.auth_challenge TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE identity.security_event TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE identity.terms_acknowledgement TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE identity.login_handle FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE identity.password_credential FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE identity.totp_credential FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE identity.refresh_session FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE identity.auth_challenge FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE identity.security_event FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE identity.terms_acknowledgement FROM customer_app;
