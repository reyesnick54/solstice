-- V070 HELIOS Multi-Asset M21 — Universal multi-asset execution plan persistence.
-- Planning records only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_execution_plan (
  execution_plan_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  status TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_xplan_id_prefix CHECK (execution_plan_id LIKE 'xplan_%'),
  CONSTRAINT helios_xplan_work_order_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT helios_xplan_status CHECK (status IN (
    'DRAFT', 'RISK_APPROVED', 'COMPLIANCE_APPROVED', 'AUTHORIZED',
    'READY_FOR_ROUTING', 'ROUTED', 'PARTIALLY_EXECUTED', 'EXECUTED',
    'CANCELLED', 'EXPIRED', 'REJECTED', 'RECONCILIATION_REQUIRED'
  )),
  CONSTRAINT helios_xplan_no_live CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
  )
);

CREATE INDEX helios_xplan_customer_idx ON growth.helios_execution_plan (customer_id, updated_at DESC);
CREATE INDEX helios_xplan_work_order_idx ON growth.helios_execution_plan (work_order_id, created_at DESC);

CREATE TABLE growth.helios_execution_plan_transition (
  transition_id TEXT PRIMARY KEY,
  execution_plan_id TEXT NOT NULL REFERENCES growth.helios_execution_plan (execution_plan_id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  transitioned_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_xpt_id_prefix CHECK (transition_id LIKE 'xpt_%'),
  CONSTRAINT helios_xpt_unique_transition UNIQUE (execution_plan_id, to_status, idempotency_key)
);

CREATE INDEX helios_xpt_plan_idx ON growth.helios_execution_plan_transition (execution_plan_id, transitioned_at ASC);

REVOKE ALL ON TABLE growth.helios_execution_plan FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_execution_plan TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_execution_plan FROM customer_app;

REVOKE ALL ON TABLE growth.helios_execution_plan_transition FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_execution_plan_transition TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_execution_plan_transition FROM customer_app;
