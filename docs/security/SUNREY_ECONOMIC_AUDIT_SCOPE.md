# SunRey Economic Audit Scope

**Wave 9 — External economic and mechanism design review**  
**Date:** 2026-09-02 (UTC)  
**Commit:** `1a6eafa55ece2446c65ca2a5320370df896e7240`

---

## Status

```
ECONOMIC_AUDIT_COMPLETE=false
PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED=false
PRODUCTION_MOONREY_ISSUANCE_DISABLED=true
moonreyIssuanceActivated()=false
MAINNET_ECONOMICS_AUTHORIZED=false
ENVIRONMENT=simulation
```

**This document does not claim that an external economic or mechanism audit has been commissioned, executed, or passed.** Wave completion (2–8) documents engineering implementation, not approval for live issuance.

---

## 1. Engagement objectives

A qualified external economic/mechanism auditor should:

1. Review dual-economy monetary design (SunRey human + MoonRey productive) for internal consistency, gaming resistance, and stated policy alignment
2. Verify that code-enforced invariants match documented constitutional rules (Chunk 71)
3. Assess oracle dependence, valuation methodologies, and issuance gates
4. Identify double-counting, Sybil, and feedback-loop risks
5. Produce a findings report with severity and remediation — **not** a production activation letter

Deliverables:

- Mechanism design review memo
- Issuance pipeline analysis (SunRey and MoonRey)
- Valuation methodology assessment (PEVE, GPUV)
- Oracle and information-consensus dependency analysis
- Governance and emergency-control adequacy review
- Supply conservation and reconciliation analysis

---

## 2. Scope — SunRey issuance (human economy)

| Topic | Canonical evidence | Review questions |
| --- | --- | --- |
| Issuance authority | Chunk 71 `packages/sunrey-chain/src/economics/constitution.ts` | Is Chunk 71 the sole mint? Any bypass paths? |
| Human contribution bridge | `packages/sunrey-chain/src/economics/human-contribution-bridge/` | Privacy-safe transforms; no raw PII on-chain |
| Issuance proposal | `packages/sunrey-chain/src/economics/human-economy/` | Proposal schema; simulation terminal states |
| PEVE integration | `packages/human-economic-contribution/src/valuation/` | PEVE ≠ SunRey quantity; human-worth prohibition |
| Formula approval | `PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED=false` | What human approval is required before live? |
| Verification policies | Chunk 109 `src/verification/` | Evidence sufficiency; class-specific rules |
| Contribution registry | Chunk 106 registry | Lifecycle, fingerprint dedup, VERIFIED gate |
| HIN adapter | `packages/information-market/src/network/contribution/` | One-way adapter; no mint from HIN alone |
| Replay protection | issuance replay books | Durable vs in-memory gaps |
| Parameter packages | `economics/production-activation/sunrey-package/` | CONFIGURED ≠ AUTHORIZED ≠ ACTIVE |
| Authorization | Chunk 163 `production-activation/authorization/` | Multi-party assembly; rehearsal only |
| SunRey coin (application) | `packages/sunrey-coin/` | Boundary vs protocol-native supply |
| Challenge process | `human-economy/types.ts` CLAIM_CHALLENGE_* | Operational adequacy for live |

**Invariant checks:**

- `peveEqualsSunReyQuantity: false` in types
- `humanWorthScore: false` across valuation
- Cost-avoided is never income
- Unrealized is never withdrawable

---

## 3. Scope — MoonRey issuance (productive economy)

| Topic | Canonical evidence | Review questions |
| --- | --- | --- |
| Issuance authority | Chunk 71 + `economics/issuance.ts` | `MOONREY_PRODUCTIVE_AUTHORIZATION` required? |
| Productive verification | `packages/sunrey-chain/src/productive/verification.ts` | Observation → fact → claim → contribution |
| GPUV engine | `productive/policy-governance/value-function/engine.ts` | `CAN_MINT=false`; methodology versioning |
| GPUV ≠ MoonRey | `value-function/constitution.ts` | `PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MARKET_PRICE` |
| Value settlement | `productive/policy-governance/value-settlement/` | Conversion policy binding |
| Issuance proposal | `productive/issuance.ts`, wave5 pipeline | V1/V2 paths; proposal-only |
| Oracle mesh | `oracle/`, `oracle/production/` | Quorum, independence, conflict handling |
| Anti-double-counting | fingerprint, attribution-accounting book | Temporal overlap, capacity vs output |
| Provider families | 12 `provider-families/` | Fixture-only; `LIVE_PROVIDER_CONNECTED=false` |
| Certification | `oracle/production/certification/` | Admission gate; not production approval |
| Circuit breakers | `circuit-breaker.ts`, launch-abort | Domain-scoped restrictions |
| Economic data fabric | `economic-data-fabric/` | Multi-provider reconciliation |
| Productive claim challenge | `OracleDispute` | Durability and governance |
| Parameter packages | `production-activation/moonrey-parameter-package.ts` | Forbidden issuance classes |
| Protocol gate | `moonreyIssuanceActivated(): false` | Typed false return |

