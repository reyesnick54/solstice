-- V036 Phase E PEG productization: overlays, insights, suitability,
-- access evidence, and compact history. Not a second ledger.

CREATE TABLE economic_graph.overlay (
  source_event_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  classification TEXT NOT NULL,
  counterpart_canonical TEXT,
  user_corrected BOOLEAN NOT NULL DEFAULT FALSE,
  account_id TEXT,
  amount_canonical TEXT,
  direction TEXT
);

CREATE TABLE economic_graph.account_currency (
  account_id TEXT PRIMARY KEY,
  currency CHAR(3) NOT NULL
);

CREATE TABLE economic_graph.insight (
  insight_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES economic_graph.graph (graph_id),
  insight_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT economic_graph_insight_id_prefix CHECK (insight_id LIKE 'peg_i_%')
);

CREATE TABLE economic_graph.suitability (
  subject_id TEXT PRIMARY KEY,
  body_canonical TEXT NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE economic_graph.access_evidence (
  evidence_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  categories_canonical TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE economic_graph.history_point (
  history_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES economic_graph.graph (graph_id),
  captured_at TIMESTAMPTZ NOT NULL,
  series TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  minor_units BIGINT NOT NULL,
  source_snapshot_id TEXT,
  CONSTRAINT economic_graph_history_id_prefix CHECK (history_id LIKE 'peg_h_%')
);

REVOKE ALL ON TABLE economic_graph.overlay FROM PUBLIC;
REVOKE ALL ON TABLE economic_graph.account_currency FROM PUBLIC;
REVOKE ALL ON TABLE economic_graph.insight FROM PUBLIC;
REVOKE ALL ON TABLE economic_graph.suitability FROM PUBLIC;
REVOKE ALL ON TABLE economic_graph.access_evidence FROM PUBLIC;
REVOKE ALL ON TABLE economic_graph.history_point FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE economic_graph.overlay TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE economic_graph.account_currency TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE economic_graph.insight TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE economic_graph.suitability TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE economic_graph.access_evidence TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE economic_graph.history_point TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE economic_graph.overlay FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE economic_graph.account_currency FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE economic_graph.insight FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE economic_graph.suitability FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE economic_graph.access_evidence FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE economic_graph.history_point FROM customer_app;
