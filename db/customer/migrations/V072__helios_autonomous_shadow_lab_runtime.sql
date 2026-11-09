-- V072 HELIOS OPS01 — durable autonomous shadow lab runtime persistence.
-- Research / shadow only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_shadow_lab_campaign (
  campaign_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_campaign_id_prefix CHECK (campaign_id LIKE 'camp_%'),
  CONSTRAINT helios_shadow_lab_campaign_simulation CHECK (
    body_canonical NOT LIKE '%"liveTrading":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
  )
);

CREATE TABLE growth.helios_shadow_lab_strategy_version (
  strategy_version_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES growth.helios_shadow_lab_campaign (campaign_id),
  strategy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  freeze_hash TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_strategy_version_id_prefix CHECK (strategy_version_id LIKE 'svv_%'),
  UNIQUE (campaign_id, strategy_id, version)
);

CREATE TABLE growth.helios_shadow_lab_campaign_lifecycle (
  lifecycle_event_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES growth.helios_shadow_lab_campaign (campaign_id),
  event_kind TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_lifecycle_id_prefix CHECK (lifecycle_event_id LIKE 'slev_%')
);

CREATE TABLE growth.helios_shadow_lab_campaign_lease (
  campaign_id TEXT PRIMARY KEY REFERENCES growth.helios_shadow_lab_campaign (campaign_id),
  worker_id TEXT NOT NULL,
  fencing_token BIGINT NOT NULL CHECK (fencing_token >= 1),
  acquired_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE growth.helios_shadow_lab_sealed_decision (
  decision_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES growth.helios_shadow_lab_campaign (campaign_id),
  strategy_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  knowable_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_decision_id_prefix CHECK (decision_id LIKE 'sdec_%'),
  CONSTRAINT helios_shadow_lab_decision_no_live CHECK (
    body_canonical NOT LIKE '%"liveExecution":true%'
  )
);

CREATE TABLE growth.helios_shadow_lab_decision_evidence (
  evidence_hash TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL UNIQUE REFERENCES growth.helios_shadow_lab_sealed_decision (decision_id),
  campaign_id TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  sealed_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_evidence_hash_len CHECK (char_length(evidence_hash) = 64)
);

CREATE TABLE growth.helios_shadow_lab_pending_outcome (
  outcome_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL REFERENCES growth.helios_shadow_lab_sealed_decision (decision_id),
  campaign_id TEXT NOT NULL,
  matures_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT helios_shadow_lab_pending_outcome_id_prefix CHECK (outcome_id LIKE 'sout_%')
);

CREATE TABLE growth.helios_shadow_lab_matured_outcome (
  outcome_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL UNIQUE REFERENCES growth.helios_shadow_lab_sealed_decision (decision_id),
  campaign_id TEXT NOT NULL,
  matured_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT helios_shadow_lab_matured_outcome_id_prefix CHECK (outcome_id LIKE 'smat_%')
);

CREATE TABLE growth.helios_shadow_lab_shadow_position (
  position_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_position_id_prefix CHECK (position_id LIKE 'spos_%'),
  CONSTRAINT helios_shadow_lab_position_shadow_only CHECK (
    body_canonical LIKE '%"environment":"SHADOW"%'
  )
);

CREATE TABLE growth.helios_shadow_lab_shadow_cash (
  campaign_id TEXT PRIMARY KEY REFERENCES growth.helios_shadow_lab_campaign (campaign_id),
  cash_minor TEXT NOT NULL,
  deployed_minor TEXT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE growth.helios_shadow_lab_shadow_fill (
  fill_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  decision_id TEXT NOT NULL REFERENCES growth.helios_shadow_lab_sealed_decision (decision_id),
  body_canonical TEXT NOT NULL,
  filled_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_fill_id_prefix CHECK (fill_id LIKE 'sfil_%')
);

CREATE TABLE growth.helios_shadow_lab_benchmark (
  benchmark_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_benchmark_id_prefix CHECK (benchmark_id LIKE 'sbm_%')
);

CREATE TABLE growth.helios_shadow_lab_evidence_state (
  campaign_id TEXT PRIMARY KEY REFERENCES growth.helios_shadow_lab_campaign (campaign_id),
  chain_head_hash TEXT NOT NULL,
  decision_count INTEGER NOT NULL CHECK (decision_count >= 0),
  body_canonical TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE growth.helios_shadow_lab_demotion_event (
  demotion_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  demoted_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_demotion_id_prefix CHECK (demotion_id LIKE 'sdem_%')
);

CREATE TABLE growth.helios_shadow_lab_daily_report (
  report_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  report_day DATE NOT NULL,
  body_canonical TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_daily_report_id_prefix CHECK (report_id LIKE 'srpd_%'),
  UNIQUE (campaign_id, report_day)
);

CREATE TABLE growth.helios_shadow_lab_weekly_report (
  report_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  body_canonical TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_weekly_report_id_prefix CHECK (report_id LIKE 'srpw_%'),
  UNIQUE (campaign_id, week_start)
);

CREATE TABLE growth.helios_shadow_lab_checkpoint (
  checkpoint_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  sealed_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_checkpoint_id_prefix CHECK (checkpoint_id LIKE 'schk_%')
);

CREATE TABLE growth.helios_shadow_lab_incident (
  incident_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  CONSTRAINT helios_shadow_lab_incident_id_prefix CHECK (incident_id LIKE 'sinc_%')
);

CREATE TABLE growth.helios_shadow_lab_outbox (
  event_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PENDING', 'IN_FLIGHT', 'DELIVERED', 'DEAD_LETTER')),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_shadow_lab_outbox_id_prefix CHECK (event_id LIKE 'sevt_%'),
  CONSTRAINT helios_shadow_lab_outbox_not_journal CHECK (body_canonical NOT LIKE '%Ledger.postJournal%')
);

CREATE INDEX helios_shadow_lab_decision_campaign_idx
  ON growth.helios_shadow_lab_sealed_decision (campaign_id, recorded_at ASC);

CREATE INDEX helios_shadow_lab_pending_outcome_matures_idx
  ON growth.helios_shadow_lab_pending_outcome (matures_at ASC);

CREATE INDEX helios_shadow_lab_outbox_pending_idx
  ON growth.helios_shadow_lab_outbox (state, created_at ASC)
  WHERE state = 'PENDING';

REVOKE ALL ON TABLE growth.helios_shadow_lab_campaign FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_strategy_version FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_campaign_lifecycle FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_campaign_lease FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_sealed_decision FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_decision_evidence FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_pending_outcome FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_matured_outcome FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_shadow_position FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_shadow_cash FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_shadow_fill FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_benchmark FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_evidence_state FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_demotion_event FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_daily_report FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_weekly_report FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_checkpoint FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_incident FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_shadow_lab_outbox FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_shadow_lab_campaign TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_shadow_lab_strategy_version TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_shadow_lab_campaign_lifecycle TO customer_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE growth.helios_shadow_lab_campaign_lease TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_shadow_lab_sealed_decision TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_shadow_lab_decision_evidence TO customer_app;
GRANT SELECT, INSERT, DELETE ON TABLE growth.helios_shadow_lab_pending_outcome TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_shadow_lab_matured_outcome TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_shadow_lab_shadow_position TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_shadow_lab_shadow_cash TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_shadow_lab_shadow_fill TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_shadow_lab_benchmark TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_shadow_lab_evidence_state TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_shadow_lab_demotion_event TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_shadow_lab_daily_report TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_shadow_lab_weekly_report TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_shadow_lab_checkpoint TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_shadow_lab_incident TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_shadow_lab_outbox TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_campaign FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_strategy_version FROM customer_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_campaign_lifecycle FROM customer_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_sealed_decision FROM customer_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_decision_evidence FROM customer_app;
REVOKE UPDATE, TRUNCATE ON TABLE growth.helios_shadow_lab_pending_outcome FROM customer_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_matured_outcome FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_shadow_fill FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_benchmark FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_demotion_event FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_daily_report FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_weekly_report FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_shadow_lab_checkpoint FROM customer_app;
