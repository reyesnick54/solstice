# HELIOS Alternative Data — Current State (ALT01)

**Repository:** `reyesnick54/solstice`  
**Baseline `origin/main` SHA:** `5242ec46c0c842005b528f25fa89e1124af9e1a0`  
**Qualification marker:** `HELIOS_ALT01_CANONICAL_FABRIC_QUALIFIED`

## Objective

Canonical alternative-data intelligence extends the existing External Data Plane, Provider SDK, Feature Fabric, Temporal Entity Graph, and AAF V2. No parallel planes were introduced.

## Audit summary

| Area | Path | Role |
|------|------|------|
| External Data Plane | `packages/external-data/` | Wave 5 physical economy, Wave 6 jobs/patents/research, provenance, trust |
| Provider SDK | `packages/provider-sdk/` | `ExternalObservation`, health, connector framework |
| Feature Fabric | `packages/platform/src/helios/feature-fabric/` | PIT compiler, revision ledger, coverage tensor, bias sentinel |
| Entity resolution | `packages/platform/src/helios/feature-fabric/entity-resolution/` | AAF03 temporal entity bindings |
| AAF V2 | `packages/platform/src/helios/adaptive-alpha-v2/` | Mandatory gates, dataset certification |
| Productive oracles | `packages/sunrey-chain/src/oracle/` | Productive-economy observations (read-only to HELIOS) |
| Provider catalog | `config/providers/` | `free-api-catalog.yaml` + wave overlays |
| Provider docs | `docs/providers/` | Architecture and wave completion reports |

## Delivered in ALT01

| Component | Path |
|-----------|------|
| Intelligence plane | `packages/platform/src/helios/alternative-data-intelligence/` |
| Feature Fabric slice | `packages/platform/src/helios/feature-fabric/alternative-data/` |
| Architecture doc | `docs/helios/alternative-data/ALT_DATA_ARCHITECTURE.md` |
| Tests | `tests/helios-alt01-canonical-alternative-data-fabric.test.ts` |

## Preserved assets (extended, not replaced)

- Wave 5 physical-economy and Wave 6 jobs/patents/research intelligence surfaces
- Geospatial, maritime, and logistics provider surfaces
- Productive-economy observation references (oracle owner unchanged)
- Provider surfaces: `SATELLITE`, `GEOSPATIAL`, `LOGISTICS_OPERATOR`, `GOVERNMENT`, `MARKET_REFERENCE`
- Provider health, provenance, `knowableAt`, revision ledger, coverage tensor, bias sentinel

## Authority

`REFERENCE_AND_RESEARCH_ONLY` — no alternative-data observation grants Execution Authority.

## Signal families (20)

`WORKFORCE`, `DIGITAL_DEMAND`, `SEARCH_ATTENTION`, `WEB_ACTIVITY`, `APP_ACTIVITY`, `PRODUCT_DEMAND`, `PRODUCT_PRICING`, `LOGISTICS`, `MARITIME`, `SUPPLY_CHAIN`, `GEOSPATIAL`, `SATELLITE`, `PHYSICAL_ACTIVITY`, `PATENTS`, `INNOVATION`, `GOVERNMENT_PROCUREMENT`, `REGULATORY`, `ENERGY`, `CLIMATE`, `COMMODITY_FLOW`

## Domain types

`AlternativeDataObservation`, `AlternativeDataSeries`, `AlternativeDataSourceManifest`, `AlternativeDataFeature`, `AlternativeDataEntityLink`, `AlternativeDataQualityState`, `AlternativeDataEntitlement`, `AlternativeDataRevision`, `AlternativeDataCoverageState`

## PIT rules

- `alternativeData.knowableAt <= decisionTime`
- Backfilled provider data cannot appear in historical research before its historical availability (`providerAvailableAt`)
