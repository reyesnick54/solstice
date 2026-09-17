-- V054 HELIOS H16 Strategy Capsule domain.
-- Versioned immutable strategy capsules owned by Strategy Lab.

CREATE TABLE strategy_lab.strategy_capsule (
  strategy_capsule_id TEXT NOT NULL,
  strategy_family_id TEXT NOT NULL,
  version TEXT NOT NULL,
  parent_version TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('GLOBAL', 'CUSTOMER_SCOPED')),
  customer_id TEXT,
  environment TEXT NOT NULL CHECK (environment IN ('simulation', 'PAPER')),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN (
    'DRAFT',
    'RESEARCH_ONLY',
    'EVALUATION_PENDING',
    'EVALUATING',
    'EVALUATION_FAILED',
    'SHADOW_ELIGIBLE',
    'SHADOW_ACTIVE',
    'PAPER_ELIGIBLE',
    'PAPER_ACTIVE',
    'PAUSED',
    'REVIEW_REQUIRED',
    'EXPIRED',
    'REVOKED'
  )),
  material_hash TEXT NOT NULL,
  frozen BOOLEAN NOT NULL,
  simulation_only BOOLEAN NOT NULL CHECK (simulation_only = TRUE),
  llm_deployable BOOLEAN NOT NULL CHECK (llm_deployable = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  qualification_at TIMESTAMPTZ,
  body_canonical TEXT NOT NULL,
  PRIMARY KEY (strategy_capsule_id, version),
  CONSTRAINT strategy_capsule_id_prefix CHECK (strategy_capsule_id LIKE 'scap_%'),
  CONSTRAINT strategy_family_id_prefix CHECK (strategy_family_id LIKE 'sfam_%'),
  CONSTRAINT strategy_capsule_global_no_customer CHECK (
    scope <> 'GLOBAL' OR customer_id IS NULL
  ),
  CONSTRAINT strategy_capsule_customer_scoped CHECK (
    scope <> 'CUSTOMER_SCOPED' OR customer_id IS NOT NULL
  )
);

CREATE INDEX strategy_capsule_family_version_idx
  ON strategy_lab.strategy_capsule (strategy_family_id, version);

GRANT SELECT, INSERT, UPDATE ON strategy_lab.strategy_capsule TO customer_app;
REVOKE DELETE, TRUNCATE ON strategy_lab.strategy_capsule FROM customer_app;
