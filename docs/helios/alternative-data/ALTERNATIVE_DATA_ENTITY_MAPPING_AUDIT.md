# Alternative Data Entity Mapping Audit

**Git SHA:** `68ec6eaa7522a6a463c0c450a3c7d3c19ba29d92`  
**Qualification timestamp (UTC):** `2026-11-07T12:17:54.232Z`  
**Stack marker:** `HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED`  
**Qualified:** yes  
**Posture:** `LIVE_TRADING_ENABLED=false`; `production_authorized=false`  


## Canonical owner (ALT03)

`packages/platform/src/helios/alternative-data/alt03-entity-asset-graph` — qualification marker `HELIOS_ALT03_ENTITY_ASSET_GRAPH_QUALIFIED`.

## Rules

1. Requested entity id must match resolved entity id with confidence ≥ 0.85 or features are blocked (`wrong_company_mapping` scenario).
2. Job posting fingerprints are deduplicated; duplicate density lowers quality scores.
3. Small-employer omission in online job feeds raises coverage warnings and corrections.
4. Entity resolution quality is surfaced on `AlternativeDataResearchState.entityResolutionQuality`.

## Evidence

Mapping audits are research artifacts sealed in `evidenceRefs`; they do not grant execution authority.
