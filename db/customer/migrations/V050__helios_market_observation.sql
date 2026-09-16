-- V050 HELIOS H08 — market observation provenance, freshness, and entitlements.
-- Growth Orchestrator owner. Evidence metadata only; not Execution Authority.
-- Production remains inactive.

CREATE TABLE growth.helios_market_observation (
  observation_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  canonical_instrument_id TEXT NOT NULL,
  venue TEXT,
  observation_type TEXT NOT NULL,
  body_canonical TEXT NOT NULL,
  source_event_time TIMESTAMPTZ,
  knowable_at TIMESTAMPTZ NOT NULL,
  ingestion_time TIMESTAMPTZ NOT NULL,
  entitlement_class TEXT NOT NULL,
  freshness_status TEXT NOT NULL,
  quality_state TEXT NOT NULL,
  lineage_id TEXT NOT NULL,
  duplicate_event_key TEXT,
  upstream_source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT helios_market_observation_id_nonempty CHECK (char_length(observation_id) > 0),
  CONSTRAINT helios_market_observation_type CHECK (observation_type IN (
    'tick', 'quote', 'daily_price', 'corporate_filing', 'economic_release', 'reference_metadata', 'other'
  )),
  CONSTRAINT helios_market_observation_freshness CHECK (freshness_status IN (
    'fresh', 'aging', 'stale', 'expired', 'unknown'
  )),
  CONSTRAINT helios_market_observation_no_ea CHECK (body_canonical NOT LIKE '%ExecutionAuthority%')
);

CREATE INDEX helios_market_observation_instrument_idx
  ON growth.helios_market_observation (canonical_instrument_id, knowable_at DESC);

CREATE INDEX helios_market_observation_lineage_idx
  ON growth.helios_market_observation (duplicate_event_key)
  WHERE duplicate_event_key IS NOT NULL;

CREATE INDEX helios_market_observation_upstream_idx
  ON growth.helios_market_observation (upstream_source_ref)
  WHERE upstream_source_ref IS NOT NULL;
