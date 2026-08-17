-- V001 SunRey explorer projection.
-- Rebuildable index. Not the financial Ledger, not blockchain state,
-- and not custody authority. Never repair chain state from this schema.

CREATE SCHEMA IF NOT EXISTS sunrey_explorer;

CREATE TABLE sunrey_explorer.checkpoint (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  last_indexed_finalized_height BIGINT NOT NULL,
  block_id TEXT NOT NULL,
  state_root TEXT NOT NULL,
  indexer_schema_version INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sunrey_explorer.block (
  height BIGINT PRIMARY KEY,
  block_id TEXT NOT NULL UNIQUE,
  parent_id TEXT NOT NULL,
  timestamp_unix_seconds BIGINT NOT NULL,
  proposer TEXT NOT NULL,
  validator_set_hash TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  transaction_count INTEGER NOT NULL,
  resource_usage TEXT NOT NULL,
  fee_total TEXT NOT NULL,
  fee_asset TEXT NOT NULL,
  state_root TEXT NOT NULL,
  commit_canonical TEXT NOT NULL,
  finality_status TEXT NOT NULL CHECK (finality_status = 'FINALIZED')
);

CREATE TABLE sunrey_explorer.tx (
  transaction_id TEXT PRIMARY KEY,
  tx_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  status TEXT NOT NULL,
  height BIGINT NOT NULL REFERENCES sunrey_explorer.block (height),
  block_id TEXT NOT NULL,
  resource_usage TEXT NOT NULL,
  fee TEXT NOT NULL,
  fee_asset TEXT NOT NULL,
  crypto_suite TEXT NOT NULL,
  asset_quantities_canonical TEXT NOT NULL,
  economic_object_refs_canonical TEXT NOT NULL,
  finalized_result TEXT NOT NULL,
  rejection_code TEXT
);

CREATE TABLE sunrey_explorer.account (
  address TEXT PRIMARY KEY,
  account_class TEXT NOT NULL,
  nonce TEXT NOT NULL,
  holdings_canonical TEXT NOT NULL,
  locks_canonical TEXT NOT NULL,
  authorization_policy TEXT NOT NULL,
  machine_account BOOLEAN NOT NULL,
  not_a_bank_account BOOLEAN NOT NULL CHECK (not_a_bank_account)
);

CREATE TABLE sunrey_explorer.asset (
  asset_id TEXT PRIMARY KEY,
  internal_asset_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  precision INTEGER NOT NULL,
  public_ticker_status TEXT NOT NULL CHECK (public_ticker_status = 'NOT_ASSIGNED'),
  network_class TEXT NOT NULL,
  supply_label TEXT NOT NULL CHECK (supply_label = 'DEVELOPMENT_TESTNET_SUPPLY'),
  issued TEXT NOT NULL,
  burned TEXT NOT NULL,
  locked TEXT NOT NULL,
  circulating TEXT NOT NULL,
  issuance_policy TEXT NOT NULL,
  not_market_capitalization BOOLEAN NOT NULL CHECK (not_market_capitalization)
);

CREATE TABLE sunrey_explorer.moonrey_issuance (
  issuance_id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  productive_category TEXT NOT NULL,
  contribution_id TEXT NOT NULL,
  productive_object_id TEXT NOT NULL,
  oracle_fact_refs_canonical TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  formula_inputs_canonical TEXT NOT NULL,
  rounding TEXT NOT NULL,
  issued_quantity TEXT NOT NULL,
  height BIGINT NOT NULL,
  recipient TEXT NOT NULL
);

CREATE TABLE sunrey_explorer.productive_object (
  object_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  lineage_canonical TEXT NOT NULL,
  geographic_aggregate TEXT
);

CREATE TABLE sunrey_explorer.contribution (
  contribution_id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  category TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  status TEXT NOT NULL,
  quantity TEXT NOT NULL,
  unit TEXT NOT NULL
);

CREATE TABLE sunrey_explorer.oracle_provider (
  provider_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  oracle_type TEXT NOT NULL
);

CREATE TABLE sunrey_explorer.oracle_feed (
  feed_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  fact_type TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE sunrey_explorer.oracle_fact (
  fact_id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL,
  fact_type TEXT NOT NULL,
  source_count INTEGER NOT NULL,
  aggregation_method TEXT NOT NULL,
  quality TEXT NOT NULL,
  staleness TEXT NOT NULL,
  conflict_state TEXT NOT NULL,
  artifact_kind TEXT NOT NULL CHECK (artifact_kind = 'PROTOCOL_VERIFIED_DATA_ARTIFACT')
);

CREATE TABLE sunrey_explorer.validator (
  validator_id TEXT PRIMARY KEY,
  consensus_key_descriptor TEXT NOT NULL,
  voting_power TEXT NOT NULL,
  status TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  operator_metadata TEXT,
  blocks_proposed INTEGER NOT NULL,
  votes INTEGER NOT NULL,
  missed INTEGER NOT NULL,
  jail_status TEXT,
  tombstone BOOLEAN NOT NULL
);

CREATE TABLE sunrey_explorer.evidence (
  evidence_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  validator_id TEXT NOT NULL,
  height BIGINT NOT NULL,
  round INTEGER NOT NULL,
  result TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  future_validator_status TEXT NOT NULL
);

CREATE TABLE sunrey_explorer.governance (
  proposal_id TEXT PRIMARY KEY,
  proposal_hash TEXT NOT NULL,
  upgrade_kind TEXT NOT NULL,
  votes_approve TEXT NOT NULL,
  votes_reject TEXT NOT NULL,
  voting_power TEXT NOT NULL,
  required_threshold TEXT NOT NULL,
  activation_height BIGINT NOT NULL,
  status TEXT NOT NULL,
  module_hashes_canonical TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  activation_result TEXT
);

CREATE TABLE sunrey_explorer.interop_client (
  client_id TEXT PRIMARY KEY,
  external_chain_id TEXT NOT NULL,
  verified_height BIGINT NOT NULL,
  status TEXT NOT NULL,
  security_profile TEXT NOT NULL,
  development_only BOOLEAN NOT NULL CHECK (development_only)
);

CREATE TABLE sunrey_explorer.interop_packet (
  packet_id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  acknowledgement TEXT,
  timeout_height BIGINT,
  development_only BOOLEAN NOT NULL CHECK (development_only)
);

CREATE TABLE sunrey_explorer.machine (
  machine_id TEXT PRIMARY KEY,
  machine_type TEXT NOT NULL,
  service_offer TEXT NOT NULL,
  resource_category TEXT NOT NULL,
  settled_quantity TEXT NOT NULL,
  delivery_proof_ref TEXT
);

CREATE TABLE sunrey_explorer.settlement (
  settlement_id TEXT PRIMARY KEY,
  market_family TEXT NOT NULL,
  instrument TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  asset_legs_canonical TEXT NOT NULL,
  finalized_height BIGINT NOT NULL
);

CREATE INDEX explorer_tx_height ON sunrey_explorer.tx (height);
CREATE INDEX explorer_tx_actor ON sunrey_explorer.tx (actor);
CREATE INDEX explorer_block_id ON sunrey_explorer.block (block_id);
CREATE INDEX explorer_moonrey_contribution ON sunrey_explorer.moonrey_issuance (contribution_id);
CREATE INDEX explorer_oracle_fact_type ON sunrey_explorer.oracle_fact (fact_type);
CREATE INDEX explorer_account_class ON sunrey_explorer.account (account_class);

REVOKE ALL ON SCHEMA sunrey_explorer FROM PUBLIC;
