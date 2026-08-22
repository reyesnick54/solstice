-- V009 production journal metadata, reversal uniqueness, and hold amount adjust.
-- Journals and postings remain append-only. This is not a second ledger.

ALTER TABLE ledger.journal
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'POSTED'
    CHECK (status IN ('POSTED')),
  ADD COLUMN IF NOT EXISTS effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS causation_id TEXT,
  ADD COLUMN IF NOT EXISTS source_domain TEXT,
  ADD COLUMN IF NOT EXISTS evidence_record_id TEXT,
  ADD COLUMN IF NOT EXISTS reverses_journal_id TEXT,
  ADD COLUMN IF NOT EXISTS reversal_kind TEXT
    CHECK (reversal_kind IS NULL OR reversal_kind IN ('FULL', 'PARTIAL')),
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;

UPDATE ledger.journal
   SET effective_at = created_at
 WHERE effective_at IS NULL;

ALTER TABLE ledger.journal
  ALTER COLUMN effective_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS journal_account_lookup
  ON ledger.posting (account_id, journal_id);

CREATE INDEX IF NOT EXISTS journal_reference
  ON ledger.journal (reference)
  WHERE reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS journal_correlation
  ON ledger.journal (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS journal_full_reversal_unique
  ON ledger.journal (reverses_journal_id)
  WHERE reverses_journal_id IS NOT NULL AND reversal_kind = 'FULL';

ALTER TABLE ledger.reversal_record
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'FULL'
    CHECK (kind IN ('FULL', 'PARTIAL')),
  ADD COLUMN IF NOT EXISTS original_scaled_units NUMERIC(38, 0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversed_scaled_units NUMERIC(38, 0) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS reversal_record_full_original
  ON ledger.reversal_record (original_journal_id)
  WHERE kind = 'FULL';

CREATE INDEX IF NOT EXISTS funds_hold_idempotency
  ON ledger.funds_hold (idempotency_key);

-- Request fingerprint for Phase B idempotency conflict detection.
CREATE TABLE IF NOT EXISTS ledger.journal_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  request_fingerprint TEXT NOT NULL,
  journal_id TEXT NOT NULL REFERENCES ledger.journal (id),
  created_at TIMESTAMPTZ NOT NULL
);

REVOKE ALL ON TABLE ledger.journal_idempotency FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE ledger.journal_idempotency TO ledger_writer;
GRANT SELECT ON TABLE ledger.journal_idempotency TO ledger_reader;
