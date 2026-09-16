-- V051 HELIOS H09 — executable opportunity binding lifecycle.
-- Qualification state only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_executable_opportunity (
  executable_opportunity_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  state TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  qualification_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_executable_opportunity_id_prefix CHECK (executable_opportunity_id LIKE 'xop_%'),
  CONSTRAINT helios_executable_opportunity_candidate_prefix CHECK (candidate_id LIKE 'opc_%'),
  CONSTRAINT helios_executable_opportunity_work_order_prefix CHECK (work_order_id LIKE 'ewo_%'),
  CONSTRAINT helios_executable_opportunity_state CHECK (state IN (
    'DISCOVERED', 'EVIDENCE_VERIFIED', 'CUSTOMER_ELIGIBLE', 'EXECUTION_ROUTE_READY',
    'QUALIFIED_FOR_PROPOSAL', 'REJECTED', 'EXPIRED', 'STALE', 'INELIGIBLE',
    'NO_ROUTE', 'DATA_DEGRADED', 'REVIEW_REQUIRED'
  )),
  CONSTRAINT helios_executable_opportunity_no_ea CHECK (body_canonical NOT LIKE '%ExecutionAuthority%')
);

CREATE TABLE growth.helios_opportunity_candidate (
  candidate_id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_opportunity_candidate_id_prefix CHECK (candidate_id LIKE 'opc_%')
);

CREATE INDEX helios_executable_opportunity_customer_idx
  ON growth.helios_executable_opportunity (customer_id, state);

CREATE INDEX helios_executable_opportunity_subject_idx
  ON growth.helios_executable_opportunity (subject_id, updated_at DESC);

REVOKE ALL ON TABLE growth.helios_executable_opportunity FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_opportunity_candidate FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_executable_opportunity TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_opportunity_candidate TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE growth.helios_executable_opportunity FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_opportunity_candidate FROM customer_app;
