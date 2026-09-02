-- V041 Wave 4 Economic Knowledge Graph — relationship intelligence layer.
-- Not blockchain. Not monetary authority. Intelligence projection only.
-- Apache AGE deferred; adjacency tables are the active simulation backend.

CREATE SCHEMA IF NOT EXISTS economic_knowledge_graph;

CREATE TABLE economic_knowledge_graph.node (
  node_id TEXT PRIMARY KEY,
  node_class TEXT NOT NULL,
  domain TEXT NOT NULL,
  canonical_entity_id TEXT,
  label TEXT NOT NULL,
  external_ref TEXT,
  payload_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  authoritative BOOLEAN NOT NULL DEFAULT FALSE CHECK (authoritative = FALSE),
  mutates_financial_state BOOLEAN NOT NULL DEFAULT FALSE CHECK (mutates_financial_state = FALSE),
  CONSTRAINT economic_knowledge_graph_node_id_prefix CHECK (node_id LIKE 'ekg_n_%')
);

CREATE TABLE economic_knowledge_graph.edge (
  edge_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  from_node_id TEXT NOT NULL REFERENCES economic_knowledge_graph.node (node_id),
  to_node_id TEXT NOT NULL REFERENCES economic_knowledge_graph.node (node_id),
  domain TEXT NOT NULL,
  authorized BOOLEAN NOT NULL,
  provenance_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT economic_knowledge_graph_edge_id_prefix CHECK (edge_id LIKE 'ekg_e_%')
);

CREATE TABLE economic_knowledge_graph.alias (
  alias_id TEXT PRIMARY KEY,
  canonical_entity_id TEXT NOT NULL,
  system TEXT NOT NULL,
  external_id TEXT NOT NULL,
  preserved_original_id TEXT NOT NULL,
  merge_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT economic_knowledge_graph_alias_id_prefix CHECK (alias_id LIKE 'ekg_a_%'),
  CONSTRAINT economic_knowledge_graph_alias_unique UNIQUE (system, external_id)
);

CREATE TABLE economic_knowledge_graph.entity_resolution (
  resolution_id TEXT PRIMARY KEY,
  outcome TEXT NOT NULL,
  method TEXT NOT NULL,
  canonical_entity_id TEXT,
  input_identifiers_canonical TEXT NOT NULL,
  candidate_entity_ids_canonical TEXT NOT NULL,
  confidence DOUBLE PRECISION,
  auto_merged BOOLEAN NOT NULL DEFAULT FALSE CHECK (auto_merged = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT economic_knowledge_graph_resolution_id_prefix CHECK (resolution_id LIKE 'ekg_res_%')
);

CREATE TABLE economic_knowledge_graph.match_suggestion (
  suggestion_id TEXT PRIMARY KEY,
  left_system TEXT NOT NULL,
  left_id TEXT NOT NULL,
  right_system TEXT NOT NULL,
  right_id TEXT NOT NULL,
  suggested_outcome TEXT NOT NULL,
  method TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  high_impact BOOLEAN NOT NULL,
  requires_governed_review BOOLEAN NOT NULL,
  auto_applied BOOLEAN NOT NULL DEFAULT FALSE CHECK (auto_applied = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT economic_knowledge_graph_suggestion_id_prefix CHECK (suggestion_id LIKE 'ekg_sug_%')
);

CREATE TABLE economic_knowledge_graph.claim_linkage (
  claim_id TEXT NOT NULL,
  claim_class TEXT NOT NULL,
  claim_node_id TEXT NOT NULL REFERENCES economic_knowledge_graph.node (node_id),
  canonical_event_node_id TEXT NOT NULL REFERENCES economic_knowledge_graph.node (node_id),
  observation_node_ids_canonical TEXT NOT NULL,
  evidence_node_ids_canonical TEXT NOT NULL,
  provider_node_ids_canonical TEXT NOT NULL,
  PRIMARY KEY (claim_id, claim_class)
);

CREATE INDEX economic_knowledge_graph_edge_from_idx ON economic_knowledge_graph.edge (from_node_id);
CREATE INDEX economic_knowledge_graph_edge_to_idx ON economic_knowledge_graph.edge (to_node_id);
CREATE INDEX economic_knowledge_graph_alias_canonical_idx ON economic_knowledge_graph.alias (canonical_entity_id);

GRANT USAGE ON SCHEMA economic_knowledge_graph TO customer_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA economic_knowledge_graph TO customer_app;
