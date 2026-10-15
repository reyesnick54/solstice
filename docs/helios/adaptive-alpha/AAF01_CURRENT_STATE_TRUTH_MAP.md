# AAF01 — HELIOS Adaptive Alpha Fabric current-state truth map

**Work package:** AAF01 (audit only — no new runtime behavior)  
**Audit date:** 2026-10-15 UTC  
**Repository:** [reyesnick54/solstice](https://github.com/reyesnick54/solstice)  
**Recorded SHA:** `00a51dfd1c5771e9d65c74b0b4a8917d76db0a20` (`origin/main`, working tree clean after fast-forward)  
**JSON artifact:** [`aaf-current-state-truth-map.json`](./aaf-current-state-truth-map.json)  
**Gap register:** [`AAF01_GAP_REGISTER.md`](./AAF01_GAP_REGISTER.md)

Prior HELIOS maps (`docs/helios/H01_RUNTIME_TRUTH_MAP.md`, `helios-runtime-truth-map.json`) predate the Adaptive Alpha Fabric (AAF02+) and customer migration `V071`. This document reflects **source on the SHA above**, not older reports.

---

## 1. Executive summary

HELIOS market intelligence on `main` is centered in **`packages/platform/src/helios/`**, with:

- **Observation plane (H08 / M02):** `HeliosObservationFabric` — provenance, entitlement, freshness, quality, `InformationTime` / `knowableAt`.
- **Feature plane (AAF02–AAF06, AAF10):** `packages/platform/src/helios/feature-fabric/` — evidence-time features, temporal compiler, coverage tensor, coverage-bias sentinel, revision ledger, macro intelligence.
- **External data planes (AAF07–AAF09):** certification overlay, equities ETF plane, crypto multi-venue plane — all **market-data observation only** (`grantsExecutionAuthority: false`).
- **Strategy & capital:** `packages/strategy-lab/`, `packages/platform/src/helios/meta-allocator/`, `packages/agentic-capital-mesh/`, `packages/risk/`.
- **Trust:** canonical **`ExternalDataTrustEngine`** in `packages/provider-sdk/src/trust/engine.ts`; `packages/external-data` exposes a service wrapper.

**Do not** add a second observation fabric, Strategy Lab, meta-allocator, risk engine, ledger, Kernel, or Exchange. Extend these owners (see `AAF03_CANONICAL_OWNER_REUSE`).

Posture remains **simulation** (`npm run check:production-safety` — no live activation).

---

## 2. Baseline and gates

| Check | Result |
|-------|--------|
| `git fetch origin main` + fast-forward | SHA `00a51dfd1c5771e9d65c74b0b4a8917d76db0a20` |
| Working tree | Clean |
| Customer DB head | `db/customer/migrations/V071__helios_feature_fabric.sql` |
| `npm run lint:architecture` | Exit 0; **2** `package-deep-import` warnings in `feature-fabric` |
| `npm run check:production-safety` | Exit 0 |
| `node scripts/check-json-integrity.mjs` | Exit 0 |
| `npm run typecheck` | **Not confirmed green** in audit environment (OOM / incomplete run); see gap register G-INT-02 |
| HELIOS AAF tests (`tests/helios-aaf*.test.ts`) | **Partial failures** on AAF08 qualification marker and AAF10 timezone case |
| `scripts/helios-aaf02-qualify.ts` | **Fails** on missing barrel export `selectKnowableRevisionAt` (G-INT-01) |

Canonical HELIOS qualification scripts remain under `package.json` (`helios:h36:qualify`, `helios:m28:release-qualify`, etc.); this audit did not re-run the full H34 release package.

---

## 3. Capability truth map (16 objectives)

| # | Objective | Status | Primary evidence paths |
|---|-----------|--------|-------------------------|
| 1 | Point-in-time / information-time | **IMPLEMENTED** | `packages/platform/src/helios/observation/types.ts`, `observation/information-time.ts`, `feature-fabric/knowable-at.ts`, `strategy-lab/src/evaluation/chronology.ts` |
| 2 | External market observations | **IMPLEMENTED** | `observation/fabric.ts`, `market-observation/`, `multi-asset/`, `adaptive-alpha-fabric/aaf08-external-equities/`, `aaf09-external-crypto/` |
| 3 | External Data Trust Engine | **IMPLEMENTED** | `packages/provider-sdk/src/trust/engine.ts`, `packages/external-data/src/trust-engine/service.ts`, `observation/trust-integration.ts` |
| 4 | Entity resolution | **PARTIAL** | `feature-fabric/entity-resolution/` (HELIOS temporal graph); `economic-asset-registry/.../entity-resolution/` (economic KG — separate) |
| 5 | Feature generation | **IMPLEMENTED** | `feature-fabric/fabric.ts`, `compute.ts`, `compiler/compile.ts` |
| 6 | Feature persistence | **PARTIAL** | In-memory `feature-fabric/store.ts`; PG `packages/persistence/src/growth/pg-helios-feature-fabric-store.ts`, `V071` |
| 7 | Coverage / missingness | **IMPLEMENTED** | `feature-fabric/coverage/` (`HELIOS_COVERAGE_TENSOR_SCHEMA`, `MISSINGNESS_REASONS`) |
| 8 | Historical revisions | **PARTIAL** | `feature-fabric/revision-ledger/`, `aaf06/revision-ledger-store.ts`, `macro-intelligence/ingest.ts` |
| 9 | Market-data provider adapters | **PARTIAL** | `provider-sdk/src/market-data-capability/`, `external-data/src/certification/market-data/`, AAF09 adapters, `tests/helios-h07-market-data-adapter.test.ts` |
| 10 | Fundamental / earnings data | **SIMULATION_ONLY** | Catalog stubs `config/providers/wave2-catalog-entries.yaml`, `external-data/src/bridges.ts` (`fundamentalsAvailable`); no HELIOS earnings engine |
| 11 | Strategy Capsules | **IMPLEMENTED** | `strategy-lab/src/capsule/`, `helios/strategy-capsule/`, `V054__strategy_capsule.sql` |
| 12 | Strategy Lab evaluation | **IMPLEMENTED** | `strategy-lab/src/evaluation/`, `tests/helios-h17-chronological-strategy-evaluation.test.ts` |
| 13 | H20 Meta Allocator / research spend | **IMPLEMENTED** | `helios/meta-allocator/` (`research-value.ts`, `types.ts` `ResearchValueInput`), `V056`, `tests/helios-h20-meta-allocator.test.ts` |
| 14 | Portfolio risk | **IMPLEMENTED** | `packages/risk/src/portfolio/`, `helios/multi-asset/m20/`, exposure graph `m18/` + `V067` |
| 15 | Outcome attribution | **IMPLEMENTED** | `helios/outcome-attribution/`, `tests/helios-h25-outcome-attribution.test.ts` |
| 16 | Counterfactual analysis | **PARTIAL** | `packages/platform/src/value/` (baselines); `strategy-lab/src/bridges.ts` (`COUNTERFACTUAL` realization); `regulatory-twin` (policy counterfactuals); grow-intelligence forbids counterfactual profit on rejections |

---

## 4. Named primitive audit

| Primitive | Status | Paths |
|-----------|--------|-------|
| `FeatureObservation` | **IMPLEMENTED** | `feature-fabric/types.ts` |
| `FeatureDefinition` | **IMPLEMENTED** | `feature-fabric/types.ts` |
| `FeatureManifest` | **IMPLEMENTED** | `feature-fabric/types.ts`, `manifest.ts` |
| Point-in-time feature vector | **IMPLEMENTED** | `FeatureVector` in `types.ts`; `compiler/compile.ts` |
| As-of temporal join | **IMPLEMENTED** | `compiler/as-of.ts`, `compiler/leakage.ts` |
| Entity resolution graph | **IMPLEMENTED** (in-memory) | `entity-resolution/graph-store.ts`, `temporal.ts` |
| Coverage tensor | **IMPLEMENTED** | `coverage/types.ts`, `coverage/engine.ts` |
| Missingness taxonomy | **IMPLEMENTED** | `coverage/types.ts` (`MISSINGNESS_REASONS`) |
| Coverage-bias detection | **IMPLEMENTED** | `aaf06/coverage-bias-assess.ts`; Strategy Lab gate `evaluation/coverage-bias-promotion-gate.ts` |
| Data revision ledger | **IMPLEMENTED** | `revision-ledger/`, `aaf06/revision-ledger-types.ts` |
| Historical universe membership | **PARTIAL** | `temporal-types.ts` (`UniverseMembershipRow`); Strategy Lab survivorship warning in `evaluation/manifest.ts` |
| DCF engine | **ABSENT** | — |
| Earnings intelligence engine | **ABSENT** | Prompt scores only in `packages/ai-runtime/src/market-research.ts` |
| Alternative-data feature service | **PARTIAL** | `packages/external-data/src/wave6/` |
| Research VoI calculation | **IMPLEMENTED** | `meta-allocator/research-value.ts` |
| Specialist research bidding | **PARTIAL** | `agentic-capital-mesh/src/research-mesh/routing.ts` (task routing, not bids) |
| Strategy Genome | **ABSENT** | — |
| Champion/challenger evolution | **PARTIAL** | `strategy-lab/src/demotion.ts`, `promotion-service.ts` |
| Rejected-opportunity shadow book | **PARTIAL** | `forward-shadow.ts`; `grow-intelligence/taxonomy.ts` |
| Counterfactual investment attribution | **PARTIAL** | `value/store.ts` + outcome attribution engine |
| Customer savings sleeves / capital firewall | **PARTIAL** | `work-order/sandbox-allocation/` (H13); product simulation sleeves in `growth/product/` |

### Verified HELIOS primitives (requested)

| Primitive | Status | Paths |
|-----------|--------|-------|
| `HeliosObservationFabric` | **IMPLEMENTED** | `observation/fabric.ts` |
| `InformationTime` / `knowableAt` | **IMPLEMENTED** | `observation/types.ts`, `information-time.ts` |
| Lineage / entitlement / freshness / quality | **IMPLEMENTED** | `observation/lineage.ts`, `entitlement.ts`, `freshness-policies.ts`, `quality.ts` |
| Strategy Capsules | **IMPLEMENTED** | `strategy-lab/src/capsule/`, `helios/strategy-capsule/taxonomy.ts` |
| Chronological evaluation | **IMPLEMENTED** | `strategy-lab/src/evaluation/chronology.ts`, H17 tests |
| Research → shadow → paper | **IMPLEMENTED** | `promotion-gates.ts`, `promotion-service.ts`, `tests/helios-h18-strategy-promotion.test.ts` |
| H20 Meta Allocator | **IMPLEMENTED** | `helios/meta-allocator/service.ts` |
| `ResearchValueInput` / `ResearchValueAssessment` | **IMPLEMENTED** | `meta-allocator/types.ts`, `research-value.ts` |
| Portfolio exposure graph | **IMPLEMENTED** | `multi-asset/m18/build.ts`, `risk/src/portfolio/exposure-graph.ts` |
| Outcome attribution | **IMPLEMENTED** | `outcome-attribution/engine.ts` |
| Evidence Vault | **IMPLEMENTED** | `packages/evidence/src/vault.ts`; AAF08 sealing `aaf08-external-equities/evidence.ts` |

---

## 5. AAF work packages present on `main` (AAF02–AAF10)

| WP | Title | Status | Canonical owner |
|----|-------|--------|-----------------|
| AAF02 | Evidence-time feature fabric | **IMPLEMENTED** | `packages/platform/src/helios/feature-fabric` |
| AAF03 | Temporal entity resolution | **IMPLEMENTED** | `.../feature-fabric/entity-resolution` |
| AAF04 | Point-in-time compiler | **IMPLEMENTED** | `.../feature-fabric/compiler` |
| AAF05 | Coverage tensor & missingness | **IMPLEMENTED** | `.../feature-fabric/coverage` |
| AAF06 | Coverage bias & revision ledger | **IMPLEMENTED** | `.../feature-fabric/aaf06`, `revision-ledger/` |
| AAF07 | External market-data certification | **IMPLEMENTED** | `packages/external-data/src/certification/market-data`, `adaptive-alpha-fabric/aaf07`, `provider-sdk/.../market-data-capability` |
| AAF08 | External equities observation | **PARTIAL** | `adaptive-alpha-fabric/aaf08-external-equities` (qualification blocked in audit test) |
| AAF09 | External crypto observation | **IMPLEMENTED** | `adaptive-alpha-fabric/aaf09-external-crypto` |
| AAF10 | Point-in-time macro intelligence | **PARTIAL** | `feature-fabric/macro-intelligence` (timezone test failure) |

Existing narrative doc: [`AAF02_EVIDENCE_TIME_FEATURE_FABRIC.md`](./AAF02_EVIDENCE_TIME_FEATURE_FABRIC.md).

**AAF01** is this audit. **AAF11–AAF36** are **not defined in source** at this SHA; see §7 for a non-binding ownership map for future work.

---

## 6. Directory inspection map

| Path | Role |
|------|------|
| `packages/platform/src/helios/` | HELIOS orchestration, observation, feature fabric, meta-allocator, multi-asset, outcome attribution, adaptive-alpha-fabric |
| `packages/platform/src/helios/observation/` | `HeliosObservationFabric`, H08 envelope |
| `packages/platform/src/helios/meta-allocator/` | H20 research spend, portfolio coordination |
| `packages/platform/src/helios/strategy-capsule/` | Capsule taxonomies for validity envelope |
| `packages/platform/src/helios/multi-asset/` | Instruments, bars, regime, exposure, execution layers M01–M28 |
| `packages/strategy-lab/` | Capsules, evaluation, promotion, shadow |
| `packages/external-data/` | Trust wrapper, wave catalogs, AAF07 certification runtime |
| `packages/provider-sdk/` | Trust engine, market-data capability contract |
| `packages/risk/` | Canonical portfolio risk engine |
| `packages/evidence/` | Evidence Vault |
| `packages/platform/src/growth/` | Grow product simulation (distinct from HELIOS feature fabric) |
| `config/providers/` | Provider catalogs + `helios-external-market-data-certification.yaml` |
| `db/customer/migrations/` | HELIOS tables through `V071` (feature fabric) |
| `tests/helios*` | H03–H36 + `helios-aaf02`…`aaf10` qualification tests |
| `docs/helios/` | Runtime truth (H01), multi-asset reports |
| `docs/providers/` | External data architecture & trust docs |

---

## 7. Implementation ownership map (AAF02–AAF36)

### AAF02–AAF10 (evidence-based)

| WP | Extend |
|----|--------|
| AAF02 | `packages/platform/src/helios/feature-fabric` |
| AAF03 | `packages/platform/src/helios/feature-fabric/entity-resolution` |
| AAF04 | `packages/platform/src/helios/feature-fabric/compiler` |
| AAF05 | `packages/platform/src/helios/feature-fabric/coverage` |
| AAF06 | `packages/platform/src/helios/feature-fabric/aaf06` + `revision-ledger` |
| AAF07 | `packages/external-data/src/certification/market-data` + `packages/provider-sdk/src/market-data-capability` + `helios/adaptive-alpha-fabric/aaf07` |
| AAF08 | `packages/platform/src/helios/adaptive-alpha-fabric/aaf08-external-equities` |
| AAF09 | `packages/platform/src/helios/adaptive-alpha-fabric/aaf09-external-crypto` |
| AAF10 | `packages/platform/src/helios/feature-fabric/macro-intelligence` |

### AAF11–AAF36 (planning — IDs not in repository)

No `AAF11`…`AAF36` symbols exist in source at `00a51dfd`. The table assigns **canonical packages to extend** for a conventional continuation of the fabric program (see JSON `aafForwardOwnership` for machine-readable copy).

| WP | Proposed theme | Canonical owner |
|----|----------------|-----------------|
| AAF11 | Corporate fundamental observation plane | `helios/adaptive-alpha-fabric` |
| AAF12 | Earnings intelligence features | `helios/feature-fabric` |
| AAF13 | Alternative-data feature ingestion | `packages/external-data` |
| AAF14 | Intrinsic value / DCF simulation | `helios/feature-fabric` |
| AAF15 | Durable universe membership history | `packages/persistence` |
| AAF16 | Coverage tensor persistence | `packages/persistence` |
| AAF17 | Revision ledger federation | `helios/feature-fabric/revision-ledger` |
| AAF18 | Observation ↔ feature runtime wiring | `helios/observation` |
| AAF19 | Research feed provider orchestration | `helios/provider-orchestration` |
| AAF20 | Strategy Capsule qualification binding | `helios/strategy-capsule` |
| AAF21 | Strategy Lab evaluation manifests | `packages/strategy-lab` |
| AAF22 | Research → shadow → paper promotion | `packages/strategy-lab` |
| AAF23 | Meta-allocator capital coordination | `helios/meta-allocator` |
| AAF24 | Research spend / VoI policy | `helios/meta-allocator/research-value.ts` |
| AAF25 | Specialist research mesh | `packages/agentic-capital-mesh/src/research-mesh` |
| AAF26 | Portfolio risk controls | `packages/risk` |
| AAF27 | Portfolio exposure graph | `helios/multi-asset/m18` |
| AAF28 | Outcome attribution | `helios/outcome-attribution` |
| AAF29 | Counterfactual baselines (PEVE) | `packages/platform/src/value` |
| AAF30 | Grow intelligence / rejected opportunities | `helios/grow-intelligence` |
| AAF31 | Forward shadow / shadow book | `packages/strategy-lab/src/forward-shadow.ts` |
| AAF32 | Strategy genome specification | `packages/strategy-lab` |
| AAF33 | Champion/challenger lifecycle | `packages/strategy-lab` |
| AAF34 | Sandbox capital firewall | `packages/platform/src/work-order/sandbox-allocation` |
| AAF35 | AAF evidence sealing | `packages/evidence` |
| AAF36 | Integrated AAF qualification / release evidence | `helios/release-evidence` |

---

## 8. Non-duplication audit (summary)

- **Single observation authority:** `HeliosObservationFabric` ingests provider observations; AAF08/09 normalize into M02 paths rather than new fabrics.
- **Single feature authority:** `HeliosFeatureFabric` + AAF04 compiler; AAF09/AAF10 compute features via shared types.
- **Single trust authority:** `packages/provider-sdk/src/trust/engine.ts` (Wave 7 duplicate class in `external-data/src/wave7/trust-engine.ts` is legacy surface — prefer provider-sdk for new HELIOS paths).
- **Single strategy promotion authority:** `packages/strategy-lab` promotion service and gates.
- **Single meta-allocator:** `helios/meta-allocator` (mesh builds advisory outputs in `agentic-capital-mesh`, does not replace H20 durable allocator).

---

## 9. Acceptance checklist (AAF01)

| Criterion | Met |
|-----------|-----|
| Exact SHA recorded | Yes — `00a51dfd1c5771e9d65c74b0b4a8917d76db0a20` |
| Architecture check run | Yes — `lint:architecture` exit 0 (with warnings) |
| Typecheck unchanged or improved | **Not verified** — see gaps |
| No production/live activation | Yes — production safety check |
| No speculative “implemented” without paths | Yes — statuses tied to paths in JSON |
| Audit artifacts only | Yes — three files under `docs/helios/adaptive-alpha/` |
