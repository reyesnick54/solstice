-- V053 HELIOS H21 — Decision-Validity Envelope durable records.
-- Validation artifact only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_decision_validity_envelope (
  envelope_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  overall_status TEXT NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_dve_id_prefix CHECK (envelope_id LIKE 'dve_%'),
  CONSTRAINT helios_dve_candidate_prefix CHECK (candidate_id LIKE 'opc_%'),
  CONSTRAINT helios_dve_work_order_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT helios_dve_status CHECK (overall_status IN (
    'VALID', 'INVALID', 'EXPIRED', 'DEGRADED', 'REVIEW_REQUIRED', 'UNKNOWN'
  )),
  CONSTRAINT helios_dve_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
  )
);

CREATE INDEX helios_dve_customer_idx
  ON growth.helios_decision_validity_envelope (customer_id, evaluated_at DESC);

CREATE INDEX helios_dve_candidate_idx
  ON growth.helios_decision_validity_envelope (candidate_id, revision DESC);

REVOKE ALL ON TABLE growth.helios_decision_validity_envelope FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_decision_validity_envelope TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_decision_validity_envelope FROM customer_app;
