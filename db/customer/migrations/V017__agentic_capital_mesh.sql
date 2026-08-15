-- V017 Agentic Capital Mesh.
-- Structured run, thesis, candidate, review, arbitration, and proposal records.
-- No private reasoning traces. No secrets. No raw model prompt dumps.
-- Simulation proposal layer only. Not a ledger and not an order book.

CREATE SCHEMA IF NOT EXISTS capital_mesh;

CREATE TABLE capital_mesh.run (
  run_id TEXT PRIMARY KEY,
  mesh_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'CREATED',
    'CONTEXT_BOUND',
    'ANALYZING',
    'GENERATING_CANDIDATES',
    'CHALLENGING',
    'RISK_EVALUATING',
    'ARBITRATING',
    'PROPOSAL_READY',
    'COMPLETED',
    'REFUSED',
    'FAILED',
    'STALE',
    'CANCELLED'
  )),
  context_id TEXT,
  user_objective TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT capital_mesh_run_id_prefix CHECK (run_id LIKE 'cmrun_%')
);

CREATE TABLE capital_mesh.context_ref (
  context_id TEXT PRIMARY KEY,
  mesh_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  write_path BOOLEAN NOT NULL CHECK (write_path = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT capital_mesh_context_id_prefix CHECK (context_id LIKE 'cmctx_%')
);

CREATE TABLE capital_mesh.thesis (
  thesis_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  objective TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  is_trade BOOLEAN NOT NULL CHECK (is_trade = FALSE),
  guaranteed_return BOOLEAN NOT NULL CHECK (guaranteed_return = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT capital_mesh_thesis_id_prefix CHECK (thesis_id LIKE 'cmth_%'),
  CONSTRAINT capital_mesh_thesis_no_guaranteed CHECK (
    body_canonical NOT LIKE '%GUARANTEED_PROFIT%'
    AND body_canonical NOT LIKE '%CERTAIN_RETURN%'
  )
);

CREATE TABLE capital_mesh.candidate (
  candidate_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  scale INTEGER NOT NULL CHECK (scale = 8),
  totals_exactly BOOLEAN NOT NULL CHECK (totals_exactly = TRUE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT capital_mesh_candidate_id_prefix CHECK (candidate_id LIKE 'cmac_%')
);

CREATE TABLE capital_mesh.review (
  review_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT capital_mesh_review_id_prefix CHECK (review_id LIKE 'cmrev_%')
);

CREATE TABLE capital_mesh.arbitration (
  arbitration_id TEXT PRIMARY KEY,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'PROPOSAL_READY',
    'NEEDS_MORE_DATA',
    'NEEDS_BACKTEST',
    'NEEDS_HUMAN_REVIEW',
    'BLOCKED'
  )),
  agent_votes_authorize BOOLEAN NOT NULL CHECK (agent_votes_authorize = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT capital_mesh_arbitration_id_prefix CHECK (arbitration_id LIKE 'cmarb_%')
);

CREATE TABLE capital_mesh.proposal (
  proposal_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  strategy_validation TEXT NOT NULL CHECK (strategy_validation IN (
    'UNVALIDATED',
    'NEEDS_BACKTEST',
    'PAPER_ONLY_PENDING_VALIDATION',
    'REJECTED'
  )),
  stale BOOLEAN NOT NULL,
  executable BOOLEAN NOT NULL CHECK (executable = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT capital_mesh_proposal_id_prefix CHECK (proposal_id LIKE 'cmpr_%'),
  CONSTRAINT capital_mesh_proposal_not_validated CHECK (strategy_validation <> 'VALIDATED')
);

CREATE TABLE capital_mesh.node_output (
  node_id TEXT NOT NULL,
  role TEXT NOT NULL,
  stance TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT capital_mesh_node_no_prompt CHECK (
    body_canonical NOT LIKE '%BEGIN_PROMPT%'
    AND body_canonical NOT LIKE '%system prompt%'
  )
);

REVOKE ALL ON SCHEMA capital_mesh FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA capital_mesh FROM PUBLIC;

GRANT USAGE ON SCHEMA capital_mesh TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA capital_mesh TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA capital_mesh FROM customer_app;
