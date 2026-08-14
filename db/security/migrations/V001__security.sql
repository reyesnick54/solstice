-- V001 security: key metadata and service identity only.
-- Never store private keys, KMS plaintext, raw secrets, or recovery phrases.

CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE security.key_metadata (
  key_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'DEPRECATED', 'RETIRED', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  provider TEXT NOT NULL,
  public_material TEXT,
  provider_ref TEXT NOT NULL,
  PRIMARY KEY (key_id, version),
  CONSTRAINT key_metadata_no_private_material CHECK (
    public_material IS NULL
    OR (
      public_material NOT ILIKE '%PRIVATE KEY%'
      AND public_material NOT ILIKE '%BEGIN RSA%'
    )
  )
);

CREATE TABLE security.service_identity (
  service_id TEXT PRIMARY KEY,
  service_role TEXT NOT NULL,
  credential_ref TEXT NOT NULL,
  allowed_capabilities TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  key_version INTEGER NOT NULL CHECK (key_version >= 1),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ROTATING', 'EXPIRED', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL
);

REVOKE ALL ON SCHEMA security FROM PUBLIC;
GRANT USAGE ON SCHEMA security TO security_app;
REVOKE ALL ON TABLE security.key_metadata FROM PUBLIC;
REVOKE ALL ON TABLE security.service_identity FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE security.key_metadata TO security_app;
GRANT SELECT, INSERT, UPDATE ON TABLE security.service_identity TO security_app;
