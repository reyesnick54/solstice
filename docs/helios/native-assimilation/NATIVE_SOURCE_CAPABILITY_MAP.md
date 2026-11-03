# NATIVE02 — Native source capability map

Maps major upstream modules to HELIOS assimilation class and canonical SunRey owner.  
**Classes:** `SAFE_TO_PORT` | `REQUIRES_REWRITE` | `REFERENCE_ONLY` | `DO_NOT_PORT` | `IRRELEVANT_TO_HELIOS`

Operational rule: **no module below is an npm/pnpm/pip dependency**; ports are copy-and-reimplement into listed owners with Kernel/EA boundaries intact.

---

## BYTEX

| Module | Class | Canonical owner | Notes |
|--------|-------|-----------------|-------|
| `src/Bytex.Indicators` | REQUIRES_REWRITE | `packages/platform/src/helios/feature-fabric`, `packages/strategy-lab` | Pure indicator math; TS reimplementation + parity fixtures (OS06) |
| `src/Bytex.Backtest` | REFERENCE_ONLY | `packages/strategy-lab` | Event-driven backtest semantics; do not embed C# runtime |
| `src/Bytex.Data` | REFERENCE_ONLY | `packages/external-data` | Bar/tick models for simulation adapters |
| `src/Bytex.Core` (models, events) | REFERENCE_ONLY | `packages/platform/src/helios/multi-asset` | Order/position types inform tests only; not SunRey ledger orders |
| `src/Bytex.Documents` | REFERENCE_ONLY | `packages/strategy-lab` | Strategy document validation patterns |
| `docs/concepts`, `docs/design` | REFERENCE_ONLY | `docs/helios/open-source/BYTEX_HELIOS_INTEGRATION_MAP.md` | Design reference |
| `src/Bytex.Cli` | DO_NOT_PORT | — | Key management and live control |
| `src/Bytex.Live` | DO_NOT_PORT | — | Live trading node |
| `src/Bytex.Adapters.*` | DO_NOT_PORT | — | Exchange execution + API secrets |
| `src/Bytex.Persistence.*` | IRRELEVANT_TO_HELIOS | `packages/persistence` (SunRey) | Separate persistence plane; S3 SigV4 not customer custody |
| `tests/**` | REFERENCE_ONLY | Strategy Lab / feature fabric tests | Harness ideas only |
| `bench/**` | IRRELEVANT_TO_HELIOS | — | Upstream perf benches |

---

## OpenChart

| Module | Class | Canonical owner | Notes |
|--------|-------|-----------------|-------|
| `server/indicators/**` | REQUIRES_REWRITE | `packages/platform/src/helios/feature-fabric` | OS05 indicator audit |
| `server/feed/**`, `server/data/providers/local/**` | REQUIRES_REWRITE | HELIOS market state / M04 | Simulation-only data planes |
| `server/alert/**` | REQUIRES_REWRITE | `packages/platform/src/helios/open-source` monitor map | Alert geometry, not OpenChart server |
| `server/tea/**`, `common/chart-core/**` | REFERENCE_ONLY | Strategy Lab / chart UX docs | TEA authoring reference |
| `common/**` (shared types) | REFERENCE_ONLY | Feature fabric | Types and math helpers |
| `docs/architecture/**` | REFERENCE_ONLY | `docs/helios/open-source/OPENCHART_HELIOS_MONITOR_MAP.md` | Architecture map only |
| `server/access/**` | DO_NOT_PORT | `packages/security`, `packages/identity` | API keys, OAuth, billing — use SunRey envelope |
| `server/index.ts`, `server/runtime.ts` | DO_NOT_PORT | — | Full product server |
| `platform/desktop/**`, `app/**` | DO_NOT_PORT | — | Electron/desktop shell |
| `server/agent/**`, `common/models/**` | DO_NOT_PORT | `packages/ai-runtime`, `packages/sunrey-agent` | Rebuild with mandate-bound inference |
| `server/models/onboarding/**` | DO_NOT_PORT | — | Network downloader for third-party CLIs |
| `server/collection/**` | DO_NOT_PORT | — | Subprocess Python execution |
| `demo/**`, `scripts/**` | IRRELEVANT_TO_HELIOS | — | Marketing/docs tooling |

---

## TradingAgents

