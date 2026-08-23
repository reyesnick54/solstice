-- V036 Phase E Prompt 5 — Grow execution, proposals, recurring mandates,
-- monitoring, and performance read models.
-- Planning and execution records only. Not a second ledger, mint, or
-- Execution Authority. Production remains inactive.

CREATE TABLE growth.financial_proposal (
  proposal_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  subject_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  state TEXT NOT NULL,
  proposal_type TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  PRIMARY KEY (proposal_id, version),
  CONSTRAINT growth_proposal_id_prefix CHECK (proposal_id LIKE 'fpr_%'),
  CONSTRAINT growth_proposal_no_guaranteed_return CHECK (
    body_canonical NOT LIKE '%guaranteedReturn%'
    AND body_canonical NOT LIKE '%guaranteed_return%'
    AND body_canonical NOT LIKE '%certain profit%'
  ),
  CONSTRAINT growth_proposal_client_untrusted CHECK (
    body_canonical LIKE '%"clientInstructionsTrusted":false%'
  )
);

CREATE TABLE growth.proposal_approval (
  approval_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  proposal_version INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  authentication_assurance TEXT NOT NULL,
  step_up_satisfied BOOLEAN NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT growth_approval_id_prefix CHECK (approval_id LIKE 'gap_%'),
  CONSTRAINT growth_approval_human_only CHECK (actor_kind IN ('CUSTOMER', 'HUMAN_OPERATOR'))
);

CREATE TABLE growth.execution_command (
  command_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  proposal_version INTEGER NOT NULL,
  customer_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  domain TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT growth_command_id_prefix CHECK (command_id LIKE 'gxc_%'),
  CONSTRAINT growth_command_idempotency UNIQUE (idempotency_key),
  CONSTRAINT growth_command_client_untrusted CHECK (
    body_canonical LIKE '%"clientBodyTrusted":false%'
  )
);

CREATE TABLE growth.execution_record (
  execution_id TEXT PRIMARY KEY,
  command_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  state TEXT NOT NULL,
  filled_minor_units NUMERIC(38, 0) NOT NULL,
  requested_minor_units NUMERIC(38, 0) NOT NULL,
  authority_id TEXT,
  ledger_journal_id TEXT,
  provider_id TEXT,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT growth_execution_id_prefix CHECK (execution_id LIKE 'gxe_%'),
  CONSTRAINT growth_execution_state CHECK (state IN (
    'AUTHORIZED', 'QUEUED', 'SUBMITTED', 'PROCESSING', 'PARTIALLY_COMPLETED',
    'COMPLETED', 'FAILED', 'CANCELLED', 'REVERSED', 'REQUIRES_REVIEW'
  )),
  CONSTRAINT growth_execution_not_a_journal CHECK (
    body_canonical NOT LIKE '%"postJournal"%'
  )
);

CREATE TABLE growth.recurring_mandate (
  recurring_mandate_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount_minor_units NUMERIC(38, 0) NOT NULL,
  currency CHAR(3) NOT NULL,
  frequency TEXT NOT NULL,
  state TEXT NOT NULL,
  max_amount_minor_units NUMERIC(38, 0) NOT NULL,
  agent_may_increase_amount BOOLEAN NOT NULL CHECK (agent_may_increase_amount = FALSE),
  perpetual_authorization BOOLEAN NOT NULL CHECK (perpetual_authorization = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT growth_recurring_id_prefix CHECK (recurring_mandate_id LIKE 'grm_%')
);

CREATE TABLE growth.activated_plan (
  activated_plan_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  plan_version INTEGER NOT NULL,
  subject_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT growth_activated_plan_id_prefix CHECK (activated_plan_id LIKE 'gapl_%')
);

CREATE TABLE growth.monitoring_cycle (
  cycle_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  silent_investment_change BOOLEAN NOT NULL CHECK (silent_investment_change = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT growth_monitor_id_prefix CHECK (cycle_id LIKE 'gmc_%')
);

CREATE TABLE growth.performance_read_model (
  subject_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  deposits_are_not_performance BOOLEAN NOT NULL CHECK (deposits_are_not_performance = TRUE),
  body_canonical TEXT NOT NULL,
  PRIMARY KEY (subject_id, plan_id)
);

REVOKE ALL ON TABLE growth.financial_proposal FROM PUBLIC;
REVOKE ALL ON TABLE growth.proposal_approval FROM PUBLIC;
REVOKE ALL ON TABLE growth.execution_command FROM PUBLIC;
REVOKE ALL ON TABLE growth.execution_record FROM PUBLIC;
REVOKE ALL ON TABLE growth.recurring_mandate FROM PUBLIC;
REVOKE ALL ON TABLE growth.activated_plan FROM PUBLIC;
REVOKE ALL ON TABLE growth.monitoring_cycle FROM PUBLIC;
REVOKE ALL ON TABLE growth.performance_read_model FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE growth.financial_proposal TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.proposal_approval TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.execution_command TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.execution_record TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.recurring_mandate TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.activated_plan TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.monitoring_cycle TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.performance_read_model TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE growth.financial_proposal FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.proposal_approval FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.execution_command FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.execution_record FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.recurring_mandate FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.activated_plan FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.monitoring_cycle FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.performance_read_model FROM customer_app;
