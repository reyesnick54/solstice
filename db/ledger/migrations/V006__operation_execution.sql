-- V006 Chunk 155: durable OperationExecutionRecord.
-- Provider-neutral operational-effect state. Not a journal, not a second
-- outbox. No raw provider bodies and no authentication material.

CREATE TABLE ledger.operation_execution (
  operation_id TEXT PRIMARY KEY,
  operation_kind TEXT NOT NULL,
  business_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  correlation_id TEXT,
  causation_id TEXT,
  intent_id TEXT,
  evidence_id TEXT,
  provider_id TEXT NOT NULL,
  provider_operation_ref TEXT,
  state TEXT NOT NULL CHECK (
    state IN (
      'PREPARED',
      'DISPATCHING',
      'SUBMITTED',
      'SUBMISSION_UNKNOWN',
      'CONFIRMED',
      'REJECTED_FINAL',
      'RECONCILIATION_REQUIRED',
      'COMPENSATION_REQUIRED',
      'COMPENSATED'
    )
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  attempt_lineage TEXT NOT NULL,
  supersedes_operation_id TEXT,
  native_asset_id TEXT,
  prepared_at TIMESTAMPTZ NOT NULL,
  first_submitted_at TIMESTAMPTZ,
  last_observed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  last_safe_error_code TEXT,
  last_safe_error_message TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  lease_owner TEXT,
  lease_until TIMESTAMPTZ,
  CONSTRAINT operation_execution_provider_key UNIQUE (provider_id, idempotency_key)
);

CREATE INDEX operation_execution_business_idx
  ON ledger.operation_execution (operation_kind, business_key);
CREATE INDEX operation_execution_state_idx
  ON ledger.operation_execution (state);
CREATE INDEX operation_execution_lease_idx
  ON ledger.operation_execution (lease_until);

CREATE TABLE ledger.operation_callback (
  provider_id TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  business_reference TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider_id, provider_event_id, payload_digest, business_reference)
);

REVOKE ALL ON TABLE ledger.operation_execution FROM PUBLIC;
REVOKE ALL ON TABLE ledger.operation_callback FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE ledger.operation_execution TO ledger_writer;
GRANT SELECT, INSERT ON TABLE ledger.operation_callback TO ledger_writer;
GRANT SELECT ON TABLE ledger.operation_execution TO ledger_reader;
GRANT SELECT ON TABLE ledger.operation_callback TO ledger_reader;
