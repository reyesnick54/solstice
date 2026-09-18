-- V058 HELIOS H23 — Provider-backed order / fill / settlement lifecycle.
-- Coordination records only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_order (
  order_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  status TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_ord_id_prefix CHECK (order_id LIKE 'ord_%'),
  CONSTRAINT helios_ord_op_prefix CHECK (operation_id LIKE 'op_%'),
  CONSTRAINT helios_ord_work_order_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT helios_ord_status CHECK (status IN (
    'PROPOSED', 'AUTHORIZED', 'SUBMITTED', 'ACKNOWLEDGED',
    'PARTIALLY_FILLED', 'FILLED', 'SETTLED', 'RECONCILED', 'AVAILABLE',
    'REJECTED', 'CANCEL_PENDING', 'CANCELLED', 'PARTIALLY_FILLED_THEN_CANCELLED',
    'EXPIRED', 'FAILED', 'UNKNOWN', 'RECONCILIATION_REQUIRED'
  )),
  CONSTRAINT helios_ord_no_live CHECK (
    body_canonical NOT LIKE '%"liveExecution":true%'
    AND body_canonical NOT LIKE '%"productionAuthorized":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
  )
);

CREATE INDEX helios_ord_customer_idx ON growth.helios_order (customer_id, updated_at DESC);
CREATE INDEX helios_ord_work_order_idx ON growth.helios_order (work_order_id, created_at DESC);

CREATE TABLE growth.helios_order_fill (
  fill_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES growth.helios_order (order_id),
  provider_fill_id TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  arrived_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_fill_id_prefix CHECK (fill_id LIKE 'fill_%'),
  CONSTRAINT helios_fill_unique_provider UNIQUE (order_id, provider_fill_id)
);

CREATE INDEX helios_fill_order_idx ON growth.helios_order_fill (order_id, arrived_at ASC);

CREATE TABLE growth.helios_order_settlement (
  settlement_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES growth.helios_order (order_id),
  fill_id TEXT NOT NULL,
  status TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT helios_set_id_prefix CHECK (settlement_id LIKE 'set_%'),
  CONSTRAINT helios_set_status CHECK (status IN (
    'PENDING', 'IN_PROGRESS', 'SETTLED', 'FAILED', 'DISCREPANCY', 'UNKNOWN'
  ))
);

CREATE TABLE growth.helios_provider_event (
  event_id TEXT PRIMARY KEY,
  order_id TEXT,
  customer_id TEXT NOT NULL,
  verification TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_pev_id_prefix CHECK (event_id LIKE 'pev_%')
);

CREATE INDEX helios_pev_customer_idx ON growth.helios_provider_event (customer_id, received_at DESC);

REVOKE ALL ON TABLE growth.helios_order FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_order TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_order FROM customer_app;

REVOKE ALL ON TABLE growth.helios_order_fill FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_order_fill TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_order_fill FROM customer_app;

REVOKE ALL ON TABLE growth.helios_order_settlement FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_order_settlement TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_order_settlement FROM customer_app;

REVOKE ALL ON TABLE growth.helios_provider_event FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_provider_event TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_provider_event FROM customer_app;