**Invariant checks:**

- `PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT = true`
- `ENERGY_FACT_AUTO_MINTS_MOONREY = false` (all families)
- `SINGLE_SOURCE_IS_NOT_CONSENSUS = true`
- `CAPACITY_IS_NOT_OUTPUT = true`
- Reference price cannot mint

---

## 4. Scope — PEVE (Personal Economic Value Engine)

| Topic | Path | Review focus |
| --- | --- | --- |
| Valuation constitution | `human-economic-contribution/src/valuation/constitution.ts` | Not human worth; not token valuation |
| Methodology versions | valuation policy registry | Version binding; replay |
| Market separation | valuation engine | No exchange price in path |
| PEVE snapshots | PostgreSQL `V012__peve.sql` | Derived intelligence only |
| Platform PEVE | `packages/platform/src/value/` | `AI_CANNOT_SET_SCORE` |
| Adversarial scenarios | `packages/sunrey-range/` | Gaming attempts |

---

## 5. Scope — GPUV (Governed Productive Utility Value)

| Topic | Path | Review focus |
| --- | --- | --- |
| GPUV definition | `value-function/types.ts` | `PRODUCTIVE_VALUE_UNIT_ID = 'GPUV'` |
| Policy registry | MoonRey policy registry Chunk 74/121 | Cross-domain attribution |
| Production candidate | `value-function/production-candidate/` | Schema only; no invented rates |
| Conversion | `value-settlement/production-candidate/conversion.ts` | Forbidden issuance classes |
| Shadow economics | `shadow-economics/` | Simulation laboratory boundaries |

---

## 6. Scope — Monetary policy and supply

| Topic | Path | Review focus |
| --- | --- | --- |
| Monetary constitution | `economics/constitution.ts` | Dual-asset rules |
| Asset supply book | `economics/supply.ts` | Conservation; reconciliation |
| Native economic controls | `native-assets/economic-controls.ts` | Genesis, burn gates |
| Issuance pipelines | `native-assets/issuance-pipelines.ts` | Simulation terminals |
| Production activation firewall | `production-activation/firewall.ts` | Evaluator only; no activate |
| Parameter registry | `production-activation/parameter-package/` | Typed IDs; CONFIGURED ≠ ACTIVE |
| Burn mechanics | native-assets, constitution | Compensating entries only |
| Supply limits | constitution + parameter packages | Max supply human decisions |
| Dual-economy lab | `packages/sunrey-economics/` | Not production policy |

---

## 7. Scope — Governance

| Topic | Path | Review focus |
| --- | --- | --- |
| Governance ops | `governance-ops/engine.ts` | Policy packages; no super-admin |
| Launch freeze | `release-candidate/mainnet/launch-freeze/` | Freeze ≠ approval |
| Launch ceremony | `production-ceremony/launch-candidate/` | Multi-party rehearsal |
| Staged activation | `post-genesis/staged-activation/` | Domain-scoped canary |
| Launch abort | `governance-ops/launch-abort/` | Emergency restrictions |
| Production gates catalog | `production-handoff/production-gates/` | External vs internal gates |
| Operating scope | `mainnet/operating-scope/` | Jurisdiction matrix; not legal advice |

---

## 8. Scope — Anti-double-counting

| Mechanism | Path |
| --- | --- |
| Human fingerprints | `human-economic-contribution/src/fingerprint.ts` |
| Productive fingerprints | `productive/fingerprint.ts` |
| Attribution accounting book | `attribution-accounting/book.ts` |
| Temporal windows | `attribution-accounting/windows.ts` |
| Economic claim registry | `economic-proof/` (partial) |
| Replay registries | issuance replay books (in-memory gaps) |
| Cross-wallet protection | PARTIAL — review durability |

---

## 9. Scope — Oracle dependence

