-- V007 Phase B Prompt 5: persistent jobs, workflows, inbound/outbound
-- webhooks, and dead-letter observability columns.
-- Delivery / orchestration state only. Not a journal, mint, or
-- Execution Authority store. Environment stays simulation.

ALTER TABLE ledger.domain_event
  ADD COLUMN IF NOT EXISTS producer TEXT,
  ADD COLUMN IF NOT EXISTS actor_type TEXT,
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS subject_type TEXT,
  ADD COLUMN IF NOT EXISTS subject_id TEXT,
  ADD COLUMN IF NOT EXISTS environment TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

UPDATE ledger.domain_event
   SET producer = COALESCE(producer, 'sunrey.events'),
       environment = COALESCE(environment, 'simulation')
 WHERE producer IS NULL OR environment IS NULL;

ALTER TABLE ledger.domain_event
  ALTER COLUMN producer SET NOT NULL,
  ALTER COLUMN environment SET NOT NULL,
  ADD CONSTRAINT domain_event_environment_simulation
    CHECK (environment = 'simulation');

CREATE INDEX IF NOT EXISTS domain_event_request_idx
  ON ledger.domain_event (request_id);
CREATE INDEX IF NOT EXISTS domain_event_producer_idx
  ON ledger.domain_event (producer);

ALTER TABLE ledger.dead_letter
  ADD COLUMN IF NOT EXISTS error_class TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

CREATE TABLE ledger.async_job (
  job_id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  state TEXT NOT NULL CHECK (
    state IN ('PENDING', 'SCHEDULED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELLED')
  ),
  payload_canonical JSONB NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  available_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL CHECK (max_attempts >= 1),
  timeout_ms INTEGER NOT NULL CHECK (timeout_ms >= 0),
  last_attempt_at TIMESTAMPTZ,
  last_error_class TEXT,
  last_error_safe TEXT,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  request_id TEXT,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT async_job_not_authority CHECK (job_type NOT IN (
    'ISSUE_EXECUTION_AUTHORITY',
    'POST_JOURNAL',
    'OPEN_ACCOUNT',
    'AGENT_PRIVILEGED_MUTATION'
  ))
);

CREATE INDEX async_job_claim_idx
  ON ledger.async_job (state, available_at);
CREATE INDEX async_job_correlation_idx
  ON ledger.async_job (correlation_id);

CREATE TABLE ledger.async_workflow (
  workflow_id TEXT PRIMARY KEY,
  workflow_type TEXT NOT NULL,
  state TEXT NOT NULL CHECK (
    state IN (
      'PENDING',
      'RUNNING',
      'WAITING_HUMAN',
      'WAITING_COMPLIANCE',
      'WAITING_PROVIDER',
      'COMPENSATING',
      'COMPLETED',
      'FAILED',
      'CANCELLED'
    )
  ),
  current_step TEXT NOT NULL,
  history_canonical JSONB NOT NULL,
  context_canonical JSONB NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  request_id TEXT,
  waiting_since TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX async_workflow_state_idx
  ON ledger.async_workflow (state);
CREATE INDEX async_workflow_correlation_idx
  ON ledger.async_workflow (correlation_id);

CREATE TABLE ledger.inbound_webhook (
  receipt_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  raw_body_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACCEPTED', 'DUPLICATE', 'REJECTED')),
  reject_code TEXT,
  correlation_id TEXT NOT NULL,
  request_id TEXT,
  processed_at TIMESTAMPTZ,
  CONSTRAINT inbound_webhook_provider_event UNIQUE (provider_id, provider_event_id)
);

CREATE INDEX inbound_webhook_status_idx
  ON ledger.inbound_webhook (status, received_at);

CREATE TABLE ledger.outbound_webhook_subscription (
  subscription_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  secret_ref TEXT NOT NULL,
  event_filter JSONB NOT NULL,
  active BOOLEAN NOT NULL,
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  failure_threshold INTEGER NOT NULL CHECK (failure_threshold >= 1),
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT outbound_webhook_secret_is_ref CHECK (secret_ref LIKE 'secret://%' OR secret_ref LIKE 'ref:%')
);

CREATE TABLE ledger.outbound_webhook_delivery (
  delivery_id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES ledger.outbound_webhook_subscription (subscription_id),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  state TEXT NOT NULL CHECK (
    state IN ('PENDING', 'DELIVERED', 'RETRYING', 'DEAD_LETTER', 'DISABLED')
  ),
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  last_error_class TEXT,
  last_error_safe TEXT,
  body_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX outbound_webhook_delivery_claim_idx
  ON ledger.outbound_webhook_delivery (state, next_attempt_at);

REVOKE ALL ON TABLE ledger.async_job FROM PUBLIC;
REVOKE ALL ON TABLE ledger.async_workflow FROM PUBLIC;
REVOKE ALL ON TABLE ledger.inbound_webhook FROM PUBLIC;
REVOKE ALL ON TABLE ledger.outbound_webhook_subscription FROM PUBLIC;
REVOKE ALL ON TABLE ledger.outbound_webhook_delivery FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE ledger.async_job TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.async_workflow TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.inbound_webhook TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.outbound_webhook_subscription TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.outbound_webhook_delivery TO ledger_writer;

GRANT SELECT ON TABLE ledger.async_job TO ledger_reader;
GRANT SELECT ON TABLE ledger.async_workflow TO ledger_reader;
GRANT SELECT ON TABLE ledger.inbound_webhook TO ledger_reader;
GRANT SELECT ON TABLE ledger.outbound_webhook_subscription TO ledger_reader;
GRANT SELECT ON TABLE ledger.outbound_webhook_delivery TO ledger_reader;
