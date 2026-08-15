-- V013 Regulatory Digital Twin simulation artifacts.
-- Not a second policy store, Kernel, or ledger.
-- Rows are simulation evidence references only.

CREATE SCHEMA IF NOT EXISTS regulatory_twin;

CREATE TABLE regulatory_twin.twin (
  twin_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  label TEXT NOT NULL,
  CONSTRAINT rdt_twin_id_prefix CHECK (twin_id LIKE 'rtw_%')
);

CREATE TABLE regulatory_twin.snapshot (
  snapshot_id TEXT PRIMARY KEY,
  twin_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT rdt_snapshot_id_prefix CHECK (snapshot_id LIKE 'rsn_%'),
  CONSTRAINT rdt_snapshot_simulation CHECK (body_canonical LIKE '%"simulationOnly":true%')
);

CREATE TABLE regulatory_twin.scenario (
  scenario_id TEXT PRIMARY KEY,
  suite_id TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  invariant BOOLEAN NOT NULL,
  subject_ref TEXT,
  body_canonical TEXT NOT NULL,
  CONSTRAINT rdt_scenario_id_prefix CHECK (scenario_id LIKE 'rsc_%'),
  CONSTRAINT rdt_scenario_no_raw_pii CHECK (
    body_canonical NOT LIKE '%"ssn"%'
    AND body_canonical NOT LIKE '%"passport"%'
  )
);

CREATE TABLE regulatory_twin.scenario_run (
  run_id TEXT PRIMARY KEY,
  scenario_id TEXT,
  baseline_snapshot_id TEXT,
  candidate_set_id TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT rdt_run_id_prefix CHECK (run_id LIKE 'rrn_%'),
  CONSTRAINT rdt_run_no_raw_pii CHECK (
    body_canonical NOT LIKE '%"ssn"%'
    AND body_canonical NOT LIKE '%"passport"%'
  )
);

CREATE TABLE regulatory_twin.suite (
  suite_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  invariant BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT rdt_suite_id_prefix CHECK (suite_id LIKE 'rss_%')
);

CREATE TABLE regulatory_twin.candidate_set (
  candidate_set_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  legal_review_status TEXT NOT NULL,
  notes TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT rdt_candidate_id_prefix CHECK (candidate_set_id LIKE 'cps_%'),
  CONSTRAINT rdt_candidate_no_counsel CHECK (legal_review_status <> 'CONFIRMED_BY_COUNSEL')
);

CREATE TABLE regulatory_twin.assumption (
  assumption_id TEXT PRIMARY KEY,
  jurisdiction TEXT NOT NULL,
  subject TEXT NOT NULL,
  proposition TEXT NOT NULL,
  legal_review_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  owner_ref TEXT NOT NULL,
  reviewer_ref TEXT,
  superseded_by TEXT,
  body_canonical TEXT NOT NULL,
  CONSTRAINT rdt_assumption_id_prefix CHECK (assumption_id LIKE 'ras_%'),
  CONSTRAINT rdt_assumption_no_auto_counsel CHECK (legal_review_status <> 'CONFIRMED_BY_COUNSEL')
);

CREATE TABLE regulatory_twin.impact_report (
  report_id TEXT PRIMARY KEY,
  twin_id TEXT NOT NULL,
  baseline_snapshot_id TEXT NOT NULL,
  candidate_set_id TEXT NOT NULL,
  suite_id TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT rdt_report_id_prefix CHECK (report_id LIKE 'rir_%'),
  CONSTRAINT rdt_report_simulation CHECK (body_canonical LIKE '%"simulationOnly":true%')
);

CREATE TABLE regulatory_twin.readiness_assessment (
  assessment_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  state TEXT NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT rdt_assessment_id_prefix CHECK (assessment_id LIKE 'rra_%'),
  CONSTRAINT rdt_assessment_no_legal_approval CHECK (body_canonical NOT LIKE '%LEGALLY_APPROVED%')
);

CREATE TABLE regulatory_twin.disposition (
  review_id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  disposition TEXT NOT NULL,
  decided_by_kind TEXT NOT NULL,
  decided_by_ref TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  notes TEXT NOT NULL,
  CONSTRAINT rdt_review_id_prefix CHECK (review_id LIKE 'rrv_%'),
  CONSTRAINT rdt_disposition_human CHECK (decided_by_kind = 'HUMAN_OPERATOR')
);

REVOKE ALL ON SCHEMA regulatory_twin FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA regulatory_twin FROM PUBLIC;

GRANT USAGE ON SCHEMA regulatory_twin TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA regulatory_twin TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA regulatory_twin FROM customer_app;
