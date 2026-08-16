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
| custody | IMPLEMENTED | packages/custody |
| market-surveillance | IMPLEMENTED | packages/market-surveillance |
| sunrey-coin | IMPLEMENTED | packages/sunrey-coin |
| information-market | IMPLEMENTED | packages/information-market |
| sunrey-chain | IMPLEMENTED | packages/sunrey-chain |
| sunrey-blockchain-architecture | IMPLEMENTED | packages/sunrey-chain |
| moonrey-coin | PLANNED | none |
| sunrey-exchange | IMPLEMENTED | packages/sunrey-exchange |
| sunrey-local-node | IMPLEMENTED | packages/sunrey-chain |
| sunrey-p2p | IMPLEMENTED | packages/sunrey-chain |
| sunrey-validators | IMPLEMENTED | packages/sunrey-chain |
| sunrey-validator-accountability | IMPLEMENTED | packages/sunrey-chain |

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

Chunk 26R implements the reserved SUNREY_COIN bounded context at
`packages/sunrey-coin`. Capability `sunrey-coin` is `IMPLEMENTED`.
Bounded context SUNREY_COIN is `IMPLEMENTED` simulation. The original
Chunk 26 stop is historical: [`chunk-26-stop.md`](./chunk-26-stop.md).
Resume: [`chunk-26-resume.md`](./chunk-26-resume.md). Historical
`PYRAMID` / `REYN_COIN` and `PYRAMID_EXCHANGE` / `REYN_EXCHANGE`
reservations are now `SUNREY_COIN`, `SUNREY_EXCHANGE`, and
`SUNREY_CHAIN`. Do not create `packages/reyn-coin`,
`packages/sunrey-ledger`, `packages/reyn-ledger`,
`packages/token-ledger`, `packages/crypto-ledger-v2`, or invent a
public ticker.

Chunk 27 implements the reserved SUNREY_INFORMATION_MARKET bounded
context at `packages/information-market`. Capability
`information-market` is `IMPLEMENTED`. Historical reservation
`PYRAMID_DATA_EXCHANGE` is migrated here. Public brand is SunRey
Exchange. Personal Oracle is a module in this package. Do not
create `packages/pyramid-data-exchange`, `packages/data-exchange`,
`packages/sunrey-data-exchange`, `packages/personal-oracle`,
`packages/information-market-v2`, or `packages/proof-of-contribution`.

Chunk 28 implements the reserved SUNREY_CHAIN bounded context at
`packages/sunrey-chain`. Capability `sunrey-chain` is `IMPLEMENTED`.
Bounded context SUNREY_CHAIN is `IMPLEMENTED` simulation. The chain
is not the financial source of truth. Do not create
`packages/sunrey-chain-v2`, `packages/blockchain`,
`packages/reyn-chain`, `packages/on-chain-ledger`, or
`packages/crypto-chain`. Do not invent a ticker. Do not connect a
live RPC, mainnet, or testnet. The evaluator returns `mustStop: false`.

Chunk 29 implements the reserved SUNREY_EXCHANGE bounded context at
`packages/sunrey-exchange`. Capability `sunrey-exchange` is
`IMPLEMENTED`. Simulation matching and DVP settlement only. Do not
create `packages/exchange-v2`, `packages/orderbook`,
`packages/matching-engine-v2`, `packages/crypto-exchange`, or
`packages/reyn-exchange`. Do not invent a ticker. Do not enable
`LIVE_EXCHANGE_ENABLED`. The evaluator returns `mustStop: false`.

Chunk 30R implements the reserved CUSTODY and MARKET_SURVEILLANCE
bounded contexts at `packages/custody` and
`packages/market-surveillance`. Capabilities `custody` and
`market-surveillance` are `IMPLEMENTED`. The original Chunk 30 stop
is historical: [`chunk-30-stop.md`](./chunk-30-stop.md). Resume:
[`chunk-30-resume.md`](./chunk-30-resume.md). The evaluator returns
`mustStop: false`. Do not create `packages/exchange-compliance-v2`,
`packages/travel-rule-v2`, `packages/crypto-aml`,
`packages/surveillance-v2`, or `packages/custody-ledger`.

