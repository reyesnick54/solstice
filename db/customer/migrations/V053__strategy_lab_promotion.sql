-- V053 Strategy Lab H18 controlled promotion pipeline.
-- Qualification policies, promotion records, forward shadow evidence, and audit trail.

CREATE TABLE strategy_lab.qualification_policy (
  policy_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  applicable_strategy_class TEXT NOT NULL,
  live_execution_permitted BOOLEAN NOT NULL CHECK (live_execution_permitted = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT qualification_policy_id_prefix CHECK (policy_id LIKE 'qpol_%')
);

CREATE TABLE strategy_lab.strategy_capsule (
  capsule_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  compiled_hash TEXT,
  frozen_at TIMESTAMPTZ NOT NULL,
  simulation_only BOOLEAN NOT NULL CHECK (simulation_only = TRUE),
  live_eligible BOOLEAN NOT NULL CHECK (live_eligible = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT strategy_capsule_id_prefix CHECK (capsule_id LIKE 'scap_%'),
  UNIQUE (strategy_id, version)
);

CREATE TABLE strategy_lab.promotion_record (
  strategy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  capsule_id TEXT NOT NULL,
  capsule_fingerprint TEXT NOT NULL,
  promotion_state TEXT NOT NULL CHECK (promotion_state IN (
    'RESEARCH',
    'EVALUATION_ELIGIBLE',
    'EVALUATED',
    'SHADOW_ELIGIBLE',
    'SHADOW_ACTIVE',
    'PAPER_ELIGIBLE',
    'PAPER_ACTIVE',
    'PAUSED',
    'REVIEW_REQUIRED',
    'RETIRED'
  )),
  policy_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  PRIMARY KEY (strategy_id, version)
);

CREATE TABLE strategy_lab.evaluation_qualification (
  qualification_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  capsule_fingerprint TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT evaluation_qualification_id_prefix CHECK (qualification_id LIKE 'eqf_%')
);

CREATE TABLE strategy_lab.forward_shadow_run (
  run_id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  capsule_fingerprint TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  observation_ref TEXT NOT NULL,
  sends_orders BOOLEAN NOT NULL CHECK (sends_orders = FALSE),
  financial_effect_created BOOLEAN NOT NULL CHECK (financial_effect_created = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT forward_shadow_run_id_prefix CHECK (run_id LIKE 'fshd_%')
);

CREATE TABLE strategy_lab.forward_shadow_decision (
  decision_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  capsule_fingerprint TEXT NOT NULL,
  decision_time TIMESTAMPTZ NOT NULL,
  action_kind TEXT NOT NULL CHECK (action_kind IN ('TRADE', 'NO_ACTION', 'WAIT')),
  broker_submission BOOLEAN NOT NULL CHECK (broker_submission = FALSE),
  immutable_after_outcome BOOLEAN NOT NULL DEFAULT FALSE,
  body_canonical TEXT NOT NULL,
  CONSTRAINT forward_shadow_decision_id_prefix CHECK (decision_id LIKE 'fsdec_%')
);

CREATE TABLE strategy_lab.promotion_decision (
  decision_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  capsule_id TEXT NOT NULL,
  capsule_fingerprint TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  live_eligible BOOLEAN NOT NULL CHECK (live_eligible = FALSE),
  decided_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT promotion_decision_id_prefix CHECK (decision_id LIKE 'pdec_%')
);

CREATE TABLE strategy_lab.demotion_record (
  decision_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  capsule_fingerprint TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL CHECK (to_state IN ('PAUSED', 'REVIEW_REQUIRED')),
  trigger_code TEXT NOT NULL,
  prior_evidence_preserved BOOLEAN NOT NULL CHECK (prior_evidence_preserved = TRUE),
  decided_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA strategy_lab TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA strategy_lab FROM customer_app;
