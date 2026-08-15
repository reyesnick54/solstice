-- V017 Canonical Strategy Lab.
-- Immutable strategy versions, datasets, experiments, backtests, shadow,
-- paper runs, and promotion reviews. No live trading. Experiment history
-- cannot be deleted.

CREATE SCHEMA IF NOT EXISTS strategy_lab;

CREATE TABLE strategy_lab.strategy (
  strategy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  specification_id TEXT NOT NULL,
  compiler_version TEXT,
  compiled_hash TEXT,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN (
    'DRAFT',
    'COMPILED',
    'BACKTESTING',
    'BACKTESTED',
    'VALIDATION_FAILED',
    'REVIEW_REQUIRED',
    'SHADOW_APPROVED',
    'SHADOW_RUNNING',
    'SHADOW_COMPLETED',
    'PAPER_APPROVED',
    'PAPER_RUNNING',
    'PAPER_HALTED',
    'RETIRED'
  )),
  subject_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  mesh_proposal_id TEXT,
  live_approved BOOLEAN NOT NULL CHECK (live_approved = FALSE),
  simulation_only BOOLEAN NOT NULL CHECK (simulation_only = TRUE),
  body_canonical TEXT NOT NULL,
  PRIMARY KEY (strategy_id, version),
  CONSTRAINT strategy_id_prefix CHECK (strategy_id LIKE 'str_%'),
  CONSTRAINT strategy_no_live CHECK (
    lifecycle NOT IN ('LIVE_APPROVED', 'LIVE_RUNNING', 'LIVE')
    AND body_canonical NOT LIKE '%LIVE_APPROVED%'
  )
);

CREATE TABLE strategy_lab.dataset (
  dataset_id TEXT NOT NULL,
  version TEXT NOT NULL,
  hash TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  source TEXT NOT NULL CHECK (source = 'SYNTHETIC_FIXTURE'),
  live_market_data BOOLEAN NOT NULL CHECK (live_market_data = FALSE),
  body_canonical TEXT NOT NULL,
  PRIMARY KEY (dataset_id, version),
  CONSTRAINT dataset_id_prefix CHECK (dataset_id LIKE 'mds_%')
);

CREATE TABLE strategy_lab.experiment (
  experiment_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  selection_criteria TEXT NOT NULL,
  results_retained BOOLEAN NOT NULL CHECK (results_retained = TRUE),
  generated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT experiment_id_prefix CHECK (experiment_id LIKE 'exp_%')
);

CREATE TABLE strategy_lab.parameter_set (
  parameter_set_id TEXT PRIMARY KEY,
  experiment_id TEXT,
  values_canonical TEXT NOT NULL,
  hidden BOOLEAN NOT NULL CHECK (hidden = FALSE),
  CONSTRAINT parameter_set_id_prefix CHECK (parameter_set_id LIKE 'par_%')
);

CREATE TABLE strategy_lab.backtest_run (
  run_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  compiler_version TEXT NOT NULL,
  compiled_hash TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  partition TEXT NOT NULL CHECK (partition IN ('TRAIN', 'VALIDATION', 'OUT_OF_SAMPLE_TEST')),
  starting_capital_minor BIGINT NOT NULL,
  output_hash TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  train_unbiased_claim BOOLEAN NOT NULL CHECK (train_unbiased_claim = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT backtest_run_id_prefix CHECK (run_id LIKE 'btr_%')
);

CREATE TABLE strategy_lab.walk_forward_run (
  run_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT walk_forward_run_id_prefix CHECK (run_id LIKE 'wfr_%')
);

CREATE TABLE strategy_lab.validation_report (
  validation_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  compiler_version TEXT NOT NULL,
  compiled_hash TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  train_unbiased_expected_performance BOOLEAN NOT NULL CHECK (train_unbiased_expected_performance = FALSE),
  future_return_guarantee BOOLEAN NOT NULL CHECK (future_return_guarantee = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT validation_id_prefix CHECK (validation_id LIKE 'svl_%')
);

CREATE TABLE strategy_lab.shadow_run (
  run_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  sends_orders BOOLEAN NOT NULL CHECK (sends_orders = FALSE),
  changes_investment_state BOOLEAN NOT NULL CHECK (changes_investment_state = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT shadow_run_id_prefix CHECK (run_id LIKE 'shd_%')
);

CREATE TABLE strategy_lab.shadow_decision (
  decision_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  would_trade BOOLEAN NOT NULL,
  broker_submission BOOLEAN NOT NULL CHECK (broker_submission = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT shadow_decision_id_prefix CHECK (decision_id LIKE 'sdec_%')
);

CREATE TABLE strategy_lab.paper_run (
  run_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  investment_account_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  halt_reason TEXT,
  track TEXT NOT NULL CHECK (track = 'PAPER'),
  merged_into_backtest BOOLEAN NOT NULL CHECK (merged_into_backtest = FALSE),
  live_broker BOOLEAN NOT NULL CHECK (live_broker = FALSE),
  body_canonical TEXT NOT NULL,
  CONSTRAINT paper_run_id_prefix CHECK (run_id LIKE 'psr_%')
);

CREATE TABLE strategy_lab.promotion_review (
  review_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('SHADOW_APPROVED', 'PAPER_APPROVED')),
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind = 'HUMAN_OPERATOR'),
  reason TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  accepted BOOLEAN NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT promotion_review_id_prefix CHECK (review_id LIKE 'spr_%')
);

CREATE TABLE strategy_lab.kill_switch (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  active BOOLEAN NOT NULL,
  reason TEXT,
  activated_at TIMESTAMPTZ,
  blocks_new_orders BOOLEAN NOT NULL CHECK (blocks_new_orders = TRUE),
  history_immutable BOOLEAN NOT NULL CHECK (history_immutable = TRUE),
  body_canonical TEXT NOT NULL
);
