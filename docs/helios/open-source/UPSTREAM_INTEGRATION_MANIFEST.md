# HELIOS open-source integration manifest (OS00)

Controlled third-party intake for HELIOS. This work package records provenance, pinning, canonical ownership, and non-duplication constraints only. **No trading behavior is implemented here.**

Machine-readable lock: [`upstream-lock.json`](./upstream-lock.json)

---

## Solstice baseline (execution time)

| Item | Value |
|------|--------|
| Remote | `origin/main` |
| SHA | `00a51dfd1c5771e9d65c74b0b4a8917d76db0a20` |
| Fetch | 2026-11-03 09:31 (Asia/Riyadh) / 2026-11-03T06:31:35Z |

---

## Adaptive Alpha Fabric (AAF) recovery assessment

Open PRs inspected (no merges performed):

| PR | Branch | Head SHA | Scope | CI | HELIOS RC |
|----|--------|----------|-------|----|----|
| [#579](https://github.com/reyesnick54/solstice/pull/579) | `helios/adaptive-alpha-fabric` | `a0a9552bd378edca0f161075fbe3ced396b1b072` | AAF02–AAF10 implementation | **FAIL** | **FAIL** |
| [#580](https://github.com/reyesnick54/solstice/pull/580) | `helios-aaf-adaptive-alpha-fabric-merge` | `a051b3d808ed6034110e2c88d660810b0b5c4fb0` | AAF02–AAF10 + CI repairs | **FAIL** | **FAIL** |
| [#581](https://github.com/reyesnick54/solstice/pull/581) | `aaf01-current-state-truth-map` | `cbfd6b5540843a4ed0209888de038560d20936f1` | AAF01 truth map + merged AAF02–AAF10 + CI fix merges | **FAIL** | **FAIL** |

**Recommended recovery branch:** `aaf01-current-state-truth-map` ([PR #581](https://github.com/reyesnick54/solstice/pull/581)).

Rationale:

- Contains the full **AAF02–AAF10** code path (same functional surface as #579/#580).
- Merges CI repair commits from `helios-aaf-adaptive-alpha-fabric-merge` and documents gaps in `docs/helios/adaptive-alpha/AAF01_*`.
- Best single branch for a future integration base once qualification is green.

**Qualification status:** **RED** — do not start behavioral open-source porting until AAF CI/typecheck/HELIOS RC pass.

Representative CI blockers (PR #580 run `38729076910`):

- Typecheck failures in `packages/economic-asset-registry/src/knowledge-graph/*` (missing exports, bad relative imports to `domain`, branded ID typing).
- Additional type errors in `packages/economic-awareness-fabric`, `packages/external-data`, `packages/config`.
- HELIOS workflow **BUILD → QUALIFY → MANIFEST** failed in parallel with CI.

AAF-specific gaps (from `AAF01_GAP_REGISTER` on PR #581):

- **G-INT-01** — feature-fabric barrel export mismatch for revision ledger.
- **G-INT-03 / G-INT-04** — AAF08 equities qualification blocked; AAF10 timezone test failure.
- **G-INT-02** — full-repo typecheck not proven green in audit environment.

**OS00 decision:** Produce upstream inventory and integration maps only; document blockers; do not bypass qualification gates.

---

## Reference clone workspace

Upstream repositories were cloned **outside** committed Solstice source:

- Preferred: `../_helios_upstream_reference/` (may require host permission).
- OS00 audit used: `/tmp/_helios_upstream_reference/`.

Rules enforced:

- No git subtree of full upstream trees.
- No runtime npm/pip dependency on upstream packages without architectural review.
- No direct exposure of upstream order-placement or credential paths to HELIOS.

---

## Upstream A — BYTEX

| Field | Value |
|-------|--------|
| Repository | https://github.com/BYTEX-TRADE/bytex |
| Pinned SHA | `67b3e103043476a0490bb7afa146ec9ac339b116` |
| Upstream `main` at fetch | Same (current) |
| License | **Apache-2.0** (`LICENSE`) |
| Fetch timestamp | 2026-11-03T06:31:35Z |

**Relevant directories**

- `src/Bytex.Core` — event-driven trading runtime, deterministic single-threaded processing.
- `src/Bytex.Backtest` — historical simulation parity with live/sandbox.
- `src/Bytex.Indicators` — technical indicator library (C#).
- `src/Bytex.Data` — market data normalization.
- `src/Bytex.Adapters.*` — exchange venue adapters (Binance, Bybit, Hyperliquid, etc.).
- `docs/concepts` — engine invariants and versioning.

**Relevant concepts**

- Research-to-production parity (same strategy code across backtest/sandbox/live).
- Event-sourced bar/tick pipeline and pre-trade limits.
- Adapter pattern for venue-specific connectivity.

**Code potentially portable (native Solstice reimplementation preferred)**

- Indicator **algorithms** (math only) → TypeScript under Strategy Lab evaluation fixtures.
- Backtest **event ordering** invariants → Strategy Lab chronology tests (H17 alignment).
- Documentation patterns for adapter certification → AAF07 external market-data certification overlays.

**Design-only inspiration**

- Full C# engine embedding (stack mismatch with SunRey TypeScript monorepo).
- Live venue adapters and `.Live` execution paths.

**Dependencies (upstream)**

- .NET 10, venue SDKs inside adapter projects, optional Postgres/Redis/S3 persistence packages.

**Security observations**

- Live adapters expect exchange API keys in deployment config — **must never** enter HELIOS simulation paths or customer PDV.
- Pre-release API surface; pin SHA and re-audit before any port.

**Architectural conflicts**

- BYTEX includes its own execution, risk limits, and ledger-like position state → **conflicts** with `packages/kernel`, `packages/ledger`, `packages/risk`, `packages/investments`.
- Cannot become a second Exchange or Execution Authority.

**Canonical HELIOS owner**

- Backtest/indicator math: `packages/strategy-lab`
- Market data fixtures: `packages/external-data` + `packages/platform/src/helios/observation`
- Execution: `packages/investments` + Kernel-gated intents only

**Direct reuse legally permissible?** Yes (Apache-2.0), with NOTICE preservation and documented upstream file paths.

**Attribution** — Retain Apache-2.0 header blocks; add entry to `THIRD_PARTY_NOTICES` when code is ported (see [LICENSE_AND_ATTRIBUTION_PLAN.md](./LICENSE_AND_ATTRIBUTION_PLAN.md)).

---

## Upstream B — OpenChart

| Field | Value |
|-------|--------|
| Repository | https://github.com/longsurf-ai/openchart |
| Pinned SHA | `8109466bfb5d44c32e0e03e9337eaca48b837ab4` |
| Upstream `main` at fetch | Same (current) |
| License | **MIT** (`LICENSE`, Copyright Longsurf, Inc. 2026) |
| Fetch timestamp | 2026-11-03T06:31:35Z |

**Relevant directories**

- `server/indicators` — study catalog, builtins, volume profile.
- `server/feed` / `server/data` — streaming and historical data plumbing.
- `server/alert` — conditional alerts on market events.
- `common` — shared types/utilities.
- `docs/architecture` — product architecture (agent + chart workspace).

**Relevant concepts**

- Agent-in-the-loop chart analysis UX.
- Indicator/study registry and featured studies.
- Alert semantics tied to market state (not autonomous trading authority).

**Code potentially portable**

- Pure indicator/study computations in TypeScript (after license review per file).
- Alert **condition DSL** patterns → HELIOS observation quality / freshness flags (not a second alert authority).

**Design-only inspiration**

- Desktop/Electron shell, Tea editor, full OpenChart server deployment.
- End-user broker connectivity inside OpenChart app.

**Dependencies (upstream)**

- Bun, Node 24, large frontend stack; self-hosted server components.

**Security observations**

- Agent integrations may pass user API keys to external LLM providers — Solstice must route inference only via `packages/ai-runtime` with mandates and no financial execution.

**Architectural conflicts**

- OpenChart is a standalone product with its own data plane — not a substitute for HELIOS Observation Fabric (H08) or Feature Fabric (AAF02).

**Canonical HELIOS owner**

- Indicators/features: `packages/platform/src/helios/feature-fabric`
- Observations: `packages/platform/src/helios/observation`
- Consumer surfaces: `services/api` (orchestration only)

**Direct reuse legally permissible?** Yes (MIT), with copyright notice in source and `THIRD_PARTY_NOTICES`.

---

## Upstream C — TradingAgents

| Field | Value |
|-------|--------|
| Repository | https://github.com/TauricResearch/TradingAgents |
| Pinned SHA | `c4544913a14ed3df5f1ed7b9e8483270ce20682a` |
| Upstream `main` at fetch | Same (current) |
| License | **Apache-2.0** (`LICENSE`) |
| Fetch timestamp | 2026-11-03T06:31:35Z |

**Relevant directories**

- `tradingagents/graph` — LangGraph multi-agent workflow.
- `tradingagents/agents` — analyst/researcher/trader/risk manager roles.
- `tradingagents/dataflows` — vendor APIs (Alpha Vantage, FRED, yfinance, etc.).
- `tradingagents/memory` — conversation/run memory.
- `tradingagents/llm_clients` — model provider wiring.

**Relevant concepts**

- Role-specialized agent debate → decision synthesis.
- Tool-using researchers with structured outputs.
- External vendor dataflows with API keys in environment.

**Code potentially portable**

- **Prompt/role taxonomy** and debate flow diagrams → Agentic Capital Mesh research routing (human-reviewable proposals only).
- Dataflow **interface shapes** → external-data fixture adapters (simulation only).

**Design-only inspiration**

- Python LangGraph runtime as HELIOS execution core (stack mismatch).
- Trader agent that emits orders directly.

**Dependencies (upstream)**

- `langgraph`, `langchain-*`, `pandas`, `yfinance`, `requests`, optional AWS Bedrock.

**Security observations**

- Reads `ALPHA_VANTAGE_API_KEY`, FRED keys, etc. from environment — must stay in certification sandboxes, never in customer credential stores.
- `dataflows/net.py` scrubs secrets from errors (good pattern to emulate in Solstice fixture clients).

**Architectural conflicts**

- Framework includes trader/risk agents that resemble Execution Authority and Risk Engine → **must not** wire upstream trader output to Kernel or ledger.
- Agent proposals in Solstice remain non-authoritative until ProposalGate + Kernel.

**Canonical HELIOS owner**

- Multi-agent research orchestration: `packages/agentic-capital-mesh`
- Inference: `packages/ai-runtime`
- Market data fixtures: `packages/external-data`
- Strategy qualification: `packages/strategy-lab`

**Direct reuse legally permissible?** Yes (Apache-2.0) for ported modules; prefer native TypeScript reimplementation of graph logic to avoid Python runtime in critical path.

---

## Upstream D — Seris

| Field | Value |
|-------|--------|
| Repository | https://github.com/aowang-ai/seris |
| Pinned SHA | `f73dbbb0cd7e3b52601abf905bb871cdb9098550` |
| Upstream `main` at fetch | Same (current) |
| License | **Apache-2.0** (`LICENSE`, `NOTICE`) |
| Fetch timestamp | 2026-11-03T06:31:35Z |

**Relevant directories**

- `apps/core` — gateway, backtest engine, market data smoke tests.
- `apps/desktop-ui` — workspace UI, watchlists, chat-with-chart context.
- `apps/desktop` — Tauri shell.

**Relevant concepts**

- User-local strategy backtest against Binance/Hyperliquid historical candles.
- Chart-linked agent context (instrument, timeframe, range).
- BYOK model provider connections.

**Code potentially portable**

- Strategy review/backtest **workflow** steps → Strategy Lab promotion pipeline (H18).
- Context packaging schema for “what the model sees” → `packages/sunrey-agent` mandate context (non-executing).

**Design-only inspiration**

- Desktop Tauri distribution.
- Direct Hyperliquid/Binance historical download in client.

**Dependencies (upstream)**

- pnpm workspace, Node ≥22, Tauri, exchange HTTP APIs in core app.

**Security observations**

- Stores user provider keys locally — incompatible with SunRey custodial model; any pattern import must use `packages/security` secret references and never copy Seris storage verbatim.

**Architectural conflicts**

- Local backtest engine could duplicate Strategy Lab + exchange simulation → extend Strategy Lab instead.

**Canonical HELIOS owner**

- Backtest/shadow/paper: `packages/strategy-lab`
- Agent mandates: `packages/sunrey-agent`
- Quotes/history fixtures: `packages/external-data`

**Direct reuse legally permissible?** Yes (Apache-2.0); desktop app code is largely irrelevant to server-side HELIOS.

---

## Upstream E — Polymarket Prediction Bot

| Field | Value |
|-------|--------|
| Repository | https://github.com/semrincaballero/Polymarket-Prediction-Bot |
| Pinned SHA | `1f7c9761ddd26863242e3ed4f83c230ee38aebeb` |
| Upstream `main` at fetch | `e863a9b3bca7235e0f5489178a911120446373d1` (**newer than pin**) |
| License | **MIT** (`LICENSE`) |
| Fetch timestamp | 2026-11-03T06:31:35Z |

**Relevant directories**

- `polymarket_bot/core` — CLOB models, strategy engine, mock data.
- `polymarket_bot/config.py` — live credentials (`private_key`, `api_key`, `api_secret`).
- `support/data` — demo/paper datasets.

**Relevant concepts**

- Prediction-market CLOB order book and YES/NO probability framing.
- Edge vs fair-probability model; paper trading default.
- Textual TUI operational dashboard.

**Code potentially portable**

- Order book normalization math and **paper-mode** fill simulation → external-data fixture for prediction-market observations (research tier).
- Risk limit patterns (exposure caps) as **inputs** to `packages/risk` pre-trade simulation (not new engine).

**Design-only inspiration**

- Live Polymarket order placement and wallet private keys in config file.
- `support/block.py` HMAC auth helper tied to upstream site licensing — do not import blindly.

**Dependencies (upstream)**

- `textual`, `rich`, HTTP/WebSocket client stack (see `requirements.txt`).

**Security observations**

- **High risk:** explicit Polygon EOA `private_key` and Polymarket API secrets in config — forbidden in HELIOS customer paths.
- Default `--demo` paper mode aligns with Solstice simulation posture; live mode must remain unreachable from HELIOS automation.

**Architectural conflicts**

- Bot implements its own execution and wallet balance — conflicts with Kernel, ledger, custody, and Exchange ownership.

**Canonical HELIOS owner**

- Prediction-market observations: extend `packages/external-data` + HELIOS observation fabric (new instrument class under multi-asset M01 registry).
- Strategy signals: `packages/strategy-lab` shadow mode only.

**Direct reuse legally permissible?** Yes (MIT), excluding any credential-handling modules unless rewritten to simulation fixtures.

**Attribution** — MIT copyright line for Polymarket Prediction Bot contributors.

---

## Non-duplication constraint (mandatory)

External projects are **capability donors**, not new authorities. Never create a second:

| Forbidden duplicate | Canonical Solstice owner |
|--------------------|---------------------------|
| Risk Engine | `packages/risk` |
| Compliance Kernel | `packages/kernel` |
| Execution Authority | `packages/permissions` (issuer) + Kernel ALLOW |
| Ledger | `packages/ledger` |
| SunRey Exchange | `packages/sunrey-exchange` |
| HELIOS Observation Fabric | `packages/platform/src/helios/observation` |
| Feature Fabric | `packages/platform/src/helios/feature-fabric` |
| Strategy Lab | `packages/strategy-lab` |
| Meta Allocator | `packages/platform/src/helios/meta-allocator` |
| Agentic Capital Mesh | `packages/agentic-capital-mesh` |
| Evidence Vault | `packages/evidence` |

---

## Security boundary (all upstream)

No upstream integration may:

- Receive customer credentials or custody authority.
- Bypass user mandates, HELIOS risk, Compliance Kernel, or Execution Authority.
- Write directly to the canonical financial ledger.
- Set `LIVE_*` flags or change `ENVIRONMENT` away from `simulation`.

---

## Provenance rules for future ports (OS01+)

When source is ported or materially adapted:

1. Record upstream repository, file path, and SHA in commit message and/or `upstream-lock.json` bump.
2. Retain Apache-2.0 / MIT notices in file headers.
3. Update `THIRD_PARTY_NOTICES` (see attribution plan).
4. Prefer **native Solstice implementation** where stack or authority boundaries differ.

---

## Recommended integration order (OS01–OS15)

Sequential plan assuming AAF recovery branch becomes green before behavioral ports (OS04+). OS01–OS03 are safe while AAF is red.

| WP | Title | Depends on | Primary upstream | Canonical target | Notes |
|----|-------|------------|------------------|------------------|-------|
| **OS01** | Upstream lock CI gate | OS00 | — | `docs/helios/open-source/upstream-lock.json` + integrity script | Fail CI if pin drift without manifest update |
| **OS02** | THIRD_PARTY_NOTICES scaffold | OS00 | All | Repo root notices file | Legal aggregation only |
| **OS03** | Canonical owner crosswalk | OS00 | All | [CANONICAL_OWNER_MAP.md](./CANONICAL_OWNER_MAP.md) | Keep synced with authority matrix |
| **OS04** | AAF recovery merge gate | AAF green | — | `aaf01-current-state-truth-map` → main | Close G-INT-* before any code port |
| **OS05** | OpenChart indicator math audit | OS04 | OpenChart | `feature-fabric` / Strategy Lab | Port pure functions only |
| **OS06** | BYTEX indicator parity fixtures | OS04 | BYTEX | `packages/strategy-lab` | Reimplement in TS; C# reference only |
| **OS07** | TradingAgents role graph → mesh | OS04 | TradingAgents | `agentic-capital-mesh` | Proposals only; no trader agent execution |
| **OS08** | TradingAgents dataflow fixture catalog | OS04 | TradingAgents | `packages/external-data` | Simulation vendors; AAF07 certification |
| **OS09** | Seris backtest workflow → Strategy Lab | OS04 | Seris | `packages/strategy-lab` | Promotion/H18 alignment |
| **OS10** | Seris/chart context → agent mandates | OS04 | Seris, OpenChart | `packages/sunrey-agent` | Context narrowing, not keys |
| **OS11** | OpenChart alert semantics → observation quality | OS04 | OpenChart | `helios/observation` | Quality flags, not standalone alert service |
| **OS12** | Polymarket CLOB observation plane | OS04 | Polymarket bot | `external-data` + multi-asset M01 | Paper/demo data only initially |
| **OS13** | Polymarket strategy shadow adapters | OS12 | Polymarket bot | `strategy-lab` forward-shadow | No live CLOB auth code |
| **OS14** | Port provenance enforcement | OS05–OS13 | All | CI + `THIRD_PARTY_NOTICES` | Per-file upstream trail |
| **OS15** | HELIOS open-source qualification RC | OS14 | — | HELIOS RC workflow | Marker: open-source integration simulation qualified |

---

## OS00 deliverables checklist

- [x] `UPSTREAM_INTEGRATION_MANIFEST.md` (this file)
- [x] `upstream-lock.json`
- [x] `LICENSE_AND_ATTRIBUTION_PLAN.md`
- [x] `CANONICAL_OWNER_MAP.md`
- [x] AAF PR inspection and recovery branch recommendation
- [x] Upstream SHA/license reverification at execution time
- [ ] Behavioral integration (explicitly deferred until AAF green)
