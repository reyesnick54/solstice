-- V053 HELIOS H13 — Grow sandbox capital allocation coordination records.
-- Coordination/reservation only. Not a second balance or shadow ledger.
-- Canonical cash remains on accounts/ledger truth via holds.

CREATE TABLE growth.grow_sandbox_allocation (
  allocation_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  state TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT grow_sandbox_allocation_id_prefix CHECK (allocation_id LIKE 'gsa_%'),
  CONSTRAINT grow_sandbox_allocation_work_order_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT grow_sandbox_allocation_state CHECK (state IN (
    'REQUESTED', 'RESERVED', 'PARTIALLY_RESERVED', 'RELEASED', 'REFUSED', 'EXPIRED', 'REDUCED'
  )),
  CONSTRAINT grow_sandbox_allocation_no_ea CHECK (body_canonical NOT LIKE '%ExecutionAuthority%'),
  CONSTRAINT grow_sandbox_allocation_customer_idempotency UNIQUE (customer_id, idempotency_key)
);

CREATE INDEX grow_sandbox_allocation_customer_idx ON growth.grow_sandbox_allocation (customer_id, state);
CREATE INDEX grow_sandbox_allocation_work_order_idx ON growth.grow_sandbox_allocation (work_order_id, customer_id);
CREATE INDEX grow_sandbox_allocation_account_idx ON growth.grow_sandbox_allocation (account_id, customer_id, state);

REVOKE ALL ON TABLE growth.grow_sandbox_allocation FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.grow_sandbox_allocation TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.grow_sandbox_allocation FROM customer_app;
