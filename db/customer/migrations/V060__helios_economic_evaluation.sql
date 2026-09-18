-- V060 HELIOS H32 — Economic evaluation and Microcapital Challenge durable records.
-- Measurement artifact only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_economic_experiment (
  experiment_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  state TEXT NOT NULL,
  frozen_hash TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  frozen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT helios_hexp_id_prefix CHECK (experiment_id LIKE 'hexp_%'),
  CONSTRAINT helios_hexp_state CHECK (state IN ('DRAFT', 'FROZEN', 'RUNNING', 'PAUSED', 'COMPLETED', 'ABORTED')),
  CONSTRAINT helios_hexp_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
    AND body_canonical NOT LIKE '%"PERFORMANCE_CLAIM_ALLOWED":true%'
  )
);

CREATE TABLE growth.helios_microcapital_challenge (
  challenge_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES growth.helios_economic_experiment (experiment_id),
  body_canonical TEXT NOT NULL,
  frozen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT helios_hmc_id_prefix CHECK (challenge_id LIKE 'hmc_%'),
  CONSTRAINT helios_hmc_catch_up_forbidden CHECK (
    body_canonical LIKE '%"catchUpModeForbidden":true%'
    AND body_canonical LIKE '%"targetIsExperimentOnly":true%'
    AND body_canonical NOT LIKE '%"PERFORMANCE_CLAIM_ALLOWED":true%'
  )
);

CREATE TABLE growth.helios_economic_evaluation_run (
  run_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES growth.helios_economic_experiment (experiment_id),
  customer_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT helios_herun_id_prefix CHECK (run_id LIKE 'herun_%'),
  CONSTRAINT helios_herun_outcome CHECK (outcome IN ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'STOPPED', 'LIQUIDATED', 'ABORTED')),
  CONSTRAINT helios_herun_not_deleted CHECK (
    body_canonical NOT LIKE '%"deleted":true%'
  )
);

CREATE TABLE growth.helios_economic_evaluation_report (
  report_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES growth.helios_economic_experiment (experiment_id),
  body_canonical TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT helios_herep_id_prefix CHECK (report_id LIKE 'herep_%'),
  CONSTRAINT helios_herep_claim_blocked CHECK (
    body_canonical LIKE '%"PERFORMANCE_CLAIM_ALLOWED":false%'
  )
);

CREATE INDEX helios_hexp_customer_idx ON growth.helios_economic_experiment (customer_id, frozen_at DESC);
CREATE INDEX helios_herun_experiment_idx ON growth.helios_economic_evaluation_run (experiment_id, started_at DESC);
CREATE INDEX helios_herep_experiment_idx ON growth.helios_economic_evaluation_report (experiment_id, generated_at DESC);

REVOKE ALL ON TABLE growth.helios_economic_experiment FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_microcapital_challenge FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_economic_evaluation_run FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_economic_evaluation_report FROM PUBLIC;

GRANT SELECT, INSERT ON TABLE growth.helios_economic_experiment TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_microcapital_challenge TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_economic_evaluation_run TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_economic_evaluation_report TO customer_app;

REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_economic_experiment FROM customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_microcapital_challenge FROM customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_economic_evaluation_run FROM customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_economic_evaluation_report FROM customer_app;
