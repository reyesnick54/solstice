# Alternative Data Capability Matrix

**Git SHA:** `faf85de7fe517971e0ce34fadbb7af33fc9986c6`  
**Qualification timestamp (UTC):** `2026-11-07T11:42:36.763Z`  
**Stack marker:** `HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED`  
**Qualified:** no  
**Posture:** `LIVE_TRADING_ENABLED=false`; `production_authorized=false`  


| Package | Capability | Implementation owner | Qualification marker | Result |
|---------|------------|----------------------|----------------------|--------|
| ALT01 | Canonical alternative-data feature fabric | `packages/platform/src/helios/feature-fabric/alternative-data` | `HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_QUALIFIED` | QUALIFIED |
| ALT02 | Rights, provenance, and ingestion firewall | `packages/provider-sdk/src/alternative-data-rights; packages/external-data/src/alternative-data-rights; packages/platform/src/helios/adaptive-alpha-fabric/alt02` | `HELIOS_ALT02_DATA_RIGHTS_FIREWALL_QUALIFIED` | QUALIFIED |
| ALT03 | Entity and asset resolution graph | `packages/platform/src/helios/alternative-data/alt03-entity-asset-graph` | `HELIOS_ALT03_ENTITY_ASSET_GRAPH_QUALIFIED` | QUALIFIED |
| ALT04 | Workforce and hiring intelligence | `packages/platform/src/helios/alternative-data-intelligence/alt04-workforce` | `HELIOS_ALT04_WORKFORCE_INTELLIGENCE_QUALIFIED` | QUALIFIED |
| ALT05 | Digital demand and attention intelligence | `packages/platform/src/helios/alternative-data-intelligence/alt05` | `HELIOS_ALT05_DIGITAL_DEMAND_QUALIFIED` | QUALIFIED |
| ALT06 | Product, pricing, and availability intelligence | `packages/platform/src/helios/alternative-data/alt06; packages/external-data/src/product-demand` | `HELIOS_ALT06_PRODUCT_DEMAND_QUALIFIED` | QUALIFIED |
| ALT07 | Maritime, logistics, and commodity flow intelligence | `packages/platform/src/helios/alternative-data-intelligence/alt07-logistics-flow` | `HELIOS_ALT07_LOGISTICS_FLOW_QUALIFIED` | QUALIFIED |
| ALT08 | Geospatial and satellite activity intelligence | `packages/platform/src/helios/alternative-data-intelligence/geospatial-activity` | `HELIOS_ALT08_GEOSPATIAL_ACTIVITY_QUALIFIED` | QUALIFIED |
| ALT09 | Patent, technology, and commercialization intelligence | `packages/platform/src/helios/alternative-data-intelligence/alt09` | `HELIOS_ALT09_INNOVATION_INTELLIGENCE_QUALIFIED` | QUALIFIED |
| ALT10 | Government procurement and contract intelligence | `packages/platform/src/helios/procurement-intelligence; packages/external-data/src/procurement` | `HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_QUALIFIED` | QUALIFIED |
| ALT11 | Supply-chain knowledge graph and risk propagation | `packages/platform/src/helios/alternative-data/alt11-supply-chain-graph` | `HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_QUALIFIED` | QUALIFIED |
| ALT12 | Missing-aware multimodal fusion and signal routing | `packages/platform/src/helios/alternative-data-intelligence/alt12` | `HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED` | QUALIFIED |
| ALT13 | Incremental information and redundancy assessment | `packages/platform/src/helios/alternative-data/alt13` | `HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED` | QUALIFIED |
| ALT14 | Agentic research mesh and stack final qualification | `packages/platform/src/helios/alternative-data-intelligence/alt14-qualification.ts; packages/agentic-capital-mesh/src/alternative-data-research-alt14` | `HELIOS_ALT14_STACK_HOOK_PRESENT` | QUALIFIED |

Raw provider records do **not** enter Strategy Genome; only AAF-certified feature ids are exposed.
