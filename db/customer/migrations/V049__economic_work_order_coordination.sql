-- V049 HELIOS H04 — Economic Work Order durable coordination aggregate.
-- Coordination envelope only. Not a ledger, mint, Execution Authority, or balance.
-- V047 (H05 authority binding) owns growth.economic_work_order; H04 persists here.

CREATE TABLE growth.economic_work_order_coordination (
  work_order_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  state TEXT NOT NULL,
  revision INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'simulation',
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT growth_work_order_coordination_id_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT growth_work_order_coordination_state CHECK (state IN (
    'CREATED', 'READY', 'ACTIVE', 'PAUSED', 'BLOCKED',
    'COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'
  )),
  CONSTRAINT growth_work_order_coordination_environment CHECK (environment = 'simulation'),
  CONSTRAINT growth_work_order_coordination_idempotency UNIQUE (customer_id, idempotency_key),
  CONSTRAINT growth_work_order_coordination_not_a_balance CHECK (
    body_canonical LIKE '%"isBalance":false%'
    AND body_canonical LIKE '%"isAuthorizationEnvelope":true%'
    AND body_canonical LIKE '%"createsFinancialAuthority":false%'
    AND body_canonical LIKE '%"postsLedger":false%'
    AND body_canonical LIKE '%"unrestrictedFinancialMutation":false%'
    AND body_canonical LIKE '%"agentAuthorityEscalation":false%'
  )
);

CREATE INDEX growth_work_order_coordination_customer_idx
  ON growth.economic_work_order_coordination (customer_id, created_at DESC);
CREATE INDEX growth_work_order_coordination_subject_idx
  ON growth.economic_work_order_coordination (subject_id, created_at DESC);
CREATE INDEX growth_work_order_coordination_state_idx
  ON growth.economic_work_order_coordination (state);

CREATE TABLE growth.economic_work_order_transition (
  transition_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES growth.economic_work_order_coordination (work_order_id),
  revision INTEGER NOT NULL,
  previous_state TEXT NOT NULL,
  next_state TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_source TEXT NOT NULL,
  reason TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  event_reference TEXT,
  body_canonical TEXT NOT NULL,
  CONSTRAINT growth_work_order_transition_id_prefix CHECK (transition_id LIKE 'ewot_%'),
  CONSTRAINT growth_work_order_transition_actor CHECK (actor_source IN ('CUSTOMER', 'SYSTEM', 'OPERATOR'))
);

CREATE INDEX growth_work_order_transition_order_idx
  ON growth.economic_work_order_transition (work_order_id, revision);

REVOKE ALL ON TABLE growth.economic_work_order_coordination FROM PUBLIC;
REVOKE ALL ON TABLE growth.economic_work_order_transition FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE growth.economic_work_order_coordination TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.economic_work_order_transition TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE growth.economic_work_order_coordination FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.economic_work_order_transition FROM customer_app;
