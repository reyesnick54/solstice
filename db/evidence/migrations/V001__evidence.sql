-- V001 evidence: append-only hash chain. Genesis prev hash is 64 zero hex digits.
-- A broken chain is a hard failure. Rows are never updated or deleted.

CREATE SCHEMA IF NOT EXISTS evidence;

CREATE TABLE evidence.evidence_record (
  seq BIGINT PRIMARY KEY CHECK (seq >= 1),
  evidence_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  payload_canonical JSONB NOT NULL,
  payload_sha256 CHAR(64) NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  prev_record_sha256 CHAR(64) NOT NULL CHECK (prev_record_sha256 ~ '^[0-9a-f]{64}$'),
  record_sha256 CHAR(64) NOT NULL UNIQUE CHECK (record_sha256 ~ '^[0-9a-f]{64}$'),
  sealed_at TIMESTAMPTZ NOT NULL
);

CREATE FUNCTION evidence.forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'evidence records are append-only; the hash chain cannot be rewritten'
    USING ERRCODE = 'read_only_sql_transaction';
END;
$$;

CREATE TRIGGER evidence_record_append_only
  BEFORE UPDATE OR DELETE ON evidence.evidence_record
  FOR EACH ROW EXECUTE FUNCTION evidence.forbid_mutation();

-- Contiguous seq and prev-hash link. Rejects forks and gaps.
CREATE FUNCTION evidence.assert_chain_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  tip_seq BIGINT;
  tip_hash TEXT;
BEGIN
  SELECT seq, record_sha256
  INTO tip_seq, tip_hash
  FROM evidence.evidence_record
  WHERE seq = NEW.seq - 1;

  IF NEW.seq = 1 THEN
    IF NEW.prev_record_sha256 <> REPEAT('0', 64) THEN
      RAISE EXCEPTION 'genesis evidence must use the zero prev hash'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF tip_seq IS NULL THEN
    RAISE EXCEPTION 'evidence seq % has no predecessor'
      , NEW.seq
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.prev_record_sha256 <> tip_hash THEN
    RAISE EXCEPTION 'evidence seq % prev hash does not match the committed tip'
      , NEW.seq
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER evidence_chain_link
  BEFORE INSERT ON evidence.evidence_record
  FOR EACH ROW EXECUTE FUNCTION evidence.assert_chain_link();

REVOKE ALL ON SCHEMA evidence FROM PUBLIC;
GRANT USAGE ON SCHEMA evidence TO evidence_app;
REVOKE ALL ON TABLE evidence.evidence_record FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE evidence.evidence_record TO evidence_app;
