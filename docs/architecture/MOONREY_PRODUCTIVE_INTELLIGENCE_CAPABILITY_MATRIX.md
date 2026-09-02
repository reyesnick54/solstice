# MoonRey Productive Intelligence Capability Matrix

**Status:** Wave 5 audit (simulation)  
**Environment:** `simulation`; all `LIVE_*` flags remain `false`  
**Date:** 2026-09-02

Conservative assessment of MoonRey Productive Economy capabilities on `main`.
Sandbox integrations are **not** labeled production-ready.

## Status legend

| Status | Meaning |
| --- | --- |
| **IMPLEMENTED** | Canonical owner exists; exercised by tests in simulation |
| **PARTIAL** | Building blocks exist; gaps remain before production |
| **SIMULATION** | Engineering-complete in simulation only |
| **TEST_ONLY** | Guard constants or tests without durable runtime |
| **NOT_IMPLEMENTED** | Specified but absent on `main` |
| **BLOCKED** | Explicitly fail-closed; production activation forbidden |
| **FUTURE_WAVE** | Deferred to a later sovereign wave |

## Capability matrix

| Capability | Status | Canonical owner | Notes |
| --- | --- | --- | --- |
| Productive Ontology | **IMPLEMENTED** | `packages/sunrey-chain/src/productive/types.ts` | `PRODUCTIVE_CATEGORIES`, `CLAIM_TYPES`, graph node/edge kinds |
| Productive Categories | **IMPLEMENTED** | `packages/sunrey-chain/src/productive/types.ts` | 15 explicit categories including `AI_COMPUTE`, `AUTOMATED_MACHINE_OUTPUT` |
| Productive Economic Graph | **SIMULATION** | `packages/sunrey-chain/src/productive/engine.ts` | Derived projection; in-memory rebuild |
| Canonical Productive Asset | **PARTIAL** | `packages/sunrey-chain/src/productive/economy-data/registry.ts` | Phase H `ProductiveAssetRegistry`; parallel Chunk 44 `ProductiveEconomicObject` |
| Asset Alias Registry | **IMPLEMENTED** | `packages/sunrey-chain/src/productive/source-taxonomy/types.ts` | `LEGACY_DATA_SOURCE_ALIASES`, `resolveSourceCategory()` |
| Asset Hierarchy | **PARTIAL** | `packages/sunrey-chain/src/productive/objects.ts`, EAR lineage | Parent/child via objects and attribution; no unified hierarchy service |
| Asset Lifecycle | **SIMULATION** | `packages/sunrey-chain/src/productive/types.ts` | `REGISTERED` → `ACTIVE` → `SUSPENDED`/`EXPIRED`/`SUPERSEDED` |
| Productive Event Identity | **IMPLEMENTED** | `packages/sunrey-chain/src/productive/policy-governance/attribution-accounting/identity.ts` | `deriveEconomicEventId()`, relabel-resistant fingerprints |
| Oracle Source Classes | **IMPLEMENTED** | `packages/sunrey-chain/src/oracle/production/provider-families/*/types.ts` | Per-domain `*_SOURCE_CLASSES` (energy, compute, manufacturing, …) |
| Provider Lineage | **IMPLEMENTED** | `packages/sunrey-chain/src/oracle/production/independence.ts` | Controller/upstream clustering; shared-control detection |
| MoonRey Oracle Mesh | **SIMULATION** | `packages/sunrey-chain/src/oracle/`, `oracle/production/` | `OracleEngine` + production quorum + economic-data-fabric; no distributed mesh service |
| Domain Oracle Policies | **SIMULATION** | `packages/sunrey-chain/src/oracle/production/provider-families/` | 12 provider families; fixture/sandbox only |
| Source Independence | **IMPLEMENTED** | `oracle/production/independence.ts`, `quorum.ts` | `countIndependentForQuorum()`, `INSUFFICIENT_INDEPENDENT_CONTROLLERS` |
| Corroboration | **IMPLEMENTED** | `productive/economy-data/verification.ts`, `oracle/aggregation.ts` | Multi-source corroboration required where policy demands |
| Conflict Detection | **IMPLEMENTED** | `oracle/engine.ts`, `oracle/aggregation.ts` | `CONFLICTED` facts; spread/outlier/dispute handling |
| Freshness | **IMPLEMENTED** | `oracle/engine.ts`, `economy-data/verification.ts` | `STALE`/`EXPIRED` rejection |
| Productive Event Resolution | **IMPLEMENTED** | `productive/claim-candidate/`, `productive/verification.ts` | Observation → fact → claim candidate → verified contribution |
| Temporal Overlap Detection | **IMPLEMENTED** | `attribution-accounting/windows.ts`, `book.ts` | `OVERLAPPING_WINDOW_DUPLICATE`, quantized windows |
| Parent/Child Reconciliation | **PARTIAL** | `attribution-accounting/book.ts`, attribution engine | Same-event and cross-category rules; durable parent/child graph reconciliation incomplete |
| Productive Anti-Double-Counting | **IMPLEMENTED** | `productive/fingerprint.ts`, `policy-governance/eligibility.ts`, `attribution-accounting/book.ts` | Fingerprints, capacity/output dedup, attribution book |
| Productive Information Consensus | **PARTIAL** | `oracle/engine.ts`, `productive/economy-data/verification.ts` | No standalone `InformationConsensus` service; distributed consensus stack |
| Productive Economic Claim | **IMPLEMENTED** | `packages/sunrey-chain/src/productive/` | Distinct from observation and verified fact |
| Productive Economic Contribution | **IMPLEMENTED** | `productive/verification.ts` | `VerifiedProductiveContribution`; distinct from claim |
| Productive Value Engine | **SIMULATION** | `productive/policy-governance/value-function/engine.ts` | Chunk 124; engineering implemented, production inactive |
| GPUV | **SIMULATION** | `productive/policy-governance/value-function/` | `PRODUCTIVE_VALUE_UNIT_ID = 'GPUV'`; versioned methodology |
| GPUV Methodology Versioning | **IMPLEMENTED** | `value-function/constitution.ts`, policy registry | `hashValueFunctionPolicy()`, versioned policies |
| GPUV/Market Separation | **IMPLEMENTED** | `value-function/constitution.ts` | `PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MARKET_PRICE`; reference price guards |
| MoonRey Issuance Proposal | **SIMULATION** | `productive/issuance.ts`, `economics/issuance.ts` | V1 formula + V2 governed path; proposal only until Chunk 71 |
| MoonRey Governance Binding | **SIMULATION** | `economics/production-activation/`, Chunk 163 authorization | Parameter packages and authorization rehearsal |
| MoonRey Proof-Bound Issuance | **IMPLEMENTED** | `economics/issuance.ts` | Chunk 71 sole mint; `MOONREY_PRODUCTIVE_AUTHORIZATION` required |
| MoonRey Economic Receipt | **SIMULATION** | `productive/issuance.ts`, `value-settlement/evidence.ts` | Receipts sealed in simulation |
| Productive Claim Challenge | **PARTIAL** | `oracle/engine.ts` (`OracleDispute`) | In-memory disputes; no durable challenge service |
| Productive Source Reputation | **PARTIAL** | `oracle/types.ts`, `oracle/engine.ts` | Counter-based `ReputationMetadata`; no decay/slashing |
| Domain Circuit Breakers | **SIMULATION** | `oracle/production/circuit-breaker.ts`, `governance-ops/launch-abort/` | Connector breakers + domain-scoped incident restrictions |
| Production Providers | **BLOCKED** | `oracle/production/`, `productive-economy-providers/` | `REAL_PROVIDER_CONTACTED = false`; fixture adapters only |
| Production MoonRey Issuance | **BLOCKED** | `protocol/assets.ts`, `economics/issuance.ts` | `moonreyIssuanceActivated(): false`; `PRODUCTION_ISSUANCE_UNCONFIGURED` |
| Mainnet MoonRey Economics | **BLOCKED** | Chunks 143–167, `production-activation/firewall.ts` | Fail-closed; ceremony/freeze/authorization not satisfied |

## Cross-cutting guards (verified)

- `PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT = true`
- `ENERGY_FACT_AUTO_MINTS_MOONREY = false` (all provider families)
- `SINGLE_SOURCE_IS_NOT_CONSENSUS = true`
- `CAPACITY_IS_NOT_OUTPUT = true`
- `moonreyIssuanceActivated(): false`
- `LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED = false`

## Related documentation

- [`moonrey-issuance-model.md`](./moonrey-issuance-model.md)
- [`chunk-120-productive-economic-event-identity.md`](./chunk-120-productive-economic-event-identity.md)
- [`../economics/chunk-124-moonrey-productive-value-engine.md`](../economics/chunk-124-moonrey-productive-value-engine.md)
- [`SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md`](./SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md) §19 Wave 5
