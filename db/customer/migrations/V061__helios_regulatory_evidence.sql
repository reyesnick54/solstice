-- HELIOS H29 regulatory evidence and reporting lifecycle persistence

CREATE TABLE IF NOT EXISTS growth.helios_regulatory_evidence_package (
  package_id          TEXT PRIMARY KEY,
  trace_id            TEXT NOT NULL,
  customer_id         TEXT NOT NULL,
  work_order_id       TEXT NOT NULL,
  package_version     INTEGER NOT NULL,
  package_hash        TEXT NOT NULL,
  reportability       TEXT NOT NULL,
  reporting_status    TEXT NOT NULL,
  body_canonical      TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_reg_evidence_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
    AND body_canonical NOT LIKE '%"claimsFiled":true%'
  )
);

CREATE INDEX IF NOT EXISTS idx_helios_reg_evidence_trace
  ON growth.helios_regulatory_evidence_package (trace_id);

CREATE INDEX IF NOT EXISTS idx_helios_reg_evidence_customer
  ON growth.helios_regulatory_evidence_package (customer_id);

CREATE TABLE IF NOT EXISTS growth.helios_reporting_obligation (
  obligation_id       TEXT PRIMARY KEY,
  trace_id            TEXT NOT NULL,
  package_id          TEXT NOT NULL REFERENCES growth.helios_regulatory_evidence_package(package_id),
  policy_obligation_ref TEXT NOT NULL,
  submission_state    TEXT NOT NULL,
  body_canonical      TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_reporting_obligation_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
  )
);

CREATE INDEX IF NOT EXISTS idx_helios_reporting_obligation_trace
  ON growth.helios_reporting_obligation (trace_id);

CREATE TABLE IF NOT EXISTS growth.helios_regulatory_report_package (
  report_package_id   TEXT PRIMARY KEY,
  obligation_id       TEXT NOT NULL REFERENCES growth.helios_reporting_obligation(obligation_id),
  trace_id            TEXT NOT NULL,
  revision            INTEGER NOT NULL,
  submission_state    TEXT NOT NULL,
  package_hash        TEXT NOT NULL,
  body_canonical      TEXT NOT NULL,
  generated_at        TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_regulatory_report_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
    AND body_canonical NOT LIKE '%"claimsFiled":true%'
  )
);

CREATE TABLE IF NOT EXISTS growth.helios_regulatory_idempotency (
  idempotency_key     TEXT PRIMARY KEY,
  processed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE growth.helios_regulatory_evidence_package FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_regulatory_evidence_package TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_regulatory_evidence_package FROM customer_app;

REVOKE ALL ON TABLE growth.helios_reporting_obligation FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_reporting_obligation TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_reporting_obligation FROM customer_app;

REVOKE ALL ON TABLE growth.helios_regulatory_report_package FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_regulatory_report_package TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_regulatory_report_package FROM customer_app;

REVOKE ALL ON TABLE growth.helios_regulatory_idempotency FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_regulatory_idempotency TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_regulatory_idempotency FROM customer_app;
