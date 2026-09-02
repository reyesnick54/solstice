# SunRey Economic Awareness Capability Matrix

**Status:** Wave 4 exit-gate audit (2026-09-02)  
**Environment:** `ENVIRONMENT=simulation`; all `LIVE_*` flags `false`  
**Legend:** **IMPLEMENTED** · **PARTIAL** · **SIMULATION** · **TEST ONLY** · **NOT IMPLEMENTED** · **BLOCKED** · **FUTURE WAVE**

This matrix assesses the **sovereign Wave 4 — Economic Awareness Fabric** program (see `SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md` §19), not the separate external-data “Wave 4” compliance/KYB provider program.

---

## Provider plane

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Provider Registry | IMPLEMENTED | `packages/provider-sdk/src/registry.ts`, `config/providers/free-api-catalog.yaml` |
| Provider Lineage | PARTIAL | `economic-data-fabric/lineage.ts`, `provider-sdk/trust/factors.ts` (`countIndependentSources`); no cross-plane lineage registry |
| Source Classes | IMPLEMENTED | `packages/sunrey-chain/src/productive/source-taxonomy/`, `oracle/source-taxonomy/` |
| Connector Framework | SIMULATION | `packages/sunrey-chain/src/oracle/production/runtime.ts`, `provider-sdk/pipeline.ts` |
| REST Connector | SIMULATION | `packages/provider-sdk/src/transport.ts` (fixture/sandbox only in CI) |
| Other Connector Types | PARTIAL | HIN authorized connector (`information-market/network/connectors.ts`); no universal multi-protocol fabric connector |
| Secret Boundary | IMPLEMENTED | `packages/provider-sdk/src/redaction.ts`, `packages/security` secret refs |
| Rate Limiting | IMPLEMENTED | `packages/provider-sdk/src/rate-limit.ts`, `reliability.ts` |
| Provider Health | IMPLEMENTED | Registry health states, `provider-sdk/trust` quarantine mapping |
| Provider Certification | SIMULATION | `packages/provider-sdk/src/certification/`, Chunk 128 oracle certification sandbox |

---

## Observation plane

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Observation Envelope | PARTIAL | `ExternalObservation` (`provider-sdk`); parallel `EconomicDataCollectionEnvelope`, `EconomicObservation` |
| Unit Normalization | IMPLEMENTED | `packages/sunrey-chain/src/units/`, energy/manufacturing family adapters |
| Temporal Normalization | IMPLEMENTED | `provider-sdk/freshness.ts`, energy `intervals.ts` |
| Geographic Normalization | PARTIAL | Fabric envelope geography keys; not unified across all planes |
| Schema Evolution | PARTIAL | Version fields on envelopes; drift rejection in family adapters |
| Unlabeled numeric rejection | IMPLEMENTED | Energy adapter, economy-data verification, trust engine unit checks |

---

## Event / provenance plane

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Event Fabric | PARTIAL | Domain events (`packages/events`); provider quality events (`provider-sdk/events.ts`); no fabric-wide durable journal |
| Idempotency | PARTIAL | `EconomicDataFabricStore` batch replay; HIN anchor dedup; not durable cross-restart for full fabric |
| Provenance Graph | PARTIAL | `economic-data-fabric/reconciliation.ts`, `economic-asset-registry/lineage.ts`, PEG provenance |
| Dead Letter Handling | PARTIAL | Quarantine events in wave4 cyber/compliance; no unified fabric DLQ with replay governance |
| Consumer restart safety | SIMULATION | In-memory stores; PostgreSQL economic-graph migration exists for PEG only |

---

## Federation plane

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Federated Query | NOT IMPLEMENTED | No `FederatedQuery` owner; domain services queried independently |
| Purpose-Aware Query | PARTIAL | HIN/PDV/consent (`information-market`, `personal-data-vault`); not fabric-unified |
| Query Audit | PARTIAL | HIN privacy budget; kernel compliance evidence audit; no cross-plane federation audit trail |
| Trino Integration | NOT IMPLEMENTED | — |
| NiFi Integration | NOT IMPLEMENTED | — |

