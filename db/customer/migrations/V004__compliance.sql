-- V004 compliance screening fabric.
-- Provider-neutral screening metadata, AML profiles, alerts, fraud results,
-- velocity counters, cases, and human decisions. No raw PII. No article bodies.
-- Simulation only. Not a second Kernel, policy engine, identity system, or Evidence Vault.

CREATE SCHEMA IF NOT EXISTS compliance;

CREATE TABLE compliance.screening_result (
  screening_id TEXT PRIMARY KEY,
  screening_type TEXT NOT NULL CHECK (
    screening_type IN (
      'SANCTIONS',
      'PEP',
      'ADVERSE_MEDIA',
      'TRANSACTION_MONITORING',
      'FRAUD',
      'DEVICE_RISK'
    )
  ),
  subject_kind TEXT NOT NULL CHECK (
    subject_kind IN ('PERSON', 'BUSINESS', 'BENEFICIARY', 'COUNTERPARTY', 'DEVICE', 'ACCOUNT')
  ),
  subject_ref TEXT NOT NULL,
  provider_ref TEXT NOT NULL,
  provider_model TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('CLEAR', 'REVIEW', 'HOLD', 'BLOCK', 'UNAVAILABLE')),
  reason_codes TEXT[] NOT NULL,
  confidence INTEGER,
  score INTEGER,
  jurisdiction CHAR(2) NOT NULL,
  screened_at TIMESTAMPTZ NOT NULL,
  refresh_by TIMESTAMPTZ NOT NULL,
  evidence_refs TEXT[] NOT NULL,
  provider_hash TEXT NOT NULL,
  policy_version_id TEXT,
  stale BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE compliance.aml_profile (
  profile_id TEXT PRIMARY KEY,
  subject_ref TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  category TEXT NOT NULL CHECK (category IN ('LOW', 'STANDARD', 'ELEVATED', 'HIGH', 'PROHIBITED')),
  reason_codes TEXT[] NOT NULL,
  input_hash TEXT NOT NULL,
  jurisdiction CHAR(2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (subject_ref, version)
);

CREATE TABLE compliance.alert (
  alert_id TEXT PRIMARY KEY,
  alert_kind TEXT NOT NULL CHECK (
    alert_kind IN ('TRANSACTION_MONITORING', 'FRAUD', 'VELOCITY', 'SANCTIONS', 'PEP', 'AML')
  ),
  rule_id TEXT NOT NULL,
  legal_confidence TEXT NOT NULL CHECK (
    legal_confidence IN ('DRAFT', 'RESEARCH_REQUIRED', 'COUNSEL_REVIEWED', 'CONFIRMED_BY_COUNSEL')
  ),
  subject_ref TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reason_codes TEXT[] NOT NULL,
  journal_id TEXT,
  intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE compliance.fraud_result (
  evaluation_id TEXT PRIMARY KEY,
  subject_ref TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('ALLOW', 'STEP_UP', 'REVIEW', 'HOLD', 'BLOCK')),
  reason_codes TEXT[] NOT NULL,
  required_assurance TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL,
  policy_version_id TEXT
);

CREATE TABLE compliance.velocity_counter (
  counter_key TEXT PRIMARY KEY,
  window_ms BIGINT NOT NULL CHECK (window_ms > 0),
  count BIGINT NOT NULL CHECK (count >= 0),
  amount_minor TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE compliance.case_record (
  case_id TEXT PRIMARY KEY,
  case_type TEXT NOT NULL CHECK (
    case_type IN (
      'SANCTIONS_REVIEW',
      'PEP_REVIEW',
      'AML_ALERT',
      'FRAUD_ALERT',
      'TRANSACTION_MONITORING_ALERT'
    )
  ),
  status TEXT NOT NULL CHECK (
    status IN ('OPEN', 'ASSIGNED', 'IN_REVIEW', 'ESCALATED', 'CLEARED', 'BLOCKED', 'CLOSED')
  ),
  finality TEXT NOT NULL CHECK (finality IN ('NON_FINAL', 'FINAL_HARD_BLOCK', 'FINAL_CLEARED')),
  reason_codes TEXT[] NOT NULL,
  origin_refs TEXT[] NOT NULL,
  subject_ref TEXT NOT NULL,
  counterparty_ref TEXT,
  jurisdiction CHAR(2) NOT NULL,
  policy_version_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  owner_ref TEXT
);

CREATE TABLE compliance.human_decision (
  decision_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES compliance.case_record (case_id),
  decision TEXT NOT NULL CHECK (decision IN ('CLEAR', 'CONTINUE_MONITORING', 'RESTRICT', 'BLOCK')),
  operator_ref TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('HUMAN_OPERATOR', 'AGENT', 'AI')),
  reason TEXT NOT NULL,
  evidence_refs TEXT[] NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE compliance.provider_health (
  provider_id TEXT PRIMARY KEY,
  available BOOLEAN NOT NULL,
  last_checked_at TIMESTAMPTZ NOT NULL,
  last_error_code TEXT
);

CREATE TABLE compliance.counterparty_fact (
  counterparty_ref TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('PERSON', 'BUSINESS', 'BENEFICIARY', 'COUNTERPARTY')),
  jurisdiction CHAR(2),
  latest_sanctions_id TEXT,
  latest_pep_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

REVOKE ALL ON SCHEMA compliance FROM PUBLIC;
GRANT USAGE ON SCHEMA compliance TO customer_app;

REVOKE ALL ON TABLE compliance.screening_result FROM PUBLIC;
REVOKE ALL ON TABLE compliance.aml_profile FROM PUBLIC;
REVOKE ALL ON TABLE compliance.alert FROM PUBLIC;
REVOKE ALL ON TABLE compliance.fraud_result FROM PUBLIC;
REVOKE ALL ON TABLE compliance.velocity_counter FROM PUBLIC;
REVOKE ALL ON TABLE compliance.case_record FROM PUBLIC;
REVOKE ALL ON TABLE compliance.human_decision FROM PUBLIC;
REVOKE ALL ON TABLE compliance.provider_health FROM PUBLIC;
REVOKE ALL ON TABLE compliance.counterparty_fact FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE compliance.screening_result TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE compliance.aml_profile TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE compliance.alert TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE compliance.fraud_result TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE compliance.velocity_counter TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE compliance.case_record TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE compliance.human_decision TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE compliance.provider_health TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE compliance.counterparty_fact TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE compliance.screening_result FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE compliance.aml_profile FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE compliance.alert FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE compliance.fraud_result FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE compliance.velocity_counter FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE compliance.case_record FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE compliance.human_decision FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE compliance.provider_health FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE compliance.counterparty_fact FROM customer_app;
