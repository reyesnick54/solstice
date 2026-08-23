-- V039 Phase I Prompt 1 operations control plane.
-- Staff cases, assignments, operator actions, approvals, notes, and
-- evidence references. Not a second ledger, Kernel, or case engine.
-- Simulation only. Production remains disabled.

CREATE SCHEMA IF NOT EXISTS operations;

CREATE TABLE operations.case_record (
  case_id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  case_type TEXT NOT NULL,
  subject_ref TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  owner_ref TEXT,
  queue TEXT NOT NULL,
  specialized_case_id TEXT,
  investigator_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE operations.operator_action (
  action_id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  case_id TEXT,
  subject_ref TEXT,
  evidence_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE operations.approval (
  approval_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES operations.case_record (case_id),
  action TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  approver_id TEXT,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ
);

CREATE TABLE operations.note (
  note_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES operations.case_record (case_id),
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE operations.snapshot (
  snapshot_id TEXT PRIMARY KEY,
  body_canonical TEXT NOT NULL,
  sealed_at TIMESTAMPTZ NOT NULL
);

REVOKE ALL ON SCHEMA operations FROM PUBLIC;
GRANT USAGE ON SCHEMA operations TO customer_app;

REVOKE ALL ON TABLE operations.case_record FROM PUBLIC;
REVOKE ALL ON TABLE operations.operator_action FROM PUBLIC;
REVOKE ALL ON TABLE operations.approval FROM PUBLIC;
REVOKE ALL ON TABLE operations.note FROM PUBLIC;
REVOKE ALL ON TABLE operations.snapshot FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE operations.case_record TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE operations.operator_action TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE operations.approval TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE operations.note TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE operations.snapshot TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE operations.case_record FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE operations.operator_action FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE operations.approval FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE operations.note FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE operations.snapshot FROM customer_app;