---

## Economic graph plane

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Economic Knowledge Graph | PARTIAL | PEG (`packages/personal-economic-graph`); economic-asset-registry projections |
| Apache AGE Integration | NOT IMPLEMENTED | PG schema `V009__economic_graph.sql` without AGE |
| Canonical Entity IDs | PARTIAL | Branded PEG IDs, asset `sourceIdentityKey`; no global entity ID mesh |
| Entity Resolution | PARTIAL | KYB name normalization (`wave-4-prompt-16`); manufacturing `evaluateSourceIndependence`; no governed ER mesh |
| Alias Registry | PARTIAL | Asset registry dedup keys; no durable cross-provider alias store |
| Productive Economic Graph | PARTIAL | Chunk 138 fabric families + productive claim lineage; not Wave 5 specialization |
| Human Economic Graph | PARTIAL | HIN + Human Contribution Registry; not Wave 6 graph specialization |

---

## Information consensus plane

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Source Reputation | IMPLEMENTED | `provider-sdk/trust/engine.ts`, wave7 trust wrapper |
| Source Independence | IMPLEMENTED | `countIndependentSources`, energy `sameControllerFakeQuorum`, resource independence classes |
| Corroboration | IMPLEMENTED | Trust engine corroboration bonus; economy-data `MULTI_SOURCE_CORROBORATED` |
| Conflict Detection | IMPLEMENTED | Trust `CONFLICTED`; fabric `reportCrossProviderConflicts` |
| Freshness | IMPLEMENTED | `provider-sdk/freshness.ts`, stale exclusion in trust engine |
| Information Consensus (unified) | NOT IMPLEMENTED | `SUNREY_BLOCKCHAIN_CAPABILITY_MATRIX.md` — separate trust engine vs oracle quorum |
| VerifiedEconomicFact Production | SIMULATION | `packages/sunrey-chain/src/oracle/engine.ts`, `production/quorum.ts` |
| MoonRey Oracle Mesh | FUTURE WAVE | Wave 5 prerequisite — not started |
| SunRey Contribution Attestation Mesh | FUTURE WAVE | Wave 6 prerequisite — not started |

---

## Authority boundaries (verified)

| Layer | Can mint / issue EA? | Status |
| --- | --- | --- |
| Provider / Connector | No | PASS — connector runtime types forbid auto-finalize |
| Observation envelope | No | PASS |
| Event bus / fabric store | No | PASS |
| Federated query | N/A | NOT IMPLEMENTED |
| Economic graph / ER | No | PASS |
| Source reputation / trust engine | No | PASS |
| Information consensus (oracle quorum) | No | PASS — facts ≠ money |
| VerifiedEconomicFact | No | PASS — `oracleFactCreationNeverMintsMoonRey()` |
| AI runtime | No | PASS |

---

## Test coverage

| Suite | Scope |
| --- | --- |
| `tests/wave-4-economic-awareness-exit-gate.test.ts` | Wave 4 fabric exit-gate red team (20 scenarios) |
| `packages/sunrey-chain/src/oracle-unified-economic-data-fabric.test.ts` | Chunk 138 fabric (28 tests) |
| `tests/wave-7-prompt-26-external-data-trust-engine.test.ts` | Trust engine (26 tests) |
| `packages/external-data/src/wave4.test.ts` | External-data Wave 4 compliance/cyber |
| `tests/chunk-115-economic-asset-fabric.test.ts` | Cross-domain asset fabric boundaries |

---

## Summary

| Maturity band | Count |
| --- | --- |
| IMPLEMENTED / SIMULATION (building blocks) | ~22 |
| PARTIAL | ~18 |
| NOT IMPLEMENTED | ~6 |
| FUTURE WAVE | 2 |

**Bottom line:** Strong **observation ingestion and trust-engine** building blocks exist in simulation. The **unified Economic Awareness Fabric** (durable journal, federated query, entity-resolution mesh, unified information consensus) required for Wave 5/6 handoff is **not complete**.
