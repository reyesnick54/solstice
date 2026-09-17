-- V052 HELIOS H14 — paper Grow strategy lifecycle persistence.
-- Paper positions and results only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_paper_strategy_proposal (
  proposal_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  state TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_paper_proposal_id_prefix CHECK (proposal_id LIKE 'hpp_%'),
  CONSTRAINT helios_paper_proposal_work_order_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT helios_paper_proposal_environment CHECK (body_canonical LIKE '%"environment":"PAPER"%'),
  CONSTRAINT helios_paper_proposal_no_financial_effect CHECK (
    body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
  )
);

CREATE TABLE growth.helios_paper_strategy_position (
  position_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  status TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  CONSTRAINT helios_paper_position_id_prefix CHECK (position_id LIKE 'hpos_%'),
  CONSTRAINT helios_paper_position_work_order_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT helios_paper_position_paper_only CHECK (body_canonical LIKE '%"environment":"PAPER"%'),
  CONSTRAINT helios_paper_position_not_live CHECK (body_canonical LIKE '%"liveProviderPosition":false%')
);

CREATE TABLE growth.helios_paper_strategy_cycle (
  cycle_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_paper_cycle_id_prefix CHECK (cycle_id LIKE 'hcyc_%'),
  CONSTRAINT helios_paper_cycle_work_order_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT helios_paper_cycle_attribution CHECK (body_canonical LIKE '%"attributionClass":"PAPER"%')
);

CREATE TABLE growth.helios_paper_strategy_completed_task (
  task_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_paper_completed_task_work_order_prefix CHECK (work_order_id LIKE 'ewo_%')
);

CREATE INDEX helios_paper_proposal_customer_idx
  ON growth.helios_paper_strategy_proposal (customer_id, state);

CREATE INDEX helios_paper_position_customer_idx
  ON growth.helios_paper_strategy_position (customer_id, status);

CREATE INDEX helios_paper_cycle_customer_idx
  ON growth.helios_paper_strategy_cycle (customer_id, completed_at DESC);

REVOKE ALL ON TABLE growth.helios_paper_strategy_proposal FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_paper_strategy_position FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_paper_strategy_cycle FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_paper_strategy_completed_task FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_paper_strategy_proposal TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_paper_strategy_position TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_paper_strategy_cycle TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_paper_strategy_completed_task TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE growth.helios_paper_strategy_proposal FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_paper_strategy_position FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_paper_strategy_cycle FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_paper_strategy_completed_task FROM customer_app;
