-- V068 HELIOS Multi-Asset M14 — Macro and Event Intelligence Fabric durable records.
-- Research artifact only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_macro_event_intelligence (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ,
  knowable_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  sealed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT helios_mei_event_prefix CHECK (event_id LIKE 'm14.%'),
  CONSTRAINT helios_mei_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialMutation":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
  )
);

CREATE INDEX helios_mei_knowable_idx
  ON growth.helios_macro_event_intelligence (knowable_at DESC);

CREATE INDEX helios_mei_scheduled_idx
  ON growth.helios_macro_event_intelligence (scheduled_time ASC)
  WHERE scheduled_time IS NOT NULL;

CREATE INDEX helios_mei_expires_idx
  ON growth.helios_macro_event_intelligence (expires_at ASC);

REVOKE ALL ON TABLE growth.helios_macro_event_intelligence FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_macro_event_intelligence TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_macro_event_intelligence FROM customer_app;
