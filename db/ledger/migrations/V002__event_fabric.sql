-- V002 event fabric: canonical envelope columns, transactional outbox,
-- consumer inbox, and inspectable dead letters.
-- domain_event remains append-only. Outbox/inbox rows are delivery state
-- and may be updated. Failed events are never deleted.

ALTER TABLE ledger.domain_event
  ADD COLUMN event_id TEXT,
  ADD COLUMN event_version INTEGER,
  ADD COLUMN aggregate_type TEXT,
  ADD COLUMN aggregate_id TEXT,
  ADD COLUMN aggregate_sequence INTEGER,
  ADD COLUMN correlation_id TEXT,
  ADD COLUMN causation_id TEXT,
  ADD COLUMN intent_id TEXT,
  ADD COLUMN evidence_id TEXT,
  ADD COLUMN jurisdiction TEXT,
  ADD COLUMN cell_id TEXT,
  ADD COLUMN schema_ref TEXT,
  ADD COLUMN metadata_canonical JSONB,
  ADD COLUMN envelope_canonical JSONB;

UPDATE ledger.domain_event
   SET event_id = 'evt_legacy_' || id::text,
       event_version = schema_version,
       aggregate_type = 'unknown',
       aggregate_id = 'legacy',
       aggregate_sequence = id::integer,
       correlation_id = 'evt_legacy_' || id::text,
       schema_ref = 'solstice.unknown.legacy/' || schema_version::text,
       metadata_canonical = '{}'::jsonb,
       envelope_canonical = jsonb_build_object(
         'eventId', 'evt_legacy_' || id::text,
         'eventType', event_type,
         'eventVersion', schema_version,
         'schemaVersion', schema_version,
         'occurredAt', occurred_at,
         'payload', payload_canonical
       )
 WHERE event_id IS NULL;

ALTER TABLE ledger.domain_event
  ALTER COLUMN event_id SET NOT NULL,
  ALTER COLUMN event_version SET NOT NULL,
  ALTER COLUMN aggregate_type SET NOT NULL,
  ALTER COLUMN aggregate_id SET NOT NULL,
  ALTER COLUMN aggregate_sequence SET NOT NULL,
  ALTER COLUMN correlation_id SET NOT NULL,
  ALTER COLUMN schema_ref SET NOT NULL,
  ALTER COLUMN metadata_canonical SET NOT NULL,
  ALTER COLUMN envelope_canonical SET NOT NULL,
  ADD CONSTRAINT domain_event_event_id_unique UNIQUE (event_id),
  ADD CONSTRAINT domain_event_version_positive CHECK (event_version >= 1),
  ADD CONSTRAINT domain_event_sequence_positive CHECK (aggregate_sequence >= 1);

CREATE INDEX domain_event_aggregate_idx
  ON ledger.domain_event (aggregate_type, aggregate_id, aggregate_sequence);
CREATE INDEX domain_event_type_idx
  ON ledger.domain_event (event_type, event_version);
CREATE INDEX domain_event_correlation_idx
  ON ledger.domain_event (correlation_id);

CREATE TABLE ledger.outbox (
  event_id TEXT PRIMARY KEY REFERENCES ledger.domain_event (event_id),
  envelope_canonical JSONB NOT NULL,
  delivery_state TEXT NOT NULL CHECK (
    delivery_state IN ('PENDING', 'IN_FLIGHT', 'DELIVERED', 'DEAD_LETTER')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL,
  last_attempt_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_safe TEXT,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX outbox_claim_idx
  ON ledger.outbox (delivery_state, next_attempt_at);

CREATE TABLE ledger.inbox (
  consumer_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES ledger.domain_event (event_id),
  first_seen_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  completed_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_safe TEXT,
  PRIMARY KEY (consumer_id, event_id)
);

CREATE TABLE ledger.dead_letter (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES ledger.domain_event (event_id),
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  consumer_id TEXT,
  attempt_count INTEGER NOT NULL CHECK (attempt_count >= 1),
  reason_code TEXT NOT NULL,
  reason_safe TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  replayed_at TIMESTAMPTZ
);

CREATE FUNCTION ledger.forbid_dead_letter_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'dead letters are not deleted; replay is explicit'
      USING ERRCODE = 'read_only_sql_transaction';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.event_type IS DISTINCT FROM OLD.event_type
    OR NEW.reason_code IS DISTINCT FROM OLD.reason_code
  ) THEN
    RAISE EXCEPTION 'dead letter identity is immutable'
      USING ERRCODE = 'read_only_sql_transaction';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dead_letter_identity_guard
  BEFORE UPDATE OR DELETE ON ledger.dead_letter
  FOR EACH ROW EXECUTE FUNCTION ledger.forbid_dead_letter_delete();

REVOKE ALL ON TABLE ledger.outbox FROM PUBLIC;
REVOKE ALL ON TABLE ledger.inbox FROM PUBLIC;
REVOKE ALL ON TABLE ledger.dead_letter FROM PUBLIC;

GRANT SELECT, INSERT ON TABLE ledger.domain_event TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.outbox TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.inbox TO ledger_writer;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger.dead_letter TO ledger_writer;
GRANT USAGE, SELECT ON SEQUENCE ledger.dead_letter_id_seq TO ledger_writer;

GRANT SELECT ON TABLE ledger.outbox TO ledger_reader;
GRANT SELECT ON TABLE ledger.inbox TO ledger_reader;
GRANT SELECT ON TABLE ledger.dead_letter TO ledger_reader;
