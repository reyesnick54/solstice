-- V015 Canonical investment Risk Engine.
-- Deterministic paper-portfolio facts only. Not a second Kernel or ledger.
-- Limits are engineering/simulation controls, not regulatory requirements.

CREATE SCHEMA IF NOT EXISTS risk;

CREATE TABLE risk.budget (
  budget_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  portfolio_id TEXT NOT NULL,
  version TEXT NOT NULL,
  review_by TIMESTAMPTZ NOT NULL,
  engineering_only BOOLEAN NOT NULL CHECK (engineering_only = TRUE),
  cannot_loosen_mandate BOOLEAN NOT NULL CHECK (cannot_loosen_mandate = TRUE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT risk_budget_id_prefix CHECK (budget_id LIKE 'rbdg_%'),
  CONSTRAINT risk_budget_no_apy CHECK (
    body_canonical NOT LIKE '%apy%'
    AND body_canonical NOT LIKE '%APR%'
    AND body_canonical NOT LIKE '%blendedYield%'
  )
);

CREATE TABLE risk.limit_record (
  limit_id TEXT PRIMARY KEY,
  dimension TEXT NOT NULL,
  priority TEXT NOT NULL,
  engineering_only BOOLEAN NOT NULL CHECK (engineering_only = TRUE),
  regulatory_requirement BOOLEAN NOT NULL CHECK (regulatory_requirement = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT risk_limit_id_prefix CHECK (limit_id LIKE 'rlim_%')
);

CREATE TABLE risk.portfolio_snapshot (
  snapshot_id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  currency CHAR(3) NOT NULL,
  brokerage_cash_minor BIGINT NOT NULL,
  simulation_only BOOLEAN NOT NULL CHECK (simulation_only = TRUE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT risk_snapshot_id_prefix CHECK (snapshot_id LIKE 'prs_%')
);

CREATE TABLE risk.assessment (
  assessment_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  proposed_action_ref TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('ALLOW_SIMULATION', 'REQUIRE_REVIEW', 'BLOCK', 'INSUFFICIENT_DATA')),
  generated_at TIMESTAMPTZ NOT NULL,
  guaranteed_outcome BOOLEAN NOT NULL CHECK (guaranteed_outcome = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT risk_assessment_id_prefix CHECK (assessment_id LIKE 'ras_%')
);

CREATE TABLE risk.stress_scenario (
  scenario_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  version TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source = 'ENGINEERING_FIXTURE'),
  status TEXT NOT NULL CHECK (status = 'ACTIVE_SIMULATION'),
  predictive_claim BOOLEAN NOT NULL CHECK (predictive_claim = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT risk_scenario_id_prefix CHECK (scenario_id LIKE 'ssc_%')
);

CREATE TABLE risk.stress_run (
  run_id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  estimated_loss_minor BIGINT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  mutates_financial_state BOOLEAN NOT NULL CHECK (mutates_financial_state = FALSE),
  places_orders BOOLEAN NOT NULL CHECK (places_orders = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT risk_run_id_prefix CHECK (run_id LIKE 'srun_%')
);

REVOKE ALL ON SCHEMA risk FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA risk FROM PUBLIC;

GRANT USAGE ON SCHEMA risk TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA risk TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA risk FROM customer_app;
