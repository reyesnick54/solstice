# AAF01 — Adaptive Alpha Fabric gap register

**Audit SHA:** `00a51dfd1c5771e9d65c74b0b4a8917d76db0a20` (`origin/main`, clean tree)  
**Machine-readable companion:** `aaf-current-state-truth-map.json`

---

## P0 — Engineering integrity (blocks trustworthy AAF qualification)

| ID | Gap | Status | Evidence |
|----|-----|--------|----------|
| G-INT-01 | `packages/platform/src/helios/index.ts` re-exports `selectKnowableRevisionAt` from `./feature-fabric/index.ts`, but the feature-fabric barrel does not re-export `revision-ledger/index.ts` | **OPEN** | `packages/platform/src/helios/index.ts` (exports); `packages/platform/src/helios/feature-fabric/revision-ledger/index.ts` (defines export); `scripts/helios-aaf02-qualify.ts` fails at import |
| G-INT-02 | Full-repo `npm run typecheck` not verified green in this audit (OOM / long-running locally) | **OPEN** | Audit gate log in JSON |
| G-INT-03 | `AAF08` qualification harness returns `HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_BLOCKED` in `tests/helios-aaf08-external-equities-observation.test.ts` | **OPEN** | `packages/platform/src/helios/adaptive-alpha-fabric/aaf08-external-equities/qualification.ts` |
| G-INT-04 | `AAF10` US/Eastern release timezone test failure | **OPEN** | `tests/helios-aaf10-point-in-time-macro-intelligence.test.ts`; `packages/platform/src/helios/feature-fabric/macro-intelligence/timezone.ts` |
| G-INT-05 | Architectural linter deep-import warnings in feature-fabric | **OPEN** | `packages/platform/src/helios/feature-fabric/knowable-at.ts`, `types.ts` |

---

## P1 — Capability gaps (no duplicate owners)

| ID | Capability | Classification | Canonical owner to extend | Notes |
|----|------------|----------------|----------------------------|-------|
| G-CAP-01 | DCF / intrinsic value engine | **ABSENT** | `packages/platform/src/helios/feature-fabric` (future) | No DCF/discounted-cash matches in `packages/` |
| G-CAP-02 | Earnings intelligence engine (structured, PIT) | **ABSENT** | `packages/platform/src/helios/feature-fabric` + `packages/external-data` | Catalog mentions earnings in `config/providers/wave2-catalog-entries.yaml`; no HELIOS earnings feature plane |
| G-CAP-03 | Strategy Genome | **ABSENT** | `packages/strategy-lab` | No `StrategyGenome` symbol in source |
| G-CAP-04 | Dedicated rejected-opportunity shadow **book** (durable ledger of foregone trades) | **PARTIAL** | `packages/strategy-lab/src/forward-shadow.ts`, `packages/platform/src/helios/grow-intelligence/` | Taxonomy forbids counterfactual profit claims (`REJECTED_OPPORTUNITY_NOT_COUNTERFACTUAL`) |
| G-CAP-05 | Counterfactual **investment** attribution (withdrawable vs baseline) | **PARTIAL** | `packages/platform/src/value/`, `packages/platform/src/helios/outcome-attribution/` | PEVE counterfactual baselines exist; not wired as full investment counterfactual attribution |
| G-CAP-06 | Customer savings sleeves / capital firewall (production-shaped) | **PARTIAL** | `packages/platform/src/work-order/sandbox-allocation/` | H13 sandbox allocation + simulation product “sleeves” in `packages/platform/src/growth/product/` — not customer savings firewall |
| G-CAP-07 | Specialist research **bidding** market | **PARTIAL** | `packages/agentic-capital-mesh/src/research-mesh/` | Routing + budget control; no competitive bid auction |
| G-CAP-08 | Alternative-data feature service (unified) | **PARTIAL** | `packages/external-data/src/wave6/` | Job/opportunity fabric; not a unified alt-data feature API for HELIOS |
| G-CAP-09 | Historical universe membership (durable) | **PARTIAL** | `packages/platform/src/helios/feature-fabric/temporal-types.ts` | `UniverseMembershipRow` + compiler guards; Strategy Lab manifest warns survivorship limitation |
| G-CAP-10 | Coverage tensor / revision ledger PostgreSQL | **PARTIAL** | `packages/persistence` | AAF02 feature obs/manifest in `V071`; coverage tensor and revision chains remain in-memory stores |
| G-CAP-11 | Temporal entity graph persistence | **PARTIAL** | `packages/platform/src/helios/feature-fabric/entity-resolution/graph-store.ts` | In-memory `TemporalEntityGraphStore`; economic KG ER in `packages/economic-asset-registry` is separate plane |
| G-CAP-12 | `AAF08` not exported from `adaptive-alpha-fabric/index.ts` until recently — verify BFF/runtime wiring | **PARTIAL** | `packages/platform/src/helios/adaptive-alpha-fabric/index.ts` | Plane exists; integration depth varies by surface |

