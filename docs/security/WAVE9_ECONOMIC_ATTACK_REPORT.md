# Wave 9 — Economic Attack Report

**Scope:** MoonRey Productive Economy and SunRey Human Economy  
**Environment:** Simulation only (`ENVIRONMENT=simulation`, all `LIVE_*` flags false)  
**Date:** 2026-09-02  
**Verdict:** False economic information does **not** cross the monetary boundary through tested attack paths. Information-layer objects, oracle observations, PEVE/GPUV outputs, and unresolved identities remain non-minting. Production issuance remains disabled.

## Executive summary

Wave 9 executed adversarial tests across oracle manipulation, productive event inflation, identity fraud, GPUV/PEVE boundaries, Sybil and contribution fraud, claim replay, collusion, AI abuse, and domain-scoped circuit breakers. All 43 Wave 9 regression tests pass, plus related Wave 3–6 red-team and monetary suites (357 tests in the combined validation run).

One implementation defect was fixed: `HumanContributionResolutionEngine.snapshot()` previously returned an empty `consumedMonetizationKeys` array instead of the monetization store state.

**Answer to the primary question:** Under tested conditions, false economic information cannot cross the monetary boundary without a governed issuance pipeline (Execution Authority, settlement authorization, governance approval, and one-time claim consumption). Blockchain cryptography was not the attack surface; economic truth controls were.

---

## MoonRey attacks

| Attack | Result |
|--------|--------|
| Provider masquerading as many (shared upstream/controller) | **Rejected** — independence analysis marks cluster non-independent; quorum fails |
| Provider aliases / copied-source quorum | **Rejected** — Information Consensus flags `SHARED_UPSTREAM_LINEAGE`; no verified fact |
| Fake source classes (aggregator-only) | **Rejected** — `PRODUCTIVE_SOURCE_CLASS_REQUIRED` |
| False provider lineage | **Rejected** — corroboration unsatisfied when lineage roots collapse |
| Stale observations | **Rejected** — consensus result `STALE`; productive verification `STALE` |
| Outliers / coordinated false spread | **Rejected** — `OUTLIER` / `DISPUTED` / `MATERIAL_CONFLICT_DETECTED` |
| Sensor spoof (single source) | **Rejected** — `SINGLE_SOURCE_VERIFIED` + `refuseFakeConsensus` |
| Derived model vs direct measurement conflict | **Rejected** — material conflict triggers manual review or dispute |
| Market-data pretending to prove physical production | **Rejected** — productive source-class policy + no auto-mint |

MoonRey issuance paths tested (`rejectOracleOnlyMint`, `rejectFactOnlyMint`, `refuseStandaloneAttempt`, `authorizeIssuance` replay) all fail closed.

---

## Oracle manipulation findings

- **Information Consensus** grants zero monetary and zero execution authority even when result is `VERIFIED`.
- Shared upstream with three provider aliases produces `INSUFFICIENT_EVIDENCE` / non-verified outcome, not consensus bypass.
- Production quorum requires minimum independent controllers; single-observation feeds fail closed.
- Connector circuit breaker opens per provider/source without mutating supply or unrelated domains.

---

## Productive anti-double-counting findings

- **Attribution book** blocks same economic event across APIs via `observationFingerprint` collision (manufacturing ↔ goods relabel).
- **ProductiveEconomyEngine** rejects duplicate `DUPLICATE_CONTRIBUTION` across renamed claims.
- Constitution enforces `CAPACITY_IS_NOT_OUTPUT`, `OUTPUT_IS_NOT_DELIVERY`, `DUPLICATE_FULL_ATTRIBUTION_ALLOWED=false`.
- Parent/child and capacity/output separation is policy-governed; trivial multiplication via relabeling is blocked at attribution reservation.

---

## GPUV findings

- GPUV evaluation returns `VALUED_SIMULATION`; `PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT=true`.
- Negative basis quantities → `VALUE_REJECTED`.
- Standalone `GPUV_QUANTITY`, `PRODUCTIVE_VALUE_RESULT`, oracle facts cannot mint MoonRey.
- GPUV cannot substitute PEVE (`GPUV_CANNOT_SUBSTITUTE_PEVE`).
- Exchange/market price inputs forbidden for PEVE (`MARKET_PRICE_INPUT_FORBIDDEN`).

---

## SunRey Sybil findings

- **Identity plane** (`evaluateSybilControls` with `heaid_*` IDs): reused external identity and reused credential → `DENY_FUTURE_ACTION`.
- AI-only Sybil hints → `REQUIRE_REVIEW` only; `autonomousBan=false` (AI cannot autonomously ban).
- Multi-wallet binding resolves to one economic identity; multiple wallets do not multiply canonical events.
- Uniqueness proof conflicts (`UNIQUENESS_CONFLICT`) block duplicate provider subject registration.

**Note:** Resolution-layer IDs (`heid_*`) and identity-layer IDs (`heaid_*`) are distinct namespaces. Sybil controls apply to the identity plane; resolution uses separate cross-identity conflict detection.

---

## Contribution fraud findings

- Observation replay blocked (`OBSERVATION_REPLAY`) for same provider record and credential global replay.
- Cross-identity credential reuse → `FRAUD_SUSPECTED`; same publication across identities → `MANUAL_REVIEW_REQUIRED`.
- Single-source self-attestation remains `PENDING_CORROBORATION`; claim generation blocked without corroboration.
- Timestamp alteration on identical content → `UNRESOLVED_DUPLICATE`.

