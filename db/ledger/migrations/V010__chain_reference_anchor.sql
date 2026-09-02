-- V010 Wave 8 product integration: durable chain-reference anchors.
-- Operational traceability only. Not a second ledger and not canonical supply authority.
-- Links downstream records (journals, settlements, wallet projections) to finalized chain state.

CREATE TABLE ledger.chain_reference_anchor (
  anchor_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL CHECK (
    source_kind IN (
      'LEDGER_JOURNAL',
      'WALLET_PROJECTION',
      'EXCHANGE_SETTLEMENT',
      'SUNREY_ISSUANCE_RECEIPT',
      'MOONREY_ISSUANCE_RECEIPT',
      'CUSTODY_MOVEMENT',
      'OPERATION_EXECUTION'
    )
  ),
  source_id TEXT NOT NULL,
  journal_id TEXT,
  chain_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  finalized_block_height INTEGER NOT NULL CHECK (finalized_block_height >= 0),
  finalized_block_hash TEXT NOT NULL,
  monetary_state_root TEXT NOT NULL,
  economic_claim_id TEXT,
  economic_receipt_id TEXT,
  correlation_id TEXT,
  finalized_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT chain_reference_anchor_source_unique UNIQUE (source_kind, source_id)
);

CREATE INDEX chain_reference_anchor_journal_idx
  ON ledger.chain_reference_anchor (journal_id)
  WHERE journal_id IS NOT NULL;

CREATE INDEX chain_reference_anchor_transaction_idx
  ON ledger.chain_reference_anchor (chain_id, transaction_id);

CREATE INDEX chain_reference_anchor_claim_idx
  ON ledger.chain_reference_anchor (economic_claim_id)
  WHERE economic_claim_id IS NOT NULL;

REVOKE ALL ON TABLE ledger.chain_reference_anchor FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE ledger.chain_reference_anchor TO ledger_writer;
GRANT SELECT ON TABLE ledger.chain_reference_anchor TO ledger_reader;
