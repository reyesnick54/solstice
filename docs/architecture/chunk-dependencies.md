# Chunk and capability dependencies

Build chunks declare the capabilities they need. The architecture
tooling answers whether each required capability is:

- `IMPLEMENTED` — present on `main` with a canonical owner
- `PARTIAL` — reserved owner exists; the capability is incomplete
- `PLANNED` — reserved in the manifest; not implemented
- `ABSENT` — not in the manifest at all

## Rule

If a task requires a **protected** dependency that is not
`IMPLEMENTED` on `main`, the agent must **stop** rather than
independently reimplementing the missing subsystem.

That rule exists so a later-phase agent cannot decide:

> Phase 8 is absent, so I will create my own Phase 8.

Absence is not permission to fork. The agent updates nothing, invents
no second Kernel / ledger / Money / Evidence Vault / ActionIntent /
account-class taxonomy, and reports the missing capability.

## How to declare a chunk

Add a JSON file under `docs/architecture/chunks/`:

```json
{
  "chunk": "CHUNK-9",
  "title": "Example later chunk",
  "requires": ["persistence", "identity", "policy-engine"]
}
```

`requires` entries are capability ids from
[`manifest.json`](./manifest.json) `capabilities`.

The architectural linter loads every `docs/architecture/chunks/*.json`
file and records each requirement's status. Declaring a future chunk
that requires a `PLANNED` capability does **not** fail CI. Implementing
a competing owner for an already-protected capability does.

## Evaluator

`evaluateChunkRequirements(manifest, requires)` in
`tools/architectural-linter` returns per-capability status and
`mustStop: true` when any **protected** requirement is not
`IMPLEMENTED`.

Agents and later CI jobs use that result. They do not guess.

## Current capabilities

| Capability | Status | Owner |
| --- | --- | --- |
| money | IMPLEMENTED | packages/money |
| domain | IMPLEMENTED | packages/domain |
| permissions | IMPLEMENTED | packages/permissions |
| kernel | IMPLEMENTED | packages/kernel |
| ledger | IMPLEMENTED | packages/ledger |
| evidence | IMPLEMENTED | packages/evidence |
| events | IMPLEMENTED | packages/events |
| event-fabric | IMPLEMENTED | packages/events |
| config | IMPLEMENTED | packages/config |
| accounts-service | IMPLEMENTED | services/accounts |
| architecture-linting | IMPLEMENTED | tools/architectural-linter |
| persistence | IMPLEMENTED | packages/persistence |
| security | IMPLEMENTED | packages/security |
| identity | IMPLEMENTED | packages/identity |
| policy-engine | IMPLEMENTED | packages/kernel |
| banking-core | IMPLEMENTED | services/accounts |
| compliance-screening | IMPLEMENTED | packages/kernel |
| payments | IMPLEMENTED | packages/payments |
| fx | IMPLEMENTED | packages/payments |
| rail-adapters | IMPLEMENTED | packages/payments |
| cards | IMPLEMENTED | packages/cards |
| personal-economic-graph | IMPLEMENTED | packages/personal-economic-graph |
| personal-economy-agent | IMPLEMENTED | packages/agent |
| growth-orchestrator | IMPLEMENTED | packages/platform |
| personal-economic-value-engine | IMPLEMENTED | packages/platform |
| treasury | IMPLEMENTED | packages/treasury |
| investments | IMPLEMENTED | packages/investments |
| regulatory-digital-twin | IMPLEMENTED | packages/regulatory-twin |
| personal-data-vault | IMPLEMENTED | packages/personal-data-vault |
| risk | IMPLEMENTED | packages/risk |
| model-registry | IMPLEMENTED | packages/model-registry |
| agentic-capital-mesh | IMPLEMENTED | packages/agentic-capital-mesh |
| strategy-lab | IMPLEMENTED | packages/strategy-lab |
| consent | IMPLEMENTED | packages/consent |
| purpose-firewall | IMPLEMENTED | packages/consent |
| clean-room | IMPLEMENTED | packages/clean-room |
| sunrey-coin | PLANNED | packages/sunrey-coin |
| sunrey-exchange | PLANNED | packages/sunrey-exchange |
| sunrey-chain | PLANNED | packages/sunrey-chain |
| custody | PLANNED | packages/custody |
| market-surveillance | PLANNED | packages/market-surveillance |

Chunk 6 implements the policy engine inside `packages/kernel`. It does
not reimplement identity. Customer KYC status and residency remain the
identity facts the engine consumes.

Chunk 7 owns screening, AML, fraud, velocity, and cases inside
`packages/kernel/src/compliance`. It does not create `packages/compliance`
or a second Kernel. Simulation adapters only.

