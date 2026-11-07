# Alternative Data Entity Mapping Audit

**Marker:** `HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED`

## Rules

1. Requested entity id must match resolved entity id with confidence ≥ 0.85 or features are blocked (`wrong_company_mapping` scenario).
2. Job posting fingerprints are deduplicated; duplicate density lowers quality scores.
3. Small-employer omission in online job feeds raises coverage warnings and corrections.
4. Entity resolution quality is surfaced on `AlternativeDataResearchState.entityResolutionQuality`.

## Evidence

Mapping audits are research artifacts sealed in `evidenceRefs`; they do not grant execution authority.
