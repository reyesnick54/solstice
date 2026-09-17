-- V056 HELIOS H20 — Meta Allocator recommendation persistence.
-- Recommendations only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_meta_allocator_run (
  run_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  hold_cash BOOLEAN NOT NULL,
  body_canonical TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_meta_run_id_prefix CHECK (run_id LIKE 'mar_%'),
  CONSTRAINT helios_meta_run_work_order_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT helios_meta_run_no_financial_effect CHECK (
    body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
  )
);

CREATE TABLE growth.helios_meta_allocator_decision (
  decision_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES growth.helios_meta_allocator_run (run_id),
  work_order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  disposition TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_meta_decision_id_prefix CHECK (decision_id LIKE 'mad_%'),
  CONSTRAINT helios_meta_decision_run_prefix CHECK (run_id LIKE 'mar_%'),
  CONSTRAINT helios_meta_decision_no_financial_effect CHECK (
    body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
  ),
  CONSTRAINT helios_meta_decision_no_reservation CHECK (
    body_canonical NOT LIKE '%"postsReservation":true%'
  )
);

CREATE TABLE growth.helios_meta_allocator_calibration (
  record_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_meta_calibration_id_prefix CHECK (record_id LIKE 'cal_%'),
  CONSTRAINT helios_meta_calibration_candidate_prefix CHECK (candidate_id LIKE 'mac_%')
);

CREATE INDEX helios_meta_run_customer_idx
  ON growth.helios_meta_allocator_run (customer_id, decided_at DESC);

CREATE INDEX helios_meta_decision_customer_idx
  ON growth.helios_meta_allocator_decision (customer_id, disposition);

REVOKE ALL ON TABLE growth.helios_meta_allocator_run FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_meta_allocator_decision FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_meta_allocator_calibration FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_meta_allocator_run TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_meta_allocator_decision TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_meta_allocator_calibration TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE growth.helios_meta_allocator_run FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_meta_allocator_decision FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_meta_allocator_calibration FROM customer_app;