Chunk 12 (mobile wallet provisioning and merchant Tap-to-Pay / SoftPOS)
initially stopped because the protected `cards` capability was
`PLANNED`. Cards is now `IMPLEMENTED`. Chunk 12 was subsequently
resumed inside `packages/cards` / `services/cards`. The evaluator
returns `mustStop: false`. Historical stop:
[`chunk-12-stop.md`](./chunk-12-stop.md). Resume:
[`chunk-12-resume.md`](./chunk-12-resume.md). Do not invent a second
cards domain.

Chunk 13 (treasury / liquidity / routing intelligence) initially
stopped on a process gate while Chunk 12 was not yet genuinely
implemented and `main` CI was red. That stop is historical:
[`chunk-13-stop.md`](./chunk-13-stop.md). Chunk 13 is now resumed at
the reserved owners `packages/treasury` and `services/treasury`.
Capability `treasury` is `IMPLEMENTED`. Bounded context TREASURY is
`PARTIAL` simulation. Resume:
[`chunk-13-resume.md`](./chunk-13-resume.md). Do not create
`packages/liquidity`, `packages/routing-intelligence`,
`packages/treasury-core`, or `packages/settlement-risk`.

Chunk 14 implements the Personal Economic Graph as the first SFF 2.0
intelligence layer. It does not start the Personal Economy Agent.
The evaluator returns `mustStop: false`.

Chunk 15 (Personal Economy Agent) originally stopped while `treasury`
was `PLANNED` and `main` CI was red. That stop is historical:
[`chunk-15-stop.md`](./chunk-15-stop.md). Treasury is now
`IMPLEMENTED`. The Personal Economy Agent lives at `packages/agent`
as a proposal-only interpreter. The evaluator returns
`mustStop: false`.

Chunk 16 implements machine-verifiable economic mandates and the
Growth Orchestrator at `packages/platform`. It does not execute
investments and does not start the Personal Economic Value Engine.

Chunk 17 implements the Personal Economic Value Engine at
`packages/platform/src/value`. It extends platform ownership rather
than creating `packages/value-engine`. Capability
`personal-economic-value-engine` is `IMPLEMENTED`. It does not start
the Regulatory Digital Twin. The evaluator returns `mustStop: false`.

Chunk 18 implements the Regulatory Digital Twin at
`packages/regulatory-twin`. It reuses the existing policy engine and
Kernel. It does not issue Execution Authority, post journals, or
activate candidate packs. Capability `regulatory-digital-twin` is
`IMPLEMENTED`. The evaluator returns `mustStop: false`.

Chunk 19 implements the reserved INVESTMENTS bounded context at
`packages/investments` and `services/investments`. Capability
`investments` is `IMPLEMENTED`. Bounded context INVESTMENTS is
`PARTIAL` simulation: paper orders, positions, lots, valuation, and
reconciliation only. No live broker. Pre-trade Risk is required.
Do not create `packages/brokerage`, `packages/portfolio`,
`packages/trading`, `packages/wealth`, or `packages/securities-core`.

Chunk 22R implements the reserved STRATEGY LAB bounded context at
`packages/strategy-lab` and `services/strategy-lab`. Capability
`strategy-lab` is `IMPLEMENTED`. Bounded context STRATEGY_LAB is
`PARTIAL` simulation: compile, backtest, walk-forward, shadow, and
Risk-gated paper only. No LIVE stage. The original Chunk 22 stop is
historical: [`chunk-22-stop.md`](./chunk-22-stop.md). Resume:
[`chunk-22-resume.md`](./chunk-22-resume.md). Do not create
`packages/backtest`, `packages/trading-lab`, `packages/quant`, or
`packages/strategy-v2`.
Chunk 20 implements the reserved RISK and MODEL_REGISTRY bounded
contexts at `packages/risk` and `packages/model-registry`. Capability
`risk` and `model-registry` are `IMPLEMENTED`. Risk supplies
deterministic paper-portfolio facts to the existing Kernel Risk proof.
It does not issue Execution Authority or post journals. Model Registry
is simulation-approval only; there is no `LIVE_APPROVED`. Do not create
`packages/investment-risk`, `packages/risk-v2`,
`packages/portfolio-risk`, `packages/models`, or
`packages/model-governance-v2`. The evaluator returns `mustStop: false`.

Chunk 21 (Agentic Capital Mesh) originally stopped while `risk` and
`model-registry` were `PLANNED`. That stop is historical:
[`chunk-21-stop.md`](./chunk-21-stop.md). Chunk 21R implements the
reserved owner `packages/agentic-capital-mesh`. Capability
`agentic-capital-mesh` is `IMPLEMENTED`. The evaluator returns
`mustStop: false`. Resume: [`chunk-21-resume.md`](./chunk-21-resume.md).
Do not create `trading-agents` / `investment-agents` / `hedge-agent` /
`capital-ai` / `autonomous-trader`.

