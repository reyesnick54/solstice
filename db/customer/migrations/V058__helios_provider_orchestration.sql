-- V058 HELIOS H22 — Provider account / funding / wallet orchestration durable records.
-- Coordination only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_provider_orchestration_snapshot (
  snapshot_id TEXT PRIMARY KEY DEFAULT 'current',
  body_canonical TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_po_snapshot_singleton CHECK (snapshot_id = 'current'),
  CONSTRAINT helios_po_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialEffect":true%'
    AND body_canonical NOT LIKE '%"buyingPowerCredited":true%'
    AND body_canonical NOT LIKE '%"heliosIsAccountOwner":true%'
    AND body_canonical NOT LIKE '%"signingCredentialExposed":true%'
    AND body_canonical NOT LIKE '%"seedPhrase"%'
    AND body_canonical NOT LIKE '%"privateKey"%'
  )
);

REVOKE ALL ON TABLE growth.helios_provider_orchestration_snapshot FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_provider_orchestration_snapshot TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_provider_orchestration_snapshot FROM customer_app;
