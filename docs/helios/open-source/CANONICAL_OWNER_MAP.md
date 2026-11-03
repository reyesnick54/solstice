# HELIOS canonical owner map — open-source capability routing (OS00)

Maps upstream **concepts** to existing Solstice owners. External repositories never become owners of financial or observation authority.

Authority baseline: [`docs/helios/helios-authority-matrix.json`](../helios-authority-matrix.json)

---

## Routing table

| Upstream concept | Example upstream location | Canonical Solstice owner | Integration mode |
|------------------|---------------------------|--------------------------|------------------|
| Market event ingestion | BYTEX `Bytex.Data`, OpenChart `server/feed` | `packages/platform/src/helios/observation` (H08) | Extend observation envelopes; no second fabric |
| Feature / study computation | OpenChart `server/indicators`, BYTEX `Bytex.Indicators` | `packages/platform/src/helios/feature-fabric` (AAF02) | Native TS port or licensed snippet |
| Point-in-time joins | AAF04 compiler (in-flight on AAF branch) | `packages/platform/src/helios/feature-fabric/compiler` | Upstream informs tests only |
| External equities/crypto planes | AAF08/AAF09 (AAF branch) | `packages/platform/src/helios/adaptive-alpha-fabric/*` | Fixture adapters via `packages/external-data` |
| Market-data provider certification | AAF07 | `packages/external-data/src/certification/market-data` | Align BYTEX/OpenChart data sources to certification harness |
| Multi-agent research debate | TradingAgents `tradingagents/graph` | `packages/agentic-capital-mesh` | Proposals to ProposalGate; no EA |
| LLM vendor calls | TradingAgents `llm_clients`, Seris core gateway | `packages/ai-runtime` | Mandate-bound inference; `financialExecuted=false` |
| User agent mandates | Seris chat context | `packages/sunrey-agent` | Narrow tokens; no ledger import |
| Backtest / shadow / paper | BYTEX Backtest, Seris core backtest | `packages/strategy-lab` | Single qualification owner |
| Strategy promotion | HELIOS H18 | `packages/strategy-lab` + `packages/platform/src/helios/strategy-capsule` | No Strategy Genome fork |
| Opportunity ranking | HELIOS M16 | `packages/platform/src/helios/intelligence/m16-opportunity-ranking` | TradingAgents “decision” is research input only |
| Meta allocation / sizing | TradingAgents portfolio discussion | `packages/platform/src/helios/meta-allocator` | No second allocator |
| Pre-trade risk | BYTEX pre-trade limits, Polymarket exposure caps | `packages/risk` | Feed limits as simulation inputs |
| Compliance decision | — (forbidden upstream) | `packages/kernel` | Never import upstream “compliance” |
| Order execution | BYTEX live, Polymarket live | `packages/investments` + Kernel `ActionIntent` | Block all upstream execution entrypoints |
| Ledger balances | — | `packages/ledger` via `services/accounts` | No upstream balance store |
| Exchange matching/settlement | — | `packages/sunrey-exchange` | BYTEX venues ≠ SunRey Exchange |
| Evidence / audit | — | `packages/evidence` | Seal upstream integration decisions in vault |
| Prediction market CLOB | Polymarket bot `core` | `packages/external-data` (fixtures) + multi-asset M01 instrument registry | Observation-only first |
| Chart/alert UX | OpenChart alerts, Seris UI | `services/api` consumer BFF | Presentation; not trading authority |
| Provider catalog | TradingAgents dataflows | `packages/external-data`, `config/providers/*` | Simulation catalog entries |
| Trust scoring | OpenChart data provenance (implicit) | `packages/provider-sdk/src/trust/engine.ts` | No parallel trust engine |

---

## Explicit non-owners (do not create)

From AAF01 gap register and constitution:

- `packages/helios-observation`, `packages/helios-feature-fabric-v2`
- `packages/strategy-lab-v2`, `packages/trading-engine`, `packages/bytex-*`
- `packages/trading-agents-runtime` with Kernel or ledger imports
- `packages/polymarket-executor` or any live CLOB writer

---

## Package boundary rules for ports

1. **Library packages must not import services** — ported code lands in `packages/*`, not `services/*` mutators.
2. **Domain code must not perform network I/O** — network stays in `packages/external-data` fixture clients.
3. **Agent packages must not import Execution Authority** — see Personal Economy Agent isolation in `AGENTS.md`.
4. **Strategy Lab cannot set VALIDATED without qualification harness** — upstream backtest success is not SunRey validation.

---

## AAF integration base (blocked)

Until `aaf01-current-state-truth-map` (PR #581) is CI/typecheck/HELIOS RC green:

- Owner map entries for AAF08/AAF09/AAF10 remain **documentation of intent** on `main`.
- Open-source ports that touch feature-fabric or adaptive-alpha-fabric must **rebase onto the recovered AAF branch**, not `main` alone.

---

## Quick reference — five upstream projects

| Project | Primary owner(s) in Solstice | Never assign to |
|---------|------------------------------|-----------------|
| BYTEX | `strategy-lab`, `external-data` | Exchange, ledger, live adapters |
| OpenChart | `feature-fabric`, `observation`, BFF | Standalone chart server as authority |
| TradingAgents | `agentic-capital-mesh`, `ai-runtime`, `external-data` | Kernel, trader execution |
| Seris | `strategy-lab`, `sunrey-agent` | Custody, desktop keychain |
| Polymarket bot | `external-data`, `strategy-lab` (shadow) | Wallet keys, live CLOB |

See full per-repo analysis in [UPSTREAM_INTEGRATION_MANIFEST.md](./UPSTREAM_INTEGRATION_MANIFEST.md).
