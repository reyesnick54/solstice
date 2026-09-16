-- V048 HELIOS Phase 2 H06 — durable work execution and research budgets.
-- Growth Orchestrator owner. Research budget only; not customer capital ledger.
-- Not Execution Authority. Production remains inactive.
-- H05 authority binding uses growth.economic_work_order (V047); execution uses a separate table.

CREATE TABLE growth.helios_execution_work_order (
  work_order_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  state TEXT NOT NULL,
  objective TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_execution_work_order_id_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT helios_execution_program_id_prefix CHECK (program_id LIKE 'hpg_%'),
  CONSTRAINT helios_execution_work_order_state CHECK (state IN (
    'DRAFT', 'ACTIVE', 'PAUSED', 'BLOCKED_BUDGET', 'BLOCKED_AUTHORITY', 'CANCELLED', 'COMPLETED'
  )),
  CONSTRAINT helios_execution_work_order_no_ea CHECK (body_canonical NOT LIKE '%ExecutionAuthority%')
);

CREATE INDEX helios_execution_work_order_customer_idx ON growth.helios_execution_work_order (customer_id, state);

CREATE TABLE growth.helios_work_task (
  task_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES growth.helios_execution_work_order (work_order_id),
  customer_id TEXT NOT NULL,
  operation_identity TEXT NOT NULL,
  state TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  lease_generation INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_task_id_prefix CHECK (task_id LIKE 'htk_%'),
  CONSTRAINT helios_task_state CHECK (state IN (
    'QUEUED', 'CLAIMABLE', 'RUNNING', 'WAITING', 'RETRYABLE_FAILURE',
    'BLOCKED', 'COMPLETED', 'CANCELLED', 'PERMANENTLY_FAILED'
  )),
  CONSTRAINT helios_task_operation_unique UNIQUE (work_order_id, operation_identity)
);

CREATE INDEX helios_task_work_order_idx ON growth.helios_work_task (work_order_id, state);
CREATE INDEX helios_task_claim_idx ON growth.helios_work_task (state, locked_at) WHERE state IN ('CLAIMABLE', 'QUEUED', 'RUNNING');

CREATE TABLE growth.research_budget_reservation (
  reservation_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES growth.helios_execution_work_order (work_order_id),
  task_id TEXT NOT NULL REFERENCES growth.helios_work_task (task_id),
  customer_id TEXT NOT NULL,
  unit_kind TEXT NOT NULL,
  reserved_amount NUMERIC(38, 0) NOT NULL,
  reconciled_amount NUMERIC(38, 0),
  released_amount NUMERIC(38, 0),
  state TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_reservation_id_prefix CHECK (reservation_id LIKE 'rbr_%'),
  CONSTRAINT helios_reservation_state CHECK (state IN ('ACTIVE', 'RECONCILED', 'RELEASED'))
);

CREATE TABLE growth.research_spend_record (
  spend_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES growth.helios_execution_work_order (work_order_id),
  task_id TEXT NOT NULL REFERENCES growth.helios_work_task (task_id),
  customer_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  budget_category TEXT NOT NULL,
  reserved_amount NUMERIC(38, 0) NOT NULL,
  actual_amount NUMERIC(38, 0),
  estimated_amount NUMERIC(38, 0),
  cost_status TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  retry_caused_additional_cost BOOLEAN NOT NULL,
  succeeded BOOLEAN NOT NULL,
  body_canonical TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_spend_id_prefix CHECK (spend_id LIKE 'rsp_%'),
  CONSTRAINT helios_spend_cost_status CHECK (cost_status IN ('ACTUAL', 'ESTIMATED', 'UNKNOWN'))
);

CREATE INDEX helios_spend_customer_idx ON growth.research_spend_record (customer_id, work_order_id);

REVOKE ALL ON TABLE growth.helios_execution_work_order FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_work_task FROM PUBLIC;
REVOKE ALL ON TABLE growth.research_budget_reservation FROM PUBLIC;
REVOKE ALL ON TABLE growth.research_spend_record FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_execution_work_order TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_work_task TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.research_budget_reservation TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.research_spend_record TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE growth.helios_execution_work_order FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_work_task FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.research_budget_reservation FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.research_spend_record FROM customer_app;