---

## P2 — Duplication risks (do not implement)

| Risk | Existing canonical owner | Do not create |
|------|------------------------|---------------|
| Second observation fabric | `packages/platform/src/helios/observation/fabric.ts` | `packages/helios-observation`, parallel envelope types |
| Second trust engine | `packages/provider-sdk/src/trust/engine.ts` | New trust package in platform |
| Second Strategy Lab | `packages/strategy-lab/` | `packages/strategy-lab-v2` |
| Second meta-allocator | `packages/platform/src/helios/meta-allocator/` | Parallel allocator in mesh |
| Second risk engine | `packages/risk/` | HELIOS-local risk authority |
| Second ledger / EA | `packages/ledger`, `packages/kernel` | Any AAF “execution” shortcut |

Documented non-owners: `packages/platform/src/helios/feature-fabric/entity-resolution/canonical-owners.ts` (`AAF03_EXPLICIT_NON_OWNERS`).

---

## P3 — External / simulation boundaries

| Item | Classification | Paths |
|------|----------------|-------|
| Live market connectivity | **SIMULATION_ONLY** | `ENVIRONMENT=simulation`; AAF07/08/09 adapters use fixtures unless explicit live certify flags |
| Wave 4 economic-awareness ER mesh | **EXTERNAL_DEPENDENCY** / parallel plane | `packages/sunrey-chain/src/economic-awareness-fabric/` (not HELIOS market ER) |
| Finnhub / Kraken / CoinGecko production | **EXTERNAL_DEPENDENCY** | `config/providers/`, `packages/external-data/src/certification/market-data/` |

---

## Resolved on `main` (do not re-build)

- **HeliosObservationFabric** — `packages/platform/src/helios/observation/fabric.ts`
- **FeatureObservation / FeatureDefinition / FeatureManifest** — `packages/platform/src/helios/feature-fabric/types.ts`
- **HeliosFeatureFabric** — `packages/platform/src/helios/feature-fabric/fabric.ts`
- **Coverage tensor + missingness taxonomy** — `packages/platform/src/helios/feature-fabric/coverage/`
- **AAF04 as-of joins** — `packages/platform/src/helios/feature-fabric/compiler/as-of.ts`
- **ResearchValueInput / Assessment** — `packages/platform/src/helios/meta-allocator/`
- **Strategy Capsules + promotion** — `packages/strategy-lab/`, `db/customer/migrations/V054__strategy_capsule.sql`
- **Portfolio exposure graph** — `packages/risk/src/portfolio/exposure-graph.ts`, `packages/platform/src/helios/multi-asset/m18/`

---

## Suggested AAF02+ sequencing (from gaps only)

1. Close **G-INT-*** (barrel exports, AAF08/AAF10 qualification tests, typecheck green).
2. Persist **coverage / revision / entity graph** (G-CAP-09–11) under existing persistence ports.
3. Fundamental/earnings planes (G-CAP-01–02) as extensions of **AAF08/AAF10** patterns, not new fabrics.
4. Strategy genome + champion/challenger (G-CAP-03, G-CAP-04) inside **strategy-lab** promotion lifecycle.
5. Capital firewall clarity (G-CAP-06) extending **sandbox-allocation**, not a second wallet.
