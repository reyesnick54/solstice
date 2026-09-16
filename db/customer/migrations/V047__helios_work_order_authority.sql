-- V047 HELIOS H05 — Economic Work Order authority binding references.
-- Durable foreign identifiers and minimal evaluation evidence only.
-- Not a second mandate, capability engine, or Execution Authority.

CREATE TABLE growth.economic_work_order (
  work_order_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  grow_objective_id TEXT NOT NULL,
  state TEXT NOT NULL,
  mandate_id TEXT NOT NULL,
  mandate_version INTEGER NOT NULL,
  mandate_snapshot_hash TEXT NOT NULL,
  approval_binding_id TEXT,
  approval_scope_hash TEXT,
  required_approval_class TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  requested_scope_canonical TEXT NOT NULL,
  effective_scope_canonical TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ,
  CONSTRAINT helios_work_order_id_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT helios_work_order_no_execution_authority CHECK (
    requested_scope_canonical NOT LIKE '%grantsExecutionAuthority%'
    AND requested_scope_canonical NOT LIKE '%authorizesFinancialExecution%'
  )
);

CREATE TABLE growth.work_order_authority_decision (
  decision_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES growth.economic_work_order(work_order_id),
  customer_id TEXT NOT NULL,
  checkpoint TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reason_codes TEXT[] NOT NULL,
  mandate_snapshot_hash TEXT NOT NULL,
  capability_context_version TEXT,
  approval_scope_hash TEXT,
  requested_scope_canonical TEXT NOT NULL,
  effective_scope_canonical TEXT,
  narrowed_elements_canonical TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  actor_id TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'simulation',
  CONSTRAINT helios_binding_decision_id_prefix CHECK (decision_id LIKE 'abd_%'),
  CONSTRAINT helios_binding_environment_simulation CHECK (environment = 'simulation')
);

CREATE INDEX helios_work_order_customer_idx ON growth.economic_work_order (customer_id);
CREATE INDEX helios_binding_decision_work_order_idx ON growth.work_order_authority_decision (work_order_id);
