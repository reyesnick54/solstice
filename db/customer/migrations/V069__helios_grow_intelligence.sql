-- V069 HELIOS Multi-Asset M27 — Grow Intelligence reports and notification delivery records.
-- Reference artifacts only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_grow_intelligence_report (
  report_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  reporting_date TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  facts_hash TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT helios_gi_report_prefix CHECK (report_id LIKE 'mbr_%' OR report_id LIKE 'erc_%'),
  CONSTRAINT helios_gi_report_type CHECK (report_type IN ('MORNING_BRIEF', 'EVENING_RECAP')),
  CONSTRAINT helios_gi_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialMutation":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
  )
);

CREATE UNIQUE INDEX helios_gi_report_customer_date_type_idx
  ON growth.helios_grow_intelligence_report (customer_id, reporting_date, report_type);

CREATE INDEX helios_gi_report_generated_idx
  ON growth.helios_grow_intelligence_report (generated_at DESC);

CREATE TABLE growth.helios_grow_notification_delivery (
  delivery_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  deduplication_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT helios_gi_delivery_prefix CHECK (delivery_id LIKE 'gnd_%')
);

CREATE UNIQUE INDEX helios_gi_delivery_dedup_idx
  ON growth.helios_grow_notification_delivery (deduplication_key);

CREATE INDEX helios_gi_delivery_customer_idx
  ON growth.helios_grow_notification_delivery (customer_id, delivered_at DESC);

REVOKE ALL ON TABLE growth.helios_grow_intelligence_report FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_grow_intelligence_report TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_grow_intelligence_report FROM customer_app;

REVOKE ALL ON TABLE growth.helios_grow_notification_delivery FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_grow_notification_delivery TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_grow_notification_delivery FROM customer_app;
