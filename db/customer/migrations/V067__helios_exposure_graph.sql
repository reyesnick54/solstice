-- V067 HELIOS M18 — portfolio exposure graph persistence.
-- Read-model snapshots only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_portfolio_exposure_graph (
  graph_id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT helios_exposure_graph_id_prefix CHECK (graph_id LIKE 'peg_%'),
  CONSTRAINT helios_exposure_graph_simulation_only CHECK (
    body_canonical LIKE '%"simulationOnly":true%'
  )
);

CREATE INDEX helios_portfolio_exposure_graph_portfolio_as_of_idx
  ON growth.helios_portfolio_exposure_graph (portfolio_id, as_of DESC);

REVOKE ALL ON TABLE growth.helios_portfolio_exposure_graph FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_portfolio_exposure_graph TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_portfolio_exposure_graph FROM customer_app;