---

## PEVE findings

- PEVE boundary invariants hold: no human-worth score, no SunRey mint, no exchange price coupling.
- PEVE reference value is separate from proposed SunRey quantity (`quantityDerivedFromPeve=false`).
- Production PEVE and mainnet issuance remain disabled.
- AI may assist (classify, explain, detect anomalies) but cannot set canonical PEVE input or authorize valuation.

---

## Claim replay findings

- **Human resolution monetization store** blocks duplicate consumption per `resolutionFingerprint` + context.
- **Human economy pipeline** blocks `CLAIM_ALREADY_MONETIZED` and `CLAIM_FINGERPRINT_DUPLICATE` on rewrap.
- **MoonRey issuance** blocks `DUPLICATE_ISSUANCE` on authorization replay.
- Engine snapshot now correctly exports consumed monetization keys (defect fixed).

---

## AI attack findings

- `PEVE_AI_ROLE` and `AI_INFORMATION_CONSENSUS_ROLE` forbid monetary truth, issuance approval, rights override, and hard verification override.
- AI assistance in consensus adds `AI_ASSISTANCE_ONLY`; deterministic evaluation unchanged.
- AI `actorKind` MoonRey issuance rejected.
- AI governance authorization rejected in human economy pipeline.

---

## Collusion

| Scenario | Detection |
|----------|-----------|
| Multiple malicious oracle providers (shared upstream) | `SHARED_UPSTREAM_LINEAGE`, no verified fact |
| Colluding human attestors (same DOI, different identities) | `MANUAL_REVIEW_REQUIRED`, conflict registered |
| Malicious operator + provider (outlier in quorum) | Outlier/dispute paths; no mint |
| Verified independent quorum | Information fact allowed; **still zero monetary authority** |

---

## Circuit-breaker results

- Domain verification pause (`RESEARCH`) blocks human-economy issuance (`DOMAIN_VERIFICATION_PAUSED`) while `WORK` continues.
- `circuitBreakerDoesNotHaltBlockchain`, `circuitBreakerDoesNotHaltMoonRey`, `circuitBreakerDoesNotHaltOrdinaryTransfers` all true.
- Oracle connector circuit opens per provider without rewriting supply.
- Launch-abort restriction plan scopes oracle incidents; unrelated capabilities remain available.

---

## Defects fixed (Wave 9)

1. **`HumanContributionResolutionEngine.snapshot()`** — `consumedMonetizationKeys` now populated via `HumanContributionMonetizationStore.listConsumedKeys()` instead of always returning `[]`.

---

## Remaining vulnerabilities / limitations

1. **Simulation-only enforcement** — Production economic activation, live issuance, and production oracle networks remain intentionally inactive; mainnet behavior is not fully exercised.
2. **Dual identity namespaces** — `heid_*` (resolution) vs `heaid_*` (identity/Sybil) require careful integration at monetization boundaries; conflation is a design risk, not a bypass in tested paths.
3. **Single-source verification** — `verificationEligibleForValuation` allows `SINGLE_SOURCE_VERIFIED` for valuation eligibility, but `refuseFakeConsensus` and issuance gates prevent minting; operational policy must not treat single-source as monetary-grade.
4. **PENDING_CORROBORATION with force flag** — `generateClaimForCluster(..., forcePendingCorroboration=true)` can generate claims for simulation; production must not expose force without governance.
5. **Productive asset alias registry** — Audit notes alias registry weakness; shifted coordinates and unknown duplicates are not silently merged, but global alias governance remains incomplete.
6. **AI Sybil hints** — High-severity AI suggestions alone do not deny; they require human review — by design, but operators must not auto-approve on AI hint alone.
7. **No live provider adversarial range** — Attacks use fixtures and simulation transports; real provider compromise modes are rehearsed, not observed against live APIs.

---

## Files changed

| File | Change |
|------|--------|
| `tests/wave-9-economic-attack.test.ts` | New Wave 9 adversarial suite (43 tests, tasks 1–13) |
| `docs/security/WAVE9_ECONOMIC_ATTACK_REPORT.md` | This report |
| `packages/human-economic-contribution/src/resolution/monetization-lock.ts` | Added `listConsumedKeys()` |
| `packages/human-economic-contribution/src/resolution/engine.ts` | Fixed `snapshot()` consumed keys |
| `packages/human-economic-contribution/src/resolution.test.ts` | Snapshot consumed-keys regression test |

---

## Validation

| Suite | Result |
|-------|--------|
| `tests/wave-9-economic-attack.test.ts` | 43/43 pass |
| `packages/human-economic-contribution/src/resolution.test.ts` | pass (includes snapshot fix) |
| Combined economic / claim / proof run (Wave 3–6 red-team + PEVE + human economy + `economic-proof` + HEC package tests) | 357/357 pass |
| `npm run test:economics` | 85/85 pass |

---

## Conclusion

Wave 9 confirms that economic truth boundaries hold in simulation: information consensus, productive attribution, human contribution resolution, PEVE/GPUV separation, Sybil controls, and claim consumption prevent tested false-economic-value paths from minting SunRey or MoonRey. Residual risk is concentrated in production activation governance, identity-namespace integration discipline, and operator response to manual-review queues — not in silent monetary bypass through the tested code paths.