| Mechanism | Path |
| --- | --- |
| Oracle engine | `oracle/engine.ts` |
| Quorum / independence | `oracle/quorum.ts`, `independence.ts` |
| Aggregation / conflict | `oracle/aggregation.ts` |
| Freshness / staleness | engine + economy-data verification |
| Provider certification | `oracle/production/certification/` |
| External provider candidates | `external-provider-candidate/` |
| Unified fabric | `economic-data-fabric/` |

Review: Can a compromised oracle path mint? Are conflicts fail-closed?

---

## 10. Scope — Sybil resistance

| Mechanism | Path | Limitation |
| --- | --- | --- |
| HIN subject registration | information-market | Simulation federation |
| Anonymous subject block | contribution invariants | Not global Sybil mesh |
| Identity assurance | packages/identity KYC | `LIVE_EXTERNAL_KYC=false` |
| Pseudonymous commitments | bridge, fingerprints | No durable pseudonym registry |
| Attestation mesh | NOT_IMPLEMENTED | Wave 6 gap |
| Wave 6 disclaimer | PSEUDONYMOUS_IDENTITY docs | Explicit non-claim |

---

## 11. Scope — Market and economic feedback loops

| Loop | Path | Guard |
| --- | --- | --- |
| Exchange price → GPUV | value-function constitution | Separated |
| Exchange price → PEVE | valuation constitution | Separated |
| GPUV → MoonRey mint | issuance + firewall | GPUV alone cannot mint |
| PEVE → SunRey mint | human-economy types | `peveEqualsSunReyQuantity: false` |
| Productive observation → mint | verification + Chunk 71 | Multi-step gate |
| HIN marketplace → issuance | information-market | `LIVE_HIN_BASED_ISSUANCE_ENABLED=false` |
| Access economy clearing | sunrey-exchange access-fabric | Fiat on ledger; coins on custody/chain |

---

## 12. Out of scope

- Legal or regulatory opinions (counsel engagement separate)
- Production tokenomics selection (human governance)
- Live provider data quality assessment (no live providers)
- Market making or liquidity provision strategy
- Tax or accounting treatment

---

## 13. Evidence package

| Artifact | Path |
| --- | --- |
| Monetary constitution | `packages/sunrey-chain/src/economics/constitution.ts` |
| Wave 5 matrix | `docs/architecture/MOONREY_PRODUCTIVE_INTELLIGENCE_CAPABILITY_MATRIX.md` |
| Wave 6 matrix | `docs/architecture/SUNREY_HUMAN_ECONOMIC_INTELLIGENCE_CAPABILITY_MATRIX.md` |
| Wave 3 proof matrix | `docs/architecture/SUNREY_ECONOMIC_PROOF_CAPABILITY_MATRIX.md` |
| MoonRey issuance model | `docs/architecture/moonrey-issuance-model.md` |
| Economic information flow | `docs/architecture/SUNREY_ECONOMIC_INFORMATION_FLOW.md` |
| Production readiness | `docs/production/SUNREY_PRODUCTION_READINESS_REPORT.md` |
| Red-team tests | `tests/wave5-moonrey-productive-intelligence-red-team.test.ts` |
| Dual-economy stress | `packages/sunrey-economics/src/dual-economy-access-stress/` |
| Formal models | `packages/sunrey-chain/formal/registry/formal-model-registry.json` |

Reproduce:

```bash
npm test -- tests/wave5-moonrey-productive-intelligence-red-team.test.ts
npm test -- tests/wave6-sunrey-human-economy-monetary.test.ts
npm test -- packages/sunrey-chain/src/economics/
npm test -- packages/human-economic-contribution/
```

---

## 14. Deliverables expected from auditor

1. Executive summary — fit for governed activation consideration (not activation itself)
2. SunRey issuance mechanism assessment
3. MoonRey issuance mechanism assessment
4. PEVE and GPUV methodology review
5. Oracle and information-consensus dependency map
6. Double-counting and Sybil risk register
7. Governance and emergency-control adequacy
8. Supply conservation verification
9. Prioritized findings with severity
10. Retest criteria for material findings

---

## Related documents

- `docs/production/SUNREY_PRODUCTION_READINESS_REPORT.md`
- `docs/production/SUNREY_MAINNET_ACTIVATION_PRECONDITIONS.md`
- `docs/security/SUNREY_EXTERNAL_SECURITY_AUDIT_PACKAGE.md`
- `docs/architecture/chunk-71-monetary-constitution.md` (if present) / economics docs
