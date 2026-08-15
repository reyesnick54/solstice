-- V016 Canonical Model Registry.
-- Metadata and hash-addressable artifacts only. No executable model code.
-- Simulation approval only. No LIVE_APPROVED.

CREATE SCHEMA IF NOT EXISTS model_registry;

CREATE TABLE model_registry.artifact (
  artifact_ref TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('CONFIGURATION', 'FORMULA', 'FEATURE_SET', 'WEIGHTS_REFERENCE')),
  description TEXT NOT NULL,
  simulation_only BOOLEAN NOT NULL CHECK (simulation_only = TRUE),
  CONSTRAINT model_artifact_ref_prefix CHECK (artifact_ref LIKE 'mar_%')
);

CREATE TABLE model_registry.model_version (
  model_id TEXT NOT NULL,
  version TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'RISK_MODEL',
    'PORTFOLIO_MODEL',
    'FORECAST_MODEL',
    'SIGNAL_MODEL',
    'RANKING_MODEL',
    'AI_MODEL_REFERENCE'
  )),
  description TEXT NOT NULL,
  owner TEXT NOT NULL,
  input_schema TEXT NOT NULL,
  output_schema TEXT NOT NULL,
  determinism TEXT NOT NULL CHECK (determinism IN ('DETERMINISTIC', 'NON_DETERMINISTIC')),
  artifact_ref TEXT NOT NULL REFERENCES model_registry.artifact (artifact_ref),
  configuration_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN (
    'DRAFT',
    'VALIDATION_REQUIRED',
    'VALIDATED_FOR_SIMULATION',
    'APPROVED_FOR_SIMULATION',
    'REJECTED',
    'RETIRED'
  )),
  applicable_domain TEXT NOT NULL,
  simulation_only BOOLEAN NOT NULL CHECK (simulation_only = TRUE),
  live_approved BOOLEAN NOT NULL CHECK (live_approved = FALSE),
  body_canonical TEXT NOT NULL,
  PRIMARY KEY (model_id, version),
  CONSTRAINT model_id_prefix CHECK (model_id LIKE 'mdl_%'),
  CONSTRAINT model_no_executable CHECK (
    configuration_canonical NOT LIKE '%eval(%'
    AND configuration_canonical NOT LIKE '%new Function%'
    AND configuration_canonical NOT LIKE '%child_process%'
  ),
  CONSTRAINT model_no_live_approved CHECK (lifecycle <> 'LIVE_APPROVED')
);

CREATE TABLE model_registry.validation (
  validation_id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PASSED_SIMULATION', 'FAILED', 'INCONCLUSIVE', 'INSUFFICIENT_EVIDENCE')),
  reviewer TEXT NOT NULL,
  reviewer_kind TEXT NOT NULL CHECK (reviewer_kind = 'HUMAN_OPERATOR'),
  timestamp TIMESTAMPTZ NOT NULL,
  claims_real_world_performance BOOLEAN NOT NULL CHECK (claims_real_world_performance = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT model_validation_id_prefix CHECK (validation_id LIKE 'mvn_%')
);

CREATE TABLE model_registry.approval (
  model_id TEXT NOT NULL,
  version TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind = 'HUMAN_OPERATOR'),
  reason TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (model_id, version, actor_id, approved_at),
  CONSTRAINT model_approval_no_self CHECK (actor_id NOT LIKE 'mdl_%')
);

REVOKE ALL ON SCHEMA model_registry FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA model_registry FROM PUBLIC;

GRANT USAGE ON SCHEMA model_registry TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA model_registry TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA model_registry FROM customer_app;
