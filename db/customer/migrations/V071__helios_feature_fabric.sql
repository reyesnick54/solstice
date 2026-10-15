-- V071 HELIOS AAF02 — evidence-time feature fabric durable records.
-- Research / Strategy Lab artifacts only. Does not post journals or issue Execution Authority.

CREATE TABLE growth.helios_feature_observation (
  feature_observation_id TEXT PRIMARY KEY,
  feature_id TEXT NOT NULL,
  feature_version TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  canonical_entity_id TEXT NOT NULL,
  canonical_instrument_id TEXT,
  knowable_at TIMESTAMPTZ NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  lineage_id TEXT NOT NULL,
  transformation_version TEXT NOT NULL,
  evidence_ref_hash TEXT,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT helios_feature_obs_id_nonempty CHECK (char_length(feature_observation_id) > 0),
  CONSTRAINT helios_feature_obs_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialMutation":true%'
    AND body_canonical NOT LIKE '%"authorizesFinancialExecution":true%'
  )
);

CREATE INDEX helios_feature_obs_feature_knowable_idx
  ON growth.helios_feature_observation (feature_id, knowable_at DESC);

CREATE INDEX helios_feature_obs_entity_idx
  ON growth.helios_feature_observation (canonical_entity_id, knowable_at DESC);

CREATE TABLE growth.helios_feature_manifest (
  manifest_id TEXT PRIMARY KEY,
  evaluation_timestamp TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT helios_feature_manifest_no_ea CHECK (
    body_canonical NOT LIKE '%"grantsExecutionAuthority":true%'
    AND body_canonical NOT LIKE '%"grantsFinancialMutation":true%'
  )
);

CREATE INDEX helios_feature_manifest_eval_idx
  ON growth.helios_feature_manifest (evaluation_timestamp DESC);

REVOKE ALL ON TABLE growth.helios_feature_observation FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_feature_observation TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_feature_observation FROM customer_app;

REVOKE ALL ON TABLE growth.helios_feature_manifest FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE growth.helios_feature_manifest TO customer_app;
REVOKE DELETE, UPDATE, TRUNCATE ON TABLE growth.helios_feature_manifest FROM customer_app;
