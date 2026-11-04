# EARN01 — HELIOS Earnings Intelligence current-state truth map

**Work package:** EARN01 (canonical domain foundation — no strategy implementation)  
**Audit date:** 2026-11-04 UTC  
**Repository:** [reyesnick54/solstice](https://github.com/reyesnick54/solstice)  
**Baseline SHA:** `7c24ea4101bbd097e4dcca1855e73c162560b873` (`origin/main`, branch `helios/earnings-intelligence-v1`)  
**Qualification marker:** `HELIOS_EARN01_DOMAIN_QUALIFIED` (domain types + leakage gates; not live earnings feeds)

**Package boundaries:** EARN01 modules import time via `@solstice/domain` with explicit `platform` / `external-data` dependencies (no deep `domain/src` imports).

Architecture companion: [`EARNINGS_INTELLIGENCE_ARCHITECTURE.md`](./EARNINGS_INTELLIGENCE_ARCHITECTURE.md)

---

## 1. Executive summary

HELIOS had **SEC point-in-time fundamentals** and **agent routing** for earnings research, but no **canonical earnings event model** tying release, consensus, actuals, guidance, transcript, options, reaction, and peer context under one information-time contract.

EARN01 adds a **single domain owner** at `packages/platform/src/helios/earnings-intelligence/`, a **Feature Fabric extension** at `packages/platform/src/helios/feature-fabric/earnings/`, and an **external-data bridge** at `packages/external-data/src/earnings/` — without creating a second Feature Fabric, Agentic Capital Mesh, market observation system, Strategy Lab, Risk Engine, or Execution Authority.

Posture remains **simulation** (`ENVIRONMENT=simulation`, all `LIVE_*` false).

---

## 2. Baseline and gates

| Check | Result |
|-------|--------|
| `git fetch origin main` | SHA `7c24ea4101bbd097e4dcca1855e73c162560b873` |
| GitHub `CI` on `main` (2026-11-03) | **success** (merge PR #579) |
| GitHub `HELIOS release candidate` on `main` | **success** (same push) |
| `npm run check:production-safety` | Exit 0 |
| `npm run lint:architecture` | Exit 0 (9 pre-existing-style `package-deep-import` warnings on new files; same pattern as other HELIOS modules) |
| `tests/helios-earn01-earnings-intelligence-domain.test.ts` | **pass** (EARN01 qualification) |

HELIOS RC markers (`HELIOS_RC_QUALIFIED_*`, `HELIOS_RC_BLOCKED`) live in `packages/platform/src/helios/release-evidence/`; EARN01 does not alter RC qualification — it extends the research data plane only.

---

## 3. Audited upstream capabilities (preserve and extend)

| Capability | Status | Primary paths |
|------------|--------|---------------|
| SEC EDGAR point-in-time fundamentals | **IMPLEMENTED** | `packages/external-data/src/sec-fundamentals/` (`edgar-dataflow.ts`, `types.ts`, `helios-mapper.ts`) |
| `GuidanceObservation` | **IMPLEMENTED** | `packages/external-data/src/sec-fundamentals/types.ts` |
| `knowableAt` / leakage filters | **IMPLEMENTED** | `sec-fundamentals/edgar-dataflow.ts` (`filterKnowableObservations`), `feature-fabric/knowable-at.ts`, `observation/information-time.ts` |
| Revision ledger | **IMPLEMENTED** | `packages/platform/src/helios/feature-fabric/revision-ledger/`, `aaf06/revision-ledger-store.ts`, `packages/economic-awareness-fabric/src/revisions/ledger.ts` |
| Feature Fabric (AAF02 / OS10 fundamentals) | **IMPLEMENTED** | `packages/platform/src/helios/feature-fabric/` (`fundamental-types.ts`, `fundamental-store.ts`, `os10-qualification.ts`) |
| AAF V2 dataset certification | **IMPLEMENTED** | `packages/platform/src/helios/adaptive-alpha-v2/certification.ts`, `tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts` |
| Evidence Vault sealing | **IMPLEMENTED** | `packages/evidence/`, HELIOS research monitor / proactive evidence helpers |
| Strategy Genome | **IMPLEMENTED** | `packages/strategy-lab/src/os05/`, `feature-fabric/bias-sentinel/integrations/strategy-genome.ts` |
| `FundamentalResearchAgent` / `EarningsResearchAgent` | **IMPLEMENTED** (mesh routing) | `packages/agentic-capital-mesh/src/institutional-research-mesh/mesh-service.ts`, `tests/helios-os09-institutional-research-mesh.test.ts` |
| Macro / generic event intelligence (M14) | **IMPLEMENTED** (macro-centric) | `packages/platform/src/helios/multi-asset/event-intelligence/` |
| Research Monitor / proactive pipeline | **IMPLEMENTED** | `packages/platform/src/helios/research-monitor/` |
| Outcome attribution | **IMPLEMENTED** | `packages/platform/src/helios/outcome-attribution/` |

**Gap closed by EARN01:** structured **earnings-specific** domain types, manifest compilation, and feature-plane bridge. **Still absent (by design in this WP):** live vendor earnings feeds, transcript NLP, options vendor integration, and Strategy Lab earnings strategies.

---

## 4. EARN01 deliverables on branch

| Owner | Role |
|-------|------|
| `packages/platform/src/helios/earnings-intelligence/` | Canonical `EarningsEvent*`, observations, manifest, store, `knowableAt` enforcement, qualification |
| `packages/platform/src/helios/feature-fabric/earnings/` | Earnings feature IDs + PIT feature plane compiler from manifest |
| `packages/external-data/src/earnings/` | Provider-neutral external envelopes; SEC guidance bridge |
| `docs/helios/earnings/` | Current-state + architecture |
| `tests/helios-earn01-earnings-intelligence-domain.test.ts` | Domain qualification tests |

---

## 5. Primitive truth table (requested types)

| Type | Status | Notes |
|------|--------|-------|
| `EarningsEvent` | **DEFINED** | Announcement + session state on shared temporal envelope |
| `EarningsEventId` | **DEFINED** | Branded string constructor `asEarningsEventId` |
| `EarningsFiscalPeriod` | **DEFINED** | Year, quarter, label, period end |
| `EarningsAnnouncementState` | **DEFINED** | EXPECTED … UNKNOWN (8 states) |
| `EarningsReleaseObservation` | **DEFINED** | |
| `EarningsActualObservation` | **DEFINED** | Metric rows (`EarningsMetricValue`) |
| `EarningsExpectationSnapshot` | **DEFINED** | |
| `EarningsConsensusSnapshot` | **DEFINED** | |
| `EarningsGuidanceSnapshot` | **DEFINED** | |
| `EarningsTranscriptObservation` | **DEFINED** | Ref-only; no raw transcript store in domain |
| `EarningsOptionsSnapshot` | **DEFINED** | Implied move / skew placeholders |
| `EarningsMarketReaction` | **DEFINED** | Windowed reaction |
| `EarningsPeerContext` | **DEFINED** | Peer sets + relative rank |
| `EarningsIntelligenceManifest` | **DEFINED** | PIT compile at `evaluationTime` |

Shared fields (`canonicalEntityId`, `canonicalInstrumentId`, `fiscalPeriod`, temporal instants, `revisionId`, `sourceRefs`, `evidenceRefs`, `qualityState`) live on `EarningsTemporalEnvelope` in the domain owner.

---

## 6. Non-goals (this work package)

- No earnings **strategy** or Strategy Lab capsule implementation  
- No new Execution Authority, ledger posting, or live earnings vendor activation  
- No second Feature Fabric, research mesh, or event-intelligence stack  
- No production qualification of third-party earnings feeds (fixtures and SEC bridge only)

---

## 7. Next work packages (recommended)

1. **EARN02** — Ingest adapters (simulation-certified) mapping vendor calendars, consensus, and actuals into domain observations with Evidence Vault sealing.  
2. **EARN03** — Feature Fabric feature definitions registered in universal fabric manifest; compiler integration with AAF V2 certification hooks.  
3. **EARN04** — Institutional mesh artifact schema alignment so `EarningsResearchAgent` emits citations to `EarningsIntelligenceManifest` refs.  
4. **EARN05** — Research Monitor DSL triggers on announcement state transitions (extends proactive pipeline, not a new monitor).
