-- V012 Personal Economic Value Engine.
-- Measurement and attribution only. Not a financial ledger.
-- Does not store balances as authoritative state or guaranteed returns.

CREATE SCHEMA IF NOT EXISTS peve;

CREATE TABLE peve.formula_version (
  formula_version TEXT NOT NULL,
  model_version TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  weights_canonical TEXT NOT NULL,
  weight_denominator INTEGER NOT NULL,
  reserve_coverage_target_months INTEGER NOT NULL,
  attributed_value_scale_minor_units TEXT NOT NULL,
  research_required BOOLEAN NOT NULL,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  PRIMARY KEY (formula_version, model_version),
  CONSTRAINT peve_formula_version_prefix CHECK (formula_version LIKE 'peve-formula-v%'),
  CONSTRAINT peve_model_version_prefix CHECK (model_version LIKE 'peve-model-v%'),
  CONSTRAINT peve_formula_no_apy CHECK (
    weights_canonical NOT LIKE '%apy%'
    AND weights_canonical NOT LIKE '%APR%'
    AND weights_canonical NOT LIKE '%guaranteedReturn%'
  )
);

CREATE TABLE peve.snapshot (
  snapshot_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  peg_snapshot_id TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  model_version TEXT NOT NULL,
  completeness TEXT NOT NULL,
  confidence TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  restated BOOLEAN NOT NULL,
  CONSTRAINT peve_snapshot_id_prefix CHECK (snapshot_id LIKE 'evs_%'),
  CONSTRAINT peve_snapshot_no_human_worth CHECK (
    body_canonical LIKE '%notHumanWorth%'
  ),
  CONSTRAINT peve_snapshot_no_guaranteed_return CHECK (
    body_canonical NOT LIKE '%guaranteedReturn%'
    AND body_canonical NOT LIKE '%blendedYield%'
  )
);

CREATE TABLE peve.dimension_result (
  dimension_id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  points TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  confidence TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT peve_dimension_id_prefix CHECK (dimension_id LIKE 'evd_%'),
  CONSTRAINT peve_dimension_index_not_money CHECK (
    body_canonical LIKE '%"kind":"INDEX"%'
  )
);

CREATE TABLE peve.attribution_entry (
  entry_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  realization TEXT NOT NULL,
  attribution_type TEXT NOT NULL,
  minor_units TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  is_primary_for_group BOOLEAN NOT NULL,
  formula_version TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT peve_attribution_id_prefix CHECK (entry_id LIKE 'gae_%'),
  CONSTRAINT peve_attribution_no_principal CHECK (
    body_canonical LIKE '%"principalMovement":false%'
  ),
  CONSTRAINT peve_attribution_no_journal CHECK (
    body_canonical LIKE '%"postsJournal":false%'
  )
);

CREATE TABLE peve.attribution_group (
  group_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  CONSTRAINT peve_group_id_prefix CHECK (group_id LIKE 'gag_%')
);

CREATE TABLE peve.counterfactual_baseline (
  baseline_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT peve_baseline_id_prefix CHECK (baseline_id LIKE 'cfb_%'),
  CONSTRAINT peve_baseline_not_guaranteed CHECK (
    body_canonical LIKE '%"guaranteed":false%'
  )
);

CREATE TABLE peve.model_comparison (
  left_formula TEXT NOT NULL,
  left_model TEXT NOT NULL,
  right_formula TEXT NOT NULL,
  right_model TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  compared_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (left_formula, left_model, right_formula, right_model)
);

CREATE TABLE peve.data_contribution (
  reference_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  estimated_labeled BOOLEAN NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT peve_contribution_id_prefix CHECK (reference_id LIKE 'dcr_%'),
  CONSTRAINT peve_contribution_not_guaranteed CHECK (
    body_canonical LIKE '%"guaranteedCompensation":false%'
  ),
  CONSTRAINT peve_contribution_no_token CHECK (
    body_canonical LIKE '%"tokenValuation":false%'
  )
);

REVOKE ALL ON SCHEMA peve FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA peve FROM PUBLIC;

GRANT USAGE ON SCHEMA peve TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA peve TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA peve FROM customer_app;
