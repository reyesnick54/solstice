-- V061 HELIOS H30 — Supervisory export and regulated change governance durable records.
-- Validation artifact only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_supervisory_export_request (
  export_request_id TEXT PRIMARY KEY,
  export_mode TEXT NOT NULL,
  approval_state TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_sexp_id_prefix CHECK (export_request_id LIKE 'sexp_%'),
  CONSTRAINT helios_sexp_mode CHECK (export_mode IN (
    'INTERNAL_REVIEW', 'REGULATOR_EXPORT', 'AUDIT_EXPORT'
  )),
  CONSTRAINT helios_sexp_approval CHECK (approval_state IN (
    'PENDING', 'APPROVED', 'DENIED', 'EXPIRED'
  )),
  CONSTRAINT helios_sexp_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
  )
);

CREATE TABLE growth.helios_supervisory_export_package (
  package_id TEXT PRIMARY KEY,
  export_request_id TEXT NOT NULL REFERENCES growth.helios_supervisory_export_request (export_request_id),
  package_hash TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_spkg_id_prefix CHECK (package_id LIKE 'spkg_%'),
  CONSTRAINT helios_spkg_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
  )
);

CREATE TABLE growth.helios_regulatory_change_request (
  change_request_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_rcr_id_prefix CHECK (change_request_id LIKE 'rcr_%'),
  CONSTRAINT helios_rcr_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
  )
);

CREATE INDEX helios_sexp_created_idx
  ON growth.helios_supervisory_export_request (created_at DESC);

CREATE INDEX helios_rcr_state_idx
  ON growth.helios_regulatory_change_request (state, updated_at DESC);

REVOKE ALL ON TABLE growth.helios_supervisory_export_request FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_supervisory_export_package FROM PUBLIC;
REVOKE ALL ON TABLE growth.helios_regulatory_change_request FROM PUBLIC;

GRANT SELECT, INSERT ON TABLE growth.helios_supervisory_export_request TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_supervisory_export_package TO customer_app;
GRANT SELECT, INSERT ON TABLE growth.helios_regulatory_change_request TO customer_app;

REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_supervisory_export_request FROM customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_supervisory_export_package FROM customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_regulatory_change_request FROM customer_app;