Chunk 35R implements the P2P development network, mempool, and
state sync at `packages/sunrey-chain/node` after Chunk 34R.
Capabilities `sunrey-local-node` and `sunrey-p2p` are `IMPLEMENTED`.
`evaluateChunkRequirements` returns `mustStop: false`. Historical
stop: [`chunk-35-stop.md`](./chunk-35-stop.md). Resume:
[`chunk-35-resume.md`](./chunk-35-resume.md). Do not create
`packages/sunrey-node`, `packages/sunrey-p2p`, `packages/p2p`,
`packages/libp2p`, `packages/mempool`, `packages/devnet`,
`packages/gossip`, `packages/consensus`, or
`packages/sunrey-consensus`. Chunk 36R/39 implements the development
validator control plane and accountability at
`packages/sunrey-chain/node`. Historical stop:
[`chunk-36-stop.md`](./chunk-36-stop.md). Resume:
[`chunk-36-resume.md`](./chunk-36-resume.md). Accountability:
[`chunk-39-validator-accountability.md`](./chunk-39-validator-accountability.md).
Do not create `packages/validators`, `packages/staking`, or
`packages/validator-v2`.
Chunk 34R implements the local deterministic node at
`packages/sunrey-chain/rust` after Chunks 31, 32R, and 33R.
Capability `sunrey-local-node` is `IMPLEMENTED`. The original
documentation-only stop is historical:
[`chunk-34-stop.md`](./chunk-34-stop.md). Resume:
[`chunk-34-resume.md`](./chunk-34-resume.md). Do not create
`packages/sunrey-blockchain`, `packages/sunrey-node`,
`packages/blockchain-v2`, `packages/new-chain`, `packages/l1`,
`packages/ledger-chain`, or `packages/web3-chain`. Do not replace
`packages/sunrey-chain`. Production BFT remains unimplemented.
Chunk 31 freezes the SunRey Blockchain production architecture at
the existing owner `packages/sunrey-chain`. Capability
`sunrey-blockchain-architecture` is `IMPLEMENTED` (specification
only). Production node capabilities `blockchain-node`,
`blockchain-consensus`, and `blockchain-runtime` remain `PLANNED`
internal modules. MoonRey Coin remains `PLANNED` and distinct.
The evaluator returns `mustStop: false` for CHUNK-31. Do not
create `packages/blockchain-node`, `packages/sunrey-blockchain`,
or `packages/moonrey-coin`. Do not start Chunk 32 in the Chunk 31
change set.

Chunk 24 implements the reserved CONSENT bounded context at
`packages/consent`. Capability `consent` is `IMPLEMENTED`. It
replaces the Personal Data Vault fail-closed consent placeholder
with a Purpose Firewall and short-lived DataUsePermits. Clean Room
is owned by Chunk 25R. The evaluator returns `mustStop: false`.

Chunk 33R implements SunRey crypto-agility and the post-quantum
foundation at `packages/security` (CryptoSuite registry, Ed25519,
PQ ports, hybrid envelope, policy) and validator key separation
at `packages/sunrey-chain`. Capability `crypto-suite-registry` is
`IMPLEMENTED`. The original stop is historical:
[`chunk-33-stop.md`](./chunk-33-stop.md). Resume:
[`chunk-33-crypto-agility.md`](./chunk-33-crypto-agility.md).
The evaluator returns `mustStop: false`. Do not create
`packages/quantum-security`, `packages/crypto-v2`, or
`packages/pqc-core`. Do not claim quantum-proof cryptography.
Chunk 32R implements the canonical SunRey transaction and
economic-state protocol at `packages/sunrey-chain`. Capability
`blockchain-protocol` is `IMPLEMENTED`. Historical stop:
[`chunk-32-stop.md`](./chunk-32-stop.md). Resume:
[`chunk-32-resume.md`](./chunk-32-resume.md). Do not create
`packages/sunrey-chain-v2`, `packages/sunrey-protocol`,
`packages/sunrey-tx`, `packages/moonrey`, or `packages/moonrey-coin`.
MoonRey issuance remains unavailable. Public tickers remain
`NOT_ASSIGNED`.