Chunk 22 (Strategy Lab) historically stopped while Risk, Model Registry,
and Agentic Capital Mesh were absent. That stop is historical:
[`chunk-22-stop.md`](./chunk-22-stop.md). Chunk 22R implements the
reserved owners `packages/strategy-lab` and `services/strategy-lab`.
Capability `strategy-lab` is `IMPLEMENTED`. Bounded context
`STRATEGY_LAB` is `PARTIAL` (no LIVE stage). Resume:
reserved owners. Capability `strategy-lab` is `IMPLEMENTED`. Bounded
context `STRATEGY_LAB` is `PARTIAL` (no LIVE stage). The evaluator
returns `mustStop: false`. Do not create `packages/backtest`,
`packages/trading-lab`, `packages/quant`, or `packages/strategy-v2`.

Chunk 25R implements the reserved CLEAN_ROOM bounded context at
`packages/clean-room`. Capability `clean-room` is `IMPLEMENTED`.
Consent Ledger and Purpose Firewall are prerequisites and are
`IMPLEMENTED`. The original Chunk 25 stop is historical:
[`chunk-25-stop.md`](./chunk-25-stop.md). Resume:
[`chunk-25-resume.md`](./chunk-25-resume.md). The evaluator returns
`mustStop: false`. Do not create `packages/privacy-compute`,
`packages/data-clean-room`, `packages/secure-data-room`,
`packages/research-room`, or `packages/clean-room-v2`.
Chunk 22R implements the reserved STRATEGY LAB bounded context at
`packages/strategy-lab` and `services/strategy-lab`. Capability
`strategy-lab` is `IMPLEMENTED`. Bounded context STRATEGY_LAB is
`PARTIAL` simulation: compile, backtest, walk-forward, shadow, and
Risk-gated paper only. No LIVE stage. The original Chunk 22 stop is
historical: [`chunk-22-stop.md`](./chunk-22-stop.md). Resume:
[`chunk-22-resume.md`](./chunk-22-resume.md). Do not create
`packages/backtest`, `packages/trading-lab`, `packages/quant`, or
`packages/strategy-v2`.

Chunk 23 implements the reserved PERSONAL_DATA_VAULT bounded context
at `packages/personal-data-vault`. Capability `personal-data-vault`
is `IMPLEMENTED`. It does not implement Consent Ledger, Purpose
Firewall, Clean Room, marketplace, or Reyn Coin. The evaluator
returns `mustStop: false` for the implemented prerequisites.

Chunk 26 (SunRey Coin economic ledger) remains **unbuilt**. Consent,
Purpose Firewall, and Privacy Clean Room are now `IMPLEMENTED`, so
the evaluator returns `mustStop: false` for those prerequisites. Do
not implement SunRey Coin, a second ledger, SunRey Exchange, or a
public ticker from Chunk 26. Historical `PYRAMID` / `REYN_COIN`
reservations are now `SUNREY_COIN` at `packages/sunrey-coin`.
Historical `PYRAMID_EXCHANGE` / `REYN_EXCHANGE` reservations are now
`SUNREY_EXCHANGE` at `packages/sunrey-exchange`. See
[`chunk-26-stop.md`](./chunk-26-stop.md). Do not create
`packages/reyn-ledger`, `packages/token-ledger`,
`packages/crypto-ledger-v2`, or invent a public ticker.

Chunk 30 (SunRey Exchange control plane) is **stopped**. The task
requires starting only after Chunk 29 is merged. Exchange core is
absent. Protected capabilities `sunrey-coin`, `sunrey-exchange`,
`sunrey-chain`, `custody`, and `market-surveillance` remain
`PLANNED`. The evaluator returns `mustStop: true` and
`missing: ['sunrey-coin', 'sunrey-exchange', 'sunrey-chain',
'custody', 'market-surveillance']`. Historical stop:
[`chunk-30-stop.md`](./chunk-30-stop.md). Do not create
`packages/exchange-compliance-v2`, `packages/travel-rule-v2`,
`packages/crypto-aml`, `packages/surveillance-v2`, or
`packages/custody-ledger`.

Chunk 24 implements the reserved CONSENT bounded context at
`packages/consent`. Capability `consent` is `IMPLEMENTED`. It
replaces the Personal Data Vault fail-closed consent placeholder
with a Purpose Firewall and short-lived DataUsePermits. Clean Room
is owned by Chunk 25R. The evaluator returns `mustStop: false`.
