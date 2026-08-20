-- V002 Chunk 154 credential descriptor references only.
-- Never store API keys, OAuth tokens, client secrets, or private key bytes.

CREATE TABLE security.credential_descriptor_ref (
  descriptor_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  credential_kind TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  reference_hash TEXT NOT NULL,
  endpoint_profile_ref TEXT,
  status TEXT NOT NULL,
  raw_credential_present BOOLEAN NOT NULL CHECK (raw_credential_present = FALSE),
  private_key_present BOOLEAN NOT NULL CHECK (private_key_present = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT credential_descriptor_ref_no_secret_bytes CHECK (
    reference_hash NOT ILIKE '%PRIVATE KEY%'
    AND reference_hash NOT ILIKE 'Bearer %'
    AND reference_hash NOT ILIKE '%api_key%'
  )
);

REVOKE ALL ON TABLE security.credential_descriptor_ref FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE security.credential_descriptor_ref TO security_app;
