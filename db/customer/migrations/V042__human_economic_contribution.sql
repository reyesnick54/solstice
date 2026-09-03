-- V042 Human Economic Contribution durable state.
-- Registry, resolution, monetization locks, and proof-bound claim uniqueness.
-- Not a second ledger, mint, or Execution Authority.

CREATE SCHEMA IF NOT EXISTS human_contribution;

CREATE TABLE human_contribution.contribution_record (
  contribution_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  superseded_by TEXT,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX human_contribution_active_fingerprint_uidx
  ON human_contribution.contribution_record (fingerprint)
  WHERE status IN ('OBSERVED', 'SUBMITTED', 'VERIFICATION_REQUIRED', 'VERIFIED')
    AND superseded_by IS NULL;

CREATE UNIQUE INDEX human_contribution_verified_fingerprint_uidx
  ON human_contribution.contribution_record (fingerprint)
  WHERE status = 'VERIFIED';

CREATE TABLE human_contribution.duplicate_attempt (
  attempt_id BIGSERIAL PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  attempted_contribution_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE human_contribution.active_fingerprint (
  fingerprint TEXT PRIMARY KEY,
  contribution_id TEXT NOT NULL,
  reserved_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE human_contribution.verified_fingerprint (
  fingerprint TEXT PRIMARY KEY,
  contribution_id TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE human_contribution.observation (
  observation_id TEXT PRIMARY KEY,
  replay_key TEXT NOT NULL UNIQUE,
  body_canonical TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE human_contribution.resolution_claim (
  claim_id TEXT PRIMARY KEY,
  resolution_fingerprint TEXT NOT NULL UNIQUE,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE human_contribution.monetization_lock (
  claim_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  context_id TEXT,
  consumption_commitment TEXT,
  replay_key TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE human_contribution.monetization_consumed_key (
  monetization_key TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE human_contribution.proof_bound_claim (
  economic_claim_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  lifecycle_state TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE human_contribution.monetized_claim (
  economic_claim_id TEXT PRIMARY KEY REFERENCES human_contribution.proof_bound_claim (economic_claim_id),
  monetized_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE human_contribution.snapshot (
  snapshot_id TEXT PRIMARY KEY,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
