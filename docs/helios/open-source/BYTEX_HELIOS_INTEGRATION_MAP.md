# BYTEX → HELIOS Open-Source Integration Map (OS01)

**Work package:** HELIOS OPEN-SOURCE INTEGRATION — OS01  
**Downstream repository:** `reyesnick54/solstice` (HELIOS canonical engine)  
**Upstream studied:** [BYTEX-TRADE/bytex](https://github.com/BYTEX-TRADE/bytex)  
**Reference SHA:** `67b3e103043476a0490bb7afa146ec9ac339b116` (release **0.11.0**)  
**Upstream license:** Apache-2.0  
**Audit date:** 2026-11-03 (Asia/Riyadh)  
**Posture of this deliverable:** architecture extraction only — **no trading behavior changes**, no .NET production dependency, no live venue binding.

---

## 1. Purpose and constraints

This document classifies BYTEX execution, simulation, adapter, strategy-document, persistence, and trading-runtime capabilities against existing HELIOS surfaces. It is the input to later clean-room TypeScript ports (with provenance) and to qualification test design — not an integration PR.

Hard constraints carried forward:

| Constraint | Implication for BYTEX reuse |
|------------|----------------------------|
| HELIOS remains the canonical engine | Do not embed `Bytex.Core` / `TradingRuntime` as a runtime; borrow algorithms and test patterns only |
| TypeScript + canonical SunRey financial types | Port logic to `bigint` minor units, existing order/settlement taxonomies, Kernel-gated mutators |
| Simulation posture | Treat BYTEX live adapters and Redis/Postgres node stores as **reference** until H22/H23 live binding is explicitly authorized |
| Compliance Kernel + Evidence Vault | Any ported reconciliation or fill logic must seal outcomes; BYTEX logging/journal is not a substitute |
| No second ledger / Execution Authority | BYTEX portfolio/account simulation stays in Strategy Lab / paper paths — not `services/accounts` |

---

## 2. BYTEX architecture snapshot (reference SHA)

BYTEX is a single-process, **single-threaded event loop** around a composable `TradingRuntime`: `MessageBus` → `MarketDataService` / `OrderCoordinator` / `OrderPolicy` / `ModuleHost` (strategies + execution algorithms). The same `RuntimeModule` / `Strategy` code runs in **Backtest**, **Sandbox** (live data + simulated venue), and **Live** (venue adapters).

Primary packages inspected:

| Package | Role |
|---------|------|
| `Bytex.Core` | Domain model, messaging, engines, adapter contracts, TWAP, clocks |
| `Bytex.Backtest` | `BacktestEngine`, `SimulatedExchange`, `OrderMatchingEngine`, fill/fee/latency models |
| `Bytex.Live` | `TradingNode`, startup/continuous reconciliation, sandbox client, node control |
| `Bytex.Documents` | Strategy-as-data graph, validator, deterministic document runtime |
| `Bytex.Data` | Parquet `MarketArchive`, catalog streaming, bounded book-depth files |
| `Bytex.Indicators` | Technical + order-book indicators |
| `Bytex.Persistence.Postgres` / `.Redis` / `.Shared` | `IKeyValueStore` conformance (kv/set/list/hash); Redis streams for bus |
| `Bytex.Adapters.*` | Venue-specific `IDataClient` / `IExecutionClient` implementations |

Not in scope for adoption as-is: `Bytex.Cli`, full `.NET` hosting stack, Docker-first node deployment.

---

## 3. HELIOS mapping targets (canonical owners)

| HELIOS surface | Canonical location (solstice) | What BYTEX must not duplicate |
|----------------|------------------------------|--------------------------------|
| **M21** Universal Execution Plan | `packages/platform/src/helios/multi-asset/m21/` | Kernel authorization, work-order binding |
| **M22** Execution tactics | `packages/platform/src/helios/multi-asset/m22/` | Provider-neutral tactic planning, slippage ceilings |
| **M23** Execution routing | `packages/platform/src/helios/execution-routing/` | Regulatory-compatible route filter (not a score) |
| **M24** Settlement / reconciliation | `packages/platform/src/helios/multi-asset/m24/` + `order-lifecycle/` | Asset-class settlement, cash availability, Evidence Vault |
| **M25** Continuous runtime | `packages/platform/src/helios/continuous-runtime/` | Governed automation cycle, no busy-loop polling |
| **Strategy Lab** | `packages/strategy-lab/` | Chronological evaluation, walk-forward, cost/fill/latency models |
| **Strategy Capsules** | `packages/strategy-lab/src/capsule/`, `packages/platform/src/helios/strategy-capsule/` | Material hash, promotion gates, no direct execution |
| **Risk Engine** | M17–M20 portfolio/risk, `strategy-lab/kill-switch`, H23 pre-trade ports | Loss limits, concentration — not BYTEX `OrderPolicy` alone |
| **Provider SDK** | `packages/platform/src/helios/provider-orchestration/`, `execution-routing/adapters/` | H22 orchestration + H23 adapter ports (simulation today) |
| **Observation Fabric** | `packages/platform/src/helios/observation/`, `market-observation/` | Provenance, freshness, entitlements; no fabricated depth |
| **Feature Fabric** | Strategy Lab `m09/features`, evaluation engine, M18 factor graph | Derived features with evidence — not a separate BYTEX port |
| **Evidence Vault** | `@solstice/evidence` via M24/M16 sealing | Hash-chained records; BYTEX `NodeStore` journal ≠ vault |

---

## 4. Classification legend

| Class | Meaning | Typical follow-up |
|-------|---------|-------------------|
| **ALREADY_SUPERIOR_IN_HELIOS** | HELIOS already meets or exceeds the capability with governance BYTEX lacks | Document parity tests only |
| **HELIOS_PARTIAL** | Concept exists but depth, venue parity, or simulation realism lags BYTEX | Extend existing module |
| **PORT_ALGORITHM** | Valuable deterministic algorithm → clean-room TypeScript with Apache-2.0 attribution | Implementation WP |
| **PORT_TEST_PATTERN** | Test scenarios / qualification matrices worth mirroring | Add HELIOS tests/fixtures |
| **DESIGN_REFERENCE_ONLY** | Inform schemas, ADRs, or sandbox design; no code port | Architecture note |
| **DO_NOT_USE** | Conflicts with SunRey constitution or wrong abstraction layer | Explicit exclusion |

---

## 5. Master capability matrix

### 5.1 Event processing and runtime parity

| BYTEX capability | Source (BYTEX) | HELIOS target | Class | Notes |
|------------------|----------------|---------------|-------|-------|
| Single-threaded deterministic event ordering | `MessageBus`, `TradingRuntime`, `LiveTradingRuntimeLoop` | M25 continuous runtime cycle stages | **DESIGN_REFERENCE_ONLY** | HELIOS uses governed queue/cadence profiles, not a trading `MessageBus`; borrow **ordering discipline** for simulation harnesses only |
| Backtest / sandbox / live strategy parity | `TradingRuntimeConfig.Environment`, shared `RuntimeModule` | Strategy Lab evaluation + paper + M24 live path (simulation) | **HELIOS_PARTIAL** | Capsule/code strategies qualify; full **code parity** across three modes is BYTEX-stronger today |
| Component lifecycle (connect, fault, halt) | `TradingNode`, `OrderPolicy` halt | M25 supervision modes, H27 kill-state (deferred) | **HELIOS_PARTIAL** | BYTEX node halt/resume patterns are **PORT_TEST_PATTERN** for M25 |
| Plugin registry (custom algos, node types) | `Bytex.Core/Plugins` | Strategy Capsule compiler extensions | **DESIGN_REFERENCE_ONLY** | HELIOS promotion authority is stricter than plugin load |
| Test clock vs live clock | `Timing/Clocks.cs` | Strategy Lab chronology, `FrozenClock` in tests | **ALREADY_SUPERIOR_IN_HELIOS** | HELIOS evaluation latency model forbids zero-latency default |
| Post-to-loop marshaling | `TradingRuntime` `post` action | N/A (Node async BFF) | **DO_NOT_USE** | Different hosting model |

### 5.2 Matching engine and market simulation

| BYTEX capability | Source | HELIOS target | Class | Notes |
|------------------|--------|---------------|-------|-------|
| Per-instrument matching engine | `OrderMatchingEngine.cs` | Strategy Lab `evaluation/` + future HELIOS sim venue | **PORT_ALGORITHM** | ~1.4k LOC of bar/quote/trade/book rules; port subset aligned to `bigint` |
| Simulated multi-venue exchange | `SimulatedExchange.cs` | Paper strategy + Strategy Lab simulator | **HELIOS_PARTIAL** | BYTEX: margin, funding, liquidation, latency queue in one venue |
| L1 touch + L2 book walk | `OrderMatchingEngine` + `OrderBook` | Observation fabric (L1 today); evaluation fill model | **PORT_ALGORITHM** | Strategy Lab explicitly refuses invented depth (`fill-model.ts`); BYTEX book walk is the gap |
| Own-order queue / queue priority | `OwnOrderBook.cs` | — | **PORT_ALGORITHM** | Needed for realistic limit fill priority in research |
| Bar execution modes (OHLC path, tick walk, H/L first) | `BarExecutionMode`, `SimulatedVenueConfig` | Strategy Lab information-time / bar replay | **PORT_ALGORITHM** + **PORT_TEST_PATTERN** | Port modes + golden vectors from BYTEX tests |
| Partial fills bounded by available size | `FillSizing.AvailableSize` | M24 partial fill + Strategy Lab `partial` flag | **HELIOS_PARTIAL** | M24 provider lifecycle yes; **simulator** depth-bounded partials no |
| Probabilistic fill model (seeded) | `FillModel` | Strategy Lab deterministic fills | **DESIGN_REFERENCE_ONLY** | HELIOS prefers deterministic research; seeded rolls useful for **stress** suites only |
| Paper venue vs live book (sandbox) | `SandboxExecutionClient` | Paper strategy / forward paper scenarios | **HELIOS_PARTIAL** | BYTEX matches against live L2; HELIOS paper uses assumptions not live book |
| Reference backtests on commit | BYTEX CI reference runs | `release-candidate/forward-paper-scenarios` | **PORT_TEST_PATTERN** | Mirror “known answer” regression style, not .NET jobs |

### 5.3 Quotes, trades, bars, and data catalog

| BYTEX capability | Source | HELIOS target | Class | Notes |
|------------------|--------|---------------|-------|-------|
| Quote / trade / bar unified `IData` stream | `Model/Data`, `BacktestEngine` sort | Observation fabric ingest | **HELIOS_PARTIAL** | HELIOS has bars/quotes; unified replay iterator is BYTEX-stronger |
| Information-driven bars (imbalance, runs) | `InformationBars.cs`, `SamplingMethod.cs` | Feature Fabric / Strategy Lab features | **PORT_ALGORITHM** | Port as optional feature generators with provenance |
| Time / tick / volume / value bars | `BarAggregator` hierarchy | Strategy Lab dataset + M06+ market data | **PORT_ALGORITHM** | Low risk port |
| Parquet market archive + manifest commits | `Bytex.Data/MarketArchive` | Persistence / observation store | **DESIGN_REFERENCE_ONLY** | SunRey uses PG + domain stores; borrow **segment sizing** (`MaxRowsPerFile`) ideas |
| Bounded order-book depth files | `book_depth`, `OrderBookDepth` | Observation fabric storage policy | **DESIGN_REFERENCE_ONLY** | 4.3 GiB/day motivation — adopt caps, not Parquet layout literally |
| Databento / Tardis adapters | `Bytex.Adapters.Databento`, `.Tardis` | Provider SDK (historical) | **DESIGN_REFERENCE_ONLY** | Fixture-only until production oracle policy allows; no live pull in simulation CI |
| Legacy CSV / exchange dump import | `LegacyArchiveMigration`, adapter history | Market data ingestion pipelines | **PORT_TEST_PATTERN** | Test fixtures for normalization |

### 5.4 Latency, fees, slippage, funding, liquidation, margin

| BYTEX capability | Source | HELIOS target | Class | Notes |
|------------------|--------|---------------|-------|-------|
| Command latency model (insert/update/cancel) | `LatencyModel` | Strategy Lab `evaluation/latency-model.ts` (decision timeline) | **HELIOS_PARTIAL** | BYTEX models **venue RTT**; HELIOS models **research pipeline** latency — both needed, different layer |
| Slippage (probabilistic tick slip) | `FillModel.ProbSlippage` | M22 `transaction-cost`, paper `slippageBps` | **HELIOS_PARTIAL** | HELIOS uses bps assumptions; port **book-walk slippage** not probability by default |
| Fee models (maker/taker, per-contract, fixed) | `Models.cs` fee hierarchy | Strategy Lab `evaluation/cost-model.ts`, M24 fill fees | **PORT_ALGORITHM** | Map to minor-unit fee lines on fills |
| Instrument-stored venue fees | `Instrument.CalculateCommission` | Provider capability metadata | **HELIOS_PARTIAL** | BYTEX embeds fees per instrument; HELIOS often uses plan-level assumptions |
| Perpetual funding payments | `SimulatedExchange.ProcessFundingRate` | — (crypto sim) | **PORT_ALGORITHM** | No HELIOS margin perp funding loop in M24 today |
| Margin initial/maintenance (tiered) | `MarginModels.cs` | Portfolio risk / futures semantics | **HELIOS_PARTIAL** | BYTEX tier table simulation > HELIOS T+1 unsettled cash focus |
| Liquidation at maintenance breach | `SimulatedExchange.LiquidateIn` | M24 exit taxonomy (`provider liquidation`) | **PORT_ALGORITHM** | Simulate only; Kernel still gates real exits |
| Margin for working orders | Simulated venue configs 0.6+ | Capital reservation (H23) | **HELIOS_PARTIAL** | HELIOS reserves on submit; BYTEX also models **order margin** in sim |
| Leverage per instrument | `SimulatedVenueConfig.Leverages` | Multi-asset tradability | **DESIGN_REFERENCE_ONLY** | Policy via mandates, not strategy-set leverage alone |

### 5.5 Reconciliation and order restoration

| BYTEX capability | Source | HELIOS target | Class | Notes |
|------------------|--------|---------------|-------|-------|
| Startup reconciliation (`ReconcileOnStart`) | `TradingNode.cs` | M24 reconciliation + M25 `RECONCILIATION_REQUIRED` | **HELIOS_PARTIAL** | HELIOS qualifies scenarios; BYTEX has **production-hardened** mass-status loop |
| Continuous reconciliation timer | `ReconciliationInterval`, `ReconcileAgain` | M25 `RECONCILIATION_PERIODIC` cadence | **PORT_ALGORITHM** | Port scheduling + “don’t reconcile over in-flight submit” guard |
| Mass status adopt external orders | `OrderCoordinator.ReconcileMassStatus` | M24 `reconciliation.ts` | **HELIOS_PARTIAL** | BYTEX adopts unknown venue orders; HELIOS emphasizes exception evidence |
| Working order restore after reconnect | Cache + coordinator state | M24 restart mid-order tests | **HELIOS_PARTIAL** | BYTEX + `NodeStore` strategy state; HELIOS H23 store |
| Reconciliation during open submit | TradingNode guard | M24 UNKNOWN_PROVIDER_STATE | **PORT_TEST_PATTERN** | Explicit test from BYTEX comment lines 649–667 |
| Difference counters / control channel payload | `NodeControl.ReconciliationPayload` | Observability / BFF reads (H26 deferred) | **DESIGN_REFERENCE_ONLY** | Shape for operator visibility |

### 5.6 Execution algorithms, TWAP, contingencies

| BYTEX capability | Source | HELIOS target | Class | Notes |
|------------------|--------|---------------|-------|-------|
| TWAP schedule (slice parent order) | `TwapSchedule.cs` | M22 `TWAP_SLICE` tactic | **PORT_ALGORITHM** | M22 taxonomy includes TWAP; BYTEX has **working reference implementation** |
| Order schedule plugin API | `OrderSchedule`, `IOrderScheduleProvider` | M22 planner + M21 `TWAP` requirement | **DESIGN_REFERENCE_ONLY** | HELIOS tactics are plan-level, not in-process timers |
| Client spawn / child order linkage | `ExecSpawnId`, cache queries | M22 continuation + M24 fill lineage | **HELIOS_PARTIAL** | Model parent/child order IDs in evidence |
| OCO / OTO / OUO / bracket orders | `OrderFactory` | H23 order types (subset) | **HELIOS_PARTIAL** | BYTEX broader; port **contingency state machine** as spec |
| Engine-emulated stops (venue lacks native) | `OrderFactory` emulation triggers | Provider adapter capability flags | **DESIGN_REFERENCE_ONLY** | Live emulation belongs in adapter layer, simulation only until LIVE_* |
| Iceberg / display quantity | Order types | — | **DESIGN_REFERENCE_ONLY** | Low priority for HELIOS multi-asset v1 |
| Venue refuses amend | `SimulatedVenueConfig.RefusesOrderAmends` | M23 route capability matrix | **PORT_TEST_PATTERN** | Qualification fixture per venue behavior |

### 5.7 Strategy documents vs Strategy Capsules

| BYTEX capability | Source | HELIOS target | Class | Notes |
|------------------|--------|---------------|-------|-------|
| JSON strategy graph (nodes/edges/phases) | `StrategyDocument.cs` v2.0 | Strategy Capsule DSL + compiler | **DESIGN_REFERENCE_ONLY** | Different auth model; borrow **validator layering** |
| Annotated parameter catalog (units, sentences) | `Catalog/`, `Annotations/` | Capsule parameter specs | **PORT_ALGORITHM** | Improves explainability for M16 scorecard |
| Three-layer validator | `DocumentValidator.cs` | `strategy-lab/validation.ts` | **HELIOS_PARTIAL** | BYTEX schema + semantic + runtime layers |
| Document runtime on bar/quote/trade ticks | `DocumentStrategy.cs`, `EvaluationPlan` | Strategy Lab chronological evaluation | **HELIOS_PARTIAL** | BYTEX tick eval + sizing ceiling; HELIOS H17 chronology |
| Builtin node catalog (indicator/condition/action) | `Catalog/Types/*` | Strategy Lab rules + capsules M09–M12 | **DESIGN_REFERENCE_ONLY** | Do not import node IDs wholesale |
| Document-named TWAP | `OrderWork.Twap` | M21 `TWAP` requirement | **ALREADY_SUPERIOR_IN_HELIOS** | Requirement exists; implementation depth is M22 gap |
| Example documents (EMA cross, etc.) | `Examples/*.json` | Strategy Lab fixtures | **PORT_TEST_PATTERN** | Rebuild as HELIOS capsule fixtures, not runtime import |

### 5.8 Adapter SDK and exchange adapters

| BYTEX capability | Source | HELIOS target | Class | Notes |
|------------------|--------|---------------|-------|-------|
| `IDataClient` / `IExecutionClient` contracts | `Adapters/Contracts.cs` | `provider-orchestration/adapter-port.ts`, H23 ports | **DESIGN_REFERENCE_ONLY** | Map concepts to existing TypeScript ports |
| `TradingRuntimeServices` injection | Adapters ctor pattern | Provider orchestration service | **DESIGN_REFERENCE_ONLY** | No .NET DI |
| Capability guards (precision, leverage) | `CapabilityGuard`, `LeverageGuard` | M23 route catalog + validation | **PORT_ALGORITHM** | Port as pure validation functions |
| Venue family resolver / descriptor | `VenueDescriptor`, `VenueFamilyResolver` | Multi-asset tradability registry | **HELIOS_PARTIAL** | |
| Binance / Bybit / OKX / Kraken / Bitget / Gate / Kucoin / Hyperliquid | `Bytex.Adapters.*` | Execution routing fixtures (simulation) | **DO_NOT_USE** (as-is) | **DESIGN_REFERENCE_ONLY** for message mapping; implement TS **sandbox** adapters under H22, not copy C# |
| Broker/client order ID on every order | Adapters 0.7+ | H23 provider order IDs | **ALREADY_SUPERIOR_IN_HELIOS** | M24 records require provider IDs + payload hash |
| Historical download helpers | e.g. `BinanceHistory.cs` | — | **DO_NOT_USE** | Real network; violates simulation CI rules |

### 5.9 Persistence model

| BYTEX capability | Source | HELIOS target | Class | Notes |
|------------------|--------|---------------|-------|-------|
| `ICacheDatabase` abstract kv/set/list/hash | `Persistence.Shared` | HELIOS store ports (`m24/store`, strategy-lab store) | **DESIGN_REFERENCE_ONLY** | Shape-compatible list ordering rules worth an ADR |
| Postgres backing store | `PostgresStore.cs` | `packages/persistence` | **DESIGN_REFERENCE_ONLY** | SunRey already has PG migrations; do not second store |
| Redis streams for message bus | `RedisStore.StreamAdd` | Events / outbox patterns | **DO_NOT_USE** for HELIOS engine | Different messaging owner (`packages/events`) |
| Node journal + periodic strategy save | `NodeStore.cs` | M25 recovery + Evidence Vault | **HELIOS_PARTIAL** | BYTEX journal is ops evidence; HELIOS needs **vault seals** on reconciliation outcomes |
| RuntimeModule `OnSave` / restore | `RuntimeModule.cs` | M25 `recoveryAfterRestart` | **PORT_TEST_PATTERN** | Scenarios for strategy phase restoration |
| State flush vs load on start | `TradingRuntimeConfig.LoadState` | Continuous runtime store | **DESIGN_REFERENCE_ONLY** | |

### 5.10 Indicators and “Feature Fabric”

| BYTEX capability | Source | HELIOS target | Class | Notes |
|------------------|--------|---------------|-------|-------|
| Classic indicators library | `Bytex.Indicators` | Strategy Lab features / DSL | **PORT_ALGORITHM** (selective) | Port only indicators referenced by HELIOS capsules |
| Order-book indicators (`IOrderBookIndicator`) | `Book.cs` etc. | Feature Fabric (derived) | **HELIOS_PARTIAL** | Requires L2 observation path first |
| Indicator registration on book updates | `RuntimeModule.RegisterIndicatorForOrderBook` | Observation → feature pipeline | **DESIGN_REFERENCE_ONLY** | |

### 5.11 Risk engine (BYTEX `OrderPolicy` vs HELIOS)

| BYTEX capability | Source | HELIOS target | Class | Notes |
|------------------|--------|---------------|-------|-------|
| Pre-trade precision / min notional | `OrderPolicy` | H23 validation ports | **ALREADY_SUPERIOR_IN_HELIOS** | Kernel + mandate stack |
| Loss limit including unrealized | `OrderPolicy` | M17–M20 portfolio risk | **HELIOS_PARTIAL** | BYTEX watches between fills; HELIOS has qualification shims |
| Exposure / position / working order caps | `OrderPolicy` limits | Risk engine + M22 refusal reasons | **PORT_TEST_PATTERN** | Align limit matrices with BYTEX scenarios |
| Trading halt without process kill | `OrderPolicy` halt | M25 `FAILED_SAFE`, strategy kill-switch | **HELIOS_PARTIAL** | |
| BYTEX as risk authority | — | — | **DO_NOT_USE** | Risk decisions stay HELIOS + Kernel, not imported policy component |

### 5.12 Research tooling (secondary)

| BYTEX capability | Source | HELIOS target | Class | Notes |
|------------------|--------|---------------|-------|-------|
| Batch backtest / parameter grid | `BacktestBatch`, `BacktestSearch` | Strategy Lab experiments | **DESIGN_REFERENCE_ONLY** | |
| Performance statistics plugins | `IPerformanceStatistic` | Strategy Lab metrics | **DESIGN_REFERENCE_ONLY** | |
| Tearsheet HTML report | `Tearsheet.cs` | Release evidence reports | **DO_NOT_USE** | Use HELIOS reporting conventions |

---

## 6. Cross-walk by HELIOS milestone (summary)

| Milestone | BYTEX primary donors | Dominant class | Recommended OS02 focus |
|-----------|---------------------|----------------|------------------------|
| **M21** | TWAP requirement parity, urgency/slice params | ALREADY_SUPERIOR / HELIOS_PARTIAL | Bind M21 plans to sim harness |
| **M22** | `TwapSchedule`, transaction cost from book walk | PORT_ALGORITHM | TWAP + participation tactics vs BYTEX golden slices |
| **M23** | Venue capability guards, amend/refusal flags | PORT_ALGORITHM + PORT_TEST_PATTERN | Extend route catalog fixtures |
| **M24** | Reconciliation loop, partial fill reports | HELIOS_PARTIAL + PORT_TEST_PATTERN | Continuous reconcile scheduler |
| **M25** | Node restart, reconciliation blocking, halt | PORT_TEST_PATTERN | Import scenario list from BYTEX live tests |
| **Strategy Lab** | Matching engine, bar modes, archive streaming | PORT_ALGORITHM | Depth-bounded fills behind feature flag |
| **Strategy Capsules** | Document validator annotations | PORT_ALGORITHM | Parameter explainability |
| **Observation Fabric** | L2 delta archive, catalog | DESIGN_REFERENCE + HELIOS_PARTIAL | Depth ingestion caps |
| **Provider SDK** | Adapter contract shape | DESIGN_REFERENCE_ONLY | TS sandbox adapters only |
| **Evidence Vault** | — | ALREADY_SUPERIOR_IN_HELIOS | Seal sim/recon outcomes when porting |

---

## 7. Explicit exclusions (`DO_NOT_USE`)

1. **Entire .NET `TradingRuntime` or NuGet packages** as a production dependency — no overwhelming case; violates TS/canonical-type strategy.
2. **Live BYTEX exchange adapters** wired to real APIs in CI or HELIOS runtime — simulation-only constitution.
3. **Redis-backed message bus** as HELIOS engine transport — use `packages/events` abstractions.
4. **BYTEX portfolio/account as financial source of truth** — balances remain ledger-derived in SunRey.
5. **Floating-point or `decimal` money in ports** — all ported economics use `bigint` minor units.
6. **Importing BYTEX strategy JSON documents** as executable authority — capsules remain HELIOS-governed.
7. **Network-based historical download scripts** from adapter packages in automated tests.

---

## 8. Provenance and attribution (required for ports)

When implementing `PORT_ALGORITHM` or `PORT_TEST_PATTERN` items:

```text
# SPDX-Provenance
# Adapted from BYTEX (Apache-2.0)
# Upstream: https://github.com/BYTEX-TRADE/bytex
# File: <upstream path>
# Commit: 67b3e103043476a0490bb7afa146ec9ac339b116
# NOTE: Clean-room TypeScript reimplementation; behavior intentionally aligned for qualification.
```

Store golden vectors (inputs/outputs) in HELIOS tests — not copied BYTEX test code — to prove alignment without derivative licensing ambiguity on test suites.

---

## 9. Suggested OS02 implementation priority (no behavior change in OS01)

Priority is **research realism and qualification depth** without live trading.

| Priority | Item | Class | HELIOS landing zone (proposed) |
|----------|------|-------|--------------------------------|
| P0 | Order-book-bounded partial fills + L2 walk | PORT_ALGORITHM | `packages/strategy-lab/src/evaluation/` (+ optional `helios/sim-venue/`) |
| P0 | TWAP slice scheduler semantics | PORT_ALGORITHM | `packages/platform/src/helios/multi-asset/m22/` |
| P1 | Bar execution modes + golden replay | PORT_ALGORITHM | Strategy Lab chronology fixtures |
| P1 | Continuous reconciliation scheduler + guards | PORT_ALGORITHM | `continuous-runtime/` + M24 |
| P1 | Fee model matrix (per-contract, maker/taker) | PORT_ALGORITHM | Strategy Lab cost model + M24 fill fee lines |
| P2 | Perp funding + liquidation sim | PORT_ALGORITHM | Isolated sim module (crypto paper only) |
| P2 | Information bars / volume bars | PORT_ALGORITHM | Feature pipeline + observation ingest |
| P2 | Venue amend/refusal qualification fixtures | PORT_TEST_PATTERN | `execution-routing/fixtures.ts` |
| P3 | Document-style parameter annotations | PORT_ALGORITHM | Strategy Capsule schema/docs |

---

## 10. Architecture and production-safety posture (OS01)

This work package adds **documentation only** under `docs/helios/open-source/`. It does not:

- modify `ENVIRONMENT`, `LIVE_*` flags, or provider bindings;
- add Kernel mutators or ledger postings;
- import BYTEX binaries or enable network calls.

Expected CI impact: none beyond markdown presence (integrity/architecture stages remain green).

---

## 11. Key BYTEX source index (for reviewers)

| Topic | Path under BYTEX `@ 67b3e10` |
|-------|------------------------------|
| Matching engine | `src/Bytex.Backtest/OrderMatchingEngine.cs` |
| Simulated venue | `src/Bytex.Backtest/SimulatedExchange.cs` |
| Fill / fee / latency models | `src/Bytex.Backtest/Models.cs` |
| Backtest runner | `src/Bytex.Backtest/BacktestEngine.cs` |
| TWAP | `src/Bytex.Core/Trading/TwapSchedule.cs` |
| Order coordination + reconciliation | `src/Bytex.Core/Engines/OrderCoordinator.cs` |
| Pre-trade policy | `src/Bytex.Core/Engines/OrderPolicy.cs` |
| Live node + reconciliation | `src/Bytex.Live/TradingNode.cs` |
| Sandbox paper vs book | `src/Bytex.Live/Sandbox/SandboxExecutionClient.cs` |
| Strategy document schema | `src/Bytex.Documents/Schema/StrategyDocument.cs` |
| Market archive | `src/Bytex.Data/MarketArchive.cs` |
| Adapter contracts | `src/Bytex.Core/Adapters/Contracts.cs` |
| Postgres KV store | `src/Bytex.Persistence.Postgres/PostgresStore.cs` |

---

## 12. Document control

| Field | Value |
|-------|-------|
| Owner | HELIOS open-source integration (OS01) |
| Next review | When OS02 first port lands or BYTEX reaches 1.0 API freeze |
| Related HELIOS docs | `docs/helios/HELIOS_MULTI_ASSET_M21_M24_EXECUTION_LAYER_CLOSURE.md`, `H01_RUNTIME_TRUTH_MAP.md` |
