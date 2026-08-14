-- V003 policy engine: versioned packs, rules, sources, capabilities, review cases.
-- Policy meaning is immutable after a version is used. This is not a second Kernel.
-- No rule in this schema is CONFIRMED_BY_COUNSEL.

CREATE TABLE customer.policy_source (
  source_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'INTERNAL_RESEARCH_MEMO',
      'LEGAL_MEMO',
      'REGULATOR_PUBLICATION',
      'LEGISLATION',
      'COUNSEL_DECISION'
    )
  ),
  citation TEXT NOT NULL,
  uri TEXT,
  notes TEXT
);

CREATE TABLE customer.policy_pack (
  pack_id TEXT PRIMARY KEY CHECK (pack_id IN ('US', 'GB', 'EU', 'SA', 'AE')),
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE customer.policy_version (
  version_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES customer.policy_pack (pack_id),
  version TEXT NOT NULL,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('DRAFT', 'ACTIVE_SIMULATION', 'RETIRED')),
  legal_review_status TEXT NOT NULL CHECK (
    legal_review_status IN ('DRAFT', 'RESEARCH_REQUIRED', 'COUNSEL_REVIEWED', 'CONFIRMED_BY_COUNSEL')
  ),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,
  content_hash TEXT NOT NULL,
  used_in_decision BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (pack_id, version)
);

CREATE TABLE customer.policy_rule (
  pack_id TEXT NOT NULL,
  version_id TEXT NOT NULL REFERENCES customer.policy_version (version_id),
  rule_id TEXT NOT NULL,
  version TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  scope TEXT NOT NULL,
  action_types TEXT[] NOT NULL,
  product_types TEXT[] NOT NULL,
  customer_types TEXT[] NOT NULL,
  legal_entity TEXT,
  predicate_canonical JSONB NOT NULL,
  effect TEXT NOT NULL CHECK (effect IN ('ALLOW', 'REQUIRE_MANUAL_REVIEW', 'DEFER', 'BLOCK')),
  reason_code TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,
  source_reference TEXT,
  legal_review_status TEXT NOT NULL CHECK (
    legal_review_status IN ('DRAFT', 'RESEARCH_REQUIRED', 'COUNSEL_REVIEWED', 'CONFIRMED_BY_COUNSEL')
  ),
  override_class TEXT NOT NULL CHECK (override_class IN ('HARD_BLOCK', 'REVIEWABLE')),
  PRIMARY KEY (version_id, rule_id)
);

CREATE TABLE customer.legal_entity_capability (
  capability_id TEXT PRIMARY KEY,
  legal_entity_id TEXT NOT NULL,
  action_types TEXT[] NOT NULL,
  product_ids TEXT[] NOT NULL,
  product_types TEXT[] NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('simulation', 'live')),
  enabled BOOLEAN NOT NULL,
  legal_review_status TEXT NOT NULL CHECK (
    legal_review_status IN ('DRAFT', 'RESEARCH_REQUIRED', 'COUNSEL_REVIEWED', 'CONFIRMED_BY_COUNSEL')
  ),
  source_reference TEXT
);

CREATE TABLE customer.policy_product_binding (
  product_id TEXT PRIMARY KEY,
  serving_legal_entity_id TEXT NOT NULL,
  supported_jurisdictions TEXT[] NOT NULL,
  currency CHAR(3) NOT NULL,
  account_class TEXT NOT NULL,
  required_capability_id TEXT NOT NULL,
  offering_mode TEXT NOT NULL CHECK (offering_mode IN ('SIMULATION', 'LIVE_DISABLED')),
  disclosure_refs TEXT[] NOT NULL
);

CREATE TABLE customer.manual_review_case (
  review_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ASSIGNED', 'APPROVED', 'DECLINED', 'EXPIRED')),
  reason_codes TEXT[] NOT NULL,
  snapshot_canonical JSONB NOT NULL,
  facts_hash TEXT NOT NULL,
  override_class TEXT NOT NULL CHECK (override_class IN ('HARD_BLOCK', 'REVIEWABLE')),
  created_at TIMESTAMPTZ NOT NULL,
  assigned_to TEXT,
  decided_at TIMESTAMPTZ,
  decided_by_kind TEXT CHECK (decided_by_kind IN ('HUMAN_OPERATOR', 'AGENT', 'AI')),
  decided_by_actor_id TEXT,
  decision_note TEXT
);

REVOKE ALL ON TABLE customer.policy_source FROM PUBLIC;
REVOKE ALL ON TABLE customer.policy_pack FROM PUBLIC;
REVOKE ALL ON TABLE customer.policy_version FROM PUBLIC;
REVOKE ALL ON TABLE customer.policy_rule FROM PUBLIC;
REVOKE ALL ON TABLE customer.legal_entity_capability FROM PUBLIC;
REVOKE ALL ON TABLE customer.policy_product_binding FROM PUBLIC;
REVOKE ALL ON TABLE customer.manual_review_case FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE customer.policy_source TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE customer.policy_pack TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE customer.policy_version TO customer_app;
GRANT SELECT, INSERT ON TABLE customer.policy_rule TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE customer.legal_entity_capability TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE customer.policy_product_binding TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE customer.manual_review_case TO customer_app;

REVOKE DELETE, TRUNCATE ON TABLE customer.policy_source FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE customer.policy_pack FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE customer.policy_version FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE customer.policy_rule FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE customer.legal_entity_capability FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE customer.policy_product_binding FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE customer.manual_review_case FROM customer_app;
