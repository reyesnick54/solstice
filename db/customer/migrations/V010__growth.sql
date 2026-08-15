-- V010 Growth Orchestrator / machine-verifiable economic mandates.
-- Planning state only. Does not post journals or store balances.

CREATE SCHEMA IF NOT EXISTS growth;

CREATE TABLE growth.mandate_version (
  mandate_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  subject_id TEXT NOT NULL,
  state TEXT NOT NULL,
  source_text TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  body_canonical TEXT NOT NULL,
  planning_eligible BOOLEAN NOT NULL,
  compiled_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (mandate_id, version),
  CONSTRAINT growth_mandate_id_prefix CHECK (mandate_id LIKE 'emd_%'),
  CONSTRAINT growth_mandate_no_balance CHECK (body_canonical NOT LIKE '%"balance":%')
);

CREATE TABLE growth.mandate_confirmation (
  confirmation_id TEXT PRIMARY KEY,
  mandate_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  authentication_assurance TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL,
  context_hash TEXT NOT NULL,
  confirmation_hash TEXT NOT NULL,
  high_impact BOOLEAN NOT NULL,
  CONSTRAINT growth_confirmation_id_prefix CHECK (confirmation_id LIKE 'emcf_%'),
  CONSTRAINT growth_confirmation_no_secret CHECK (context_hash NOT LIKE '%private%')
);

CREATE TABLE growth.cycle (
  cycle_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  mandate_id TEXT NOT NULL,
  mandate_version INTEGER NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  peg_snapshot_id TEXT,
  CONSTRAINT growth_cycle_id_prefix CHECK (cycle_id LIKE 'gcy_%')
);

CREATE TABLE growth.plan (
  plan_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  cycle_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  mandate_id TEXT NOT NULL,
  mandate_version INTEGER NOT NULL,
  peg_snapshot_id TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  planning_version TEXT NOT NULL,
  state TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  PRIMARY KEY (plan_id, version),
  CONSTRAINT growth_plan_id_prefix CHECK (plan_id LIKE 'gpl_%'),
  CONSTRAINT growth_plan_no_guaranteed_return CHECK (
    body_canonical NOT LIKE '%guaranteedReturn%'
    AND body_canonical NOT LIKE '%guaranteed_return%'
  )
);

CREATE TABLE growth.candidate (
  action_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  plan_version INTEGER NOT NULL,
  action TEXT NOT NULL,
  execution_capability TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT growth_action_id_prefix CHECK (action_id LIKE 'gac_%')
);

CREATE TABLE growth.feasibility (
  action_id TEXT PRIMARY KEY,
  accepted BOOLEAN NOT NULL,
  deferred BOOLEAN NOT NULL,
  reasons_canonical TEXT NOT NULL,
  detail TEXT NOT NULL
);

CREATE TABLE growth.invalidation (
  plan_id TEXT NOT NULL,
  plan_version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  invalidated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (plan_id, plan_version)
);