| Module | Class | Canonical owner | Notes |
|--------|-------|-----------------|-------|
| `tradingagents/graph/**` | REFERENCE_ONLY | `packages/agentic-capital-mesh`, OS11 | Role topology → adversarial research |
| `tradingagents/agents/analysts/**` | REFERENCE_ONLY | OS11 participants | Prompt/tool patterns |
| `tradingagents/agents/risk_mgmt/**` | REFERENCE_ONLY | OS11 rebuttal/calibration | Debate structure |
| `tradingagents/agents/managers/research_manager.py` | REFERENCE_ONLY | Agent mesh | Investment plan text |
| `tradingagents/agents/trader/**` | DO_NOT_PORT | ProposalGate only | Emits trade proposals — never wire to execution |
| `tradingagents/agents/managers/portfolio_manager.py` | DO_NOT_PORT | — | Final trade decision text |
| `tradingagents/dataflows/**` | REQUIRES_REWRITE | `packages/external-data` | Simulation fixtures + certification (OS08); no live keys |
| `tradingagents/llm_clients/**` | REQUIRES_REWRITE | `packages/ai-runtime` | Mandate-scoped inference |
| `tradingagents/memory/**` | REFERENCE_ONLY | Agent mesh / evidence | Memory layout ideas |
| `cli/**`, `assets/cli/**` | DO_NOT_PORT | — | Runs upstream graph |
| `tests/**` | REFERENCE_ONLY | HELIOS OS tests | Behavioral fixtures |

---

## Seris

| Module | Class | Canonical owner | Notes |
|--------|-------|-----------------|-------|
| `apps/core` (strategy/backtest flows) | REFERENCE_ONLY | `packages/strategy-lab` | OS09 workflow alignment |
| `apps/core` (composer/chat protocol) | REFERENCE_ONLY | `packages/sunrey-agent` | OS10 mandate context |
| `apps/core/src/markets/**` | REFERENCE_ONLY | HELIOS multi-asset market state | Search UX patterns |
| `apps/desktop-ui/**` | IRRELEVANT_TO_HELIOS | — | Seris product UI |
| `apps/core/src/runtime/credentials.js` | DO_NOT_PORT | `packages/security` | Use SunRey secret references |
| `apps/desktop/**`, Tauri | DO_NOT_PORT | — | OS keychain pipe |
| `apps/core/src/tools/exec.ts`, `process.ts` | DO_NOT_PORT | — | Shell execution |
| `apps/core/src/gateway/**` | DO_NOT_PORT | `services/api` | SunRey Platform API is canonical HTTP |

---

## Polymarket Prediction Bot

| Module | Class | Canonical owner | Notes |
|--------|-------|-----------------|-------|
| `polymarket_bot/core/strategy.py`, `models.py` | DO_NOT_PORT | OS14 fixtures | Entrypoints contaminated by `support/` hook |
| `polymarket_bot/tui/**` | DO_NOT_PORT | — | Terminal product |
| `polymarket_bot/config.py` | DO_NOT_PORT | — | Private key / API secret fields |
| `support/**` | DO_NOT_PORT | — | **RCE / supply-chain** — see security audit |
| `support/data/release.pkg` | DO_NOT_PORT | — | Embedded binary archive |
| `main.py`, `polymarket_bot/__main__.py` | DO_NOT_PORT | — | Calls `engage()` / `assume_runtime()` |
| Prediction market research (concept) | REQUIRES_REWRITE | `packages/platform/src/helios/open-source/os14-prediction-market` | Canonical simulation-only OS14 |

---

## Cross-cutting HELIOS routing (canonical)

| Capability | Owner |
|------------|-------|
| Feature / indicator computation | `packages/platform/src/helios/feature-fabric` |
| Strategy Lab / backtest promotion | `packages/strategy-lab` |
| Adversarial multi-agent research | `packages/platform/src/helios/open-source/os11-adversarial-research` |
| Prediction market research | `packages/platform/src/helios/open-source/os14-prediction-market` |
| External market data (simulation) | `packages/external-data` |
| LLM inference | `packages/ai-runtime` |
| User agent mandates | `packages/sunrey-agent` |
| Execution / ledger | `services/accounts`, `packages/kernel`, `packages/ledger` — **never** upstream bots |

See also [`docs/helios/open-source/CANONICAL_OWNER_MAP.md`](../open-source/CANONICAL_OWNER_MAP.md).
