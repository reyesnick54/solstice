-- V009 Personal Economic Graph projection.
-- Non-authoritative. Not a ledger. User-declared rows survive rebuild.

CREATE SCHEMA IF NOT EXISTS economic_graph;

CREATE TABLE economic_graph.graph (
  graph_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL UNIQUE,
  customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  authoritative_balance BOOLEAN NOT NULL DEFAULT FALSE CHECK (authoritative_balance = FALSE),
  mutates_financial_state BOOLEAN NOT NULL DEFAULT FALSE CHECK (mutates_financial_state = FALSE)
);

CREATE TABLE economic_graph.node (
  node_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES economic_graph.graph (graph_id),
  kind TEXT NOT NULL,
  attributes_canonical TEXT NOT NULL,
  canonical_system TEXT,
  canonical_id TEXT,
  quality TEXT NOT NULL,
  confidence TEXT NOT NULL,
  provenance_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  survives_rebuild BOOLEAN NOT NULL,
  CONSTRAINT economic_graph_node_id_prefix CHECK (node_id LIKE 'peg_n_%')
);

CREATE TABLE economic_graph.edge (
  edge_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES economic_graph.graph (graph_id),
  kind TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  quality TEXT NOT NULL,
  confidence TEXT NOT NULL,
  provenance_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  survives_rebuild BOOLEAN NOT NULL,
  CONSTRAINT economic_graph_edge_id_prefix CHECK (edge_id LIKE 'peg_e_%')
);

CREATE TABLE economic_graph.fact (
  fact_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES economic_graph.graph (graph_id),
  node_id TEXT,
  edge_id TEXT,
  fact_key TEXT NOT NULL,
  value_canonical TEXT NOT NULL,
  confidence TEXT NOT NULL,
  quality TEXT NOT NULL,
  provenance_canonical TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  superseded_by TEXT,
  version INTEGER NOT NULL,
  survives_rebuild BOOLEAN NOT NULL,
  CONSTRAINT economic_graph_fact_id_prefix CHECK (fact_id LIKE 'peg_f_%'),
  CONSTRAINT economic_graph_fact_no_authoritative_balance CHECK (
    NOT (fact_key IN ('balance', 'position', 'available', 'liquid_total', 'cross_currency_total')
         AND confidence = 'AUTHORITATIVE')
  )
);

CREATE TABLE economic_graph.activity (
  activity_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES economic_graph.graph (graph_id),
  subject_id TEXT NOT NULL,
  account_id TEXT,
  direction TEXT NOT NULL,
  amount_minor_units BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  counterpart_canonical TEXT,
  classification TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  source_event_type TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  CONSTRAINT economic_graph_activity_id_prefix CHECK (activity_id LIKE 'peg_a_%')
);

CREATE TABLE economic_graph.opportunity (
  opportunity_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES economic_graph.graph (graph_id),
  node_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  related_node_ids TEXT NOT NULL,
  estimated_impact_canonical TEXT,
  status TEXT NOT NULL CHECK (status = 'PROPOSAL'),
  executable BOOLEAN NOT NULL CHECK (executable = FALSE),
  confidence TEXT NOT NULL,
  provenance_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  survives_rebuild BOOLEAN NOT NULL,
  CONSTRAINT economic_graph_opportunity_id_prefix CHECK (opportunity_id LIKE 'peg_o_%')
);

CREATE TABLE economic_graph.snapshot (
  snapshot_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES economic_graph.graph (graph_id),
  generated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT economic_graph_snapshot_id_prefix CHECK (snapshot_id LIKE 'peg_s_%'),
  CONSTRAINT economic_graph_snapshot_no_fx_total CHECK (body_canonical NOT LIKE '%"crossCurrencyTotal":{%')
);

CREATE TABLE economic_graph.processed_event (
  event_id TEXT PRIMARY KEY
);

REVOKE ALL ON SCHEMA economic_graph FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA economic_graph FROM PUBLIC;

GRANT USAGE ON SCHEMA economic_graph TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA economic_graph TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA economic_graph FROM customer_app;
