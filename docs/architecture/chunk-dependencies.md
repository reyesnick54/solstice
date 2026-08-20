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
| sunrey-banking-payment-provider-candidates | IMPLEMENTED | packages/payments |
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
| sunrey-validator-economics | IMPLEMENTED | packages/sunrey-chain |
| sunrey-protocol-governance | IMPLEMENTED | packages/sunrey-chain |
| sunrey-machine-economy | IMPLEMENTED | packages/sunrey-chain |
| sunrey-productive-capacity | IMPLEMENTED | packages/sunrey-chain |
| moonrey-issuance-engine | IMPLEMENTED | packages/sunrey-chain |
| sunrey-oracle-network | IMPLEMENTED | packages/sunrey-chain |
| sunrey-native-assets | IMPLEMENTED | packages/sunrey-chain |
| sunrey-native-fees | IMPLEMENTED | packages/sunrey-chain |
| sunrey-adaptive-fee-market | IMPLEMENTED | packages/sunrey-chain |
| sunrey-interop | IMPLEMENTED | packages/sunrey-chain |
| sunrey-exchange-native-settlement | IMPLEMENTED | packages/sunrey-exchange |
| sunrey-institutional-custody | IMPLEMENTED | packages/custody |
| sunrey-sovereign-wallets | IMPLEMENTED | packages/sunrey-chain |
| sunrey-validator-operations | IMPLEMENTED | packages/sunrey-chain |
| sunrey-public-testnet | IMPLEMENTED | packages/sunrey-chain |
| sunrey-explorer | IMPLEMENTED | packages/sunrey-explorer |
| sunrey-developer-sdk | IMPLEMENTED | packages/sunrey-sdk |
| sunrey-developer-platform | IMPLEMENTED | packages/sunrey-sdk |
| sunrey-supply-chain | IMPLEMENTED | packages/sunrey-chain |
| sunrey-adversarial-range | IMPLEMENTED | packages/sunrey-range |
| sunrey-assurance | IMPLEMENTED | packages/sunrey-chain |
| sunrey-performance-engineering | IMPLEMENTED | packages/sunrey-chain |
| sunrey-pqc-testnet | IMPLEMENTED | packages/security |
| sunrey-ops-resilience | IMPLEMENTED | packages/sunrey-chain |
| sunrey-mainnet-readiness | IMPLEMENTED | packages/sunrey-chain |
| sunrey-ops-resilience | IMPLEMENTED | packages/sunrey-chain |
| sunrey-pqc-testnet | IMPLEMENTED | packages/security |
| sunrey-audit-readiness | IMPLEMENTED | packages/sunrey-chain |
| sunrey-audit-remediation | IMPLEMENTED | packages/sunrey-chain |
| sunrey-formal-assurance | IMPLEMENTED | packages/sunrey-chain |
| sunrey-regulated-integration | IMPLEMENTED | packages/sunrey-exchange |
| sunrey-production-oracles | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-storage | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-infrastructure | IMPLEMENTED | packages/sunrey-chain |
| sunrey-launch-rehearsal | IMPLEMENTED | packages/sunrey-chain |
| sunrey-dual-economy-simulator | IMPLEMENTED | packages/sunrey-economics |
| sunrey-economic-rc | IMPLEMENTED | packages/sunrey-chain |
| sunrey-mainnet-rc | IMPLEMENTED | packages/sunrey-chain |
| moonrey-policy-governance | IMPLEMENTED | packages/sunrey-chain |
| sunrey-economic-stress-lab | IMPLEMENTED | packages/sunrey-economics |
| sunrey-governance-operations | IMPLEMENTED | packages/sunrey-chain |
| sunrey-economic-mainnet-rehearsal | IMPLEMENTED | packages/sunrey-chain |
| sunrey-protocol-treasury | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-genesis-ceremony | IMPLEMENTED | packages/sunrey-chain |
| sunrey-post-genesis-stabilization | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-network-candidate | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-handoff | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-genesis-execution | IMPLEMENTED | packages/sunrey-chain |
| sunrey-pregenesis-qualification | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-provider-acceptance | IMPLEMENTED | packages/sunrey-chain |
| sunrey-provider-runtime | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-provisioning | IMPLEMENTED | packages/sunrey-chain |
| sunrey-exchange-market-operations | IMPLEMENTED | packages/sunrey-exchange |
| sunrey-public-data-plane | IMPLEMENTED | packages/sunrey-chain |
| sunrey-human-information-network | IMPLEMENTED | packages/information-market |
| sunrey-user-agent-mandates | IMPLEMENTED | packages/sunrey-agent |
| sunrey-mobile-wallet-sync | IMPLEMENTED | packages/sunrey-chain |
| sunrey-ai-runtime | IMPLEMENTED | packages/ai-runtime |
| sunrey-s3m-provider | IMPLEMENTED | packages/ai-runtime |
| sunrey-human-contribution-monetary-bridge | IMPLEMENTED | packages/sunrey-chain |
| sunrey-hin-contribution-integration | IMPLEMENTED | packages/information-market |
| sunrey-hin-chain-anchoring | IMPLEMENTED | packages/information-market |
| sunrey-human-economic-contributions | IMPLEMENTED | packages/human-economic-contribution |
| sunrey-economic-asset-registry | IMPLEMENTED | packages/economic-asset-registry |
| sunrey-economic-asset-verification | IMPLEMENTED | packages/economic-asset-registry |
| sunrey-human-contribution-valuation | IMPLEMENTED | packages/human-economic-contribution |
| sunrey-human-contribution-verification | IMPLEMENTED | packages/human-economic-contribution |
| sunrey-economic-unit-normalization | IMPLEMENTED | packages/sunrey-chain |
| moonrey-source-taxonomy | IMPLEMENTED | packages/sunrey-chain |
| moonrey-productive-value-function | IMPLEMENTED | packages/sunrey-chain |
| moonrey-productive-value-settlement | IMPLEMENTED | packages/sunrey-chain |
| moonrey-economic-event-attribution | IMPLEMENTED | packages/sunrey-chain |
| sunrey-provider-certification | IMPLEMENTED | packages/sunrey-chain |
| sunrey-economic-data-connector-runtime | IMPLEMENTED | packages/sunrey-chain |
| sunrey-logistics-storage-data-fabric | IMPLEMENTED | packages/sunrey-chain |
| sunrey-compute-ai-data-fabric | IMPLEMENTED | packages/sunrey-chain |
| moonrey-v2-shadow-economics | IMPLEMENTED | packages/sunrey-chain |
| sunrey-manufacturing-robotics-data-fabric | IMPLEMENTED | packages/sunrey-chain |
| sunrey-resource-extraction-data-fabric | IMPLEMENTED | packages/sunrey-chain |
| sunrey-agriculture-food-data-fabric | IMPLEMENTED | packages/sunrey-chain |
| sunrey-water-data-fabric | IMPLEMENTED | packages/sunrey-chain |
| sunrey-goods-services-data-fabric | IMPLEMENTED | packages/sunrey-chain |
| sunrey-bandwidth-network-data-fabric | IMPLEMENTED | packages/sunrey-chain |
| sunrey-real-estate-infrastructure-data-fabric | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-economic-activation-firewall | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-issuance-policy-candidate | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-economic-parameters | IMPLEMENTED | packages/sunrey-chain |
| sunrey-canonical-product-identity | IMPLEMENTED | packages/config |
| sunrey-operational-persistence-recovery | IMPLEMENTED | packages/persistence |
| sunrey-hin-chain-anchoring | PARTIAL | packages/information-market |
| sunrey-regulated-provider-candidates | IMPLEMENTED | packages/kernel |
| sunrey-production-provider-credential-plane | IMPLEMENTED | packages/security |
| sunrey-hin-chain-anchoring | IMPLEMENTED | packages/information-market |
| sunrey-unified-control-room | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-provider-binding | IMPLEMENTED | packages/sunrey-chain |

Chunk 111 implements engineering-simulation reference valuation at
`packages/human-economic-contribution/src/valuation`. It does not mint
and does not compute SunRey quantity. Chunk 112 extends the existing
human-contribution monetary bridge with settlement authorization from
that valuation result. Production remains unavailable. The evaluator
returns `mustStop: false`.

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
Chunk 100 adds `MANAGE_HUMAN_INFORMATION_PREFERENCES` as an explicit
mandate constraint. Generic financial-agent permission cannot manage
Human Information preferences.

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
`packages/sunrey-consensus`. Chunk 36R implements the validator
control plane. Capability `sunrey-validators` is `IMPLEMENTED`.
Historical stop: [`chunk-36-stop.md`](./chunk-36-stop.md). Resume:
[`chunk-36-resume.md`](./chunk-36-resume.md). Chunk 39 implements
simulation accountability. Capability
`sunrey-validator-accountability` is `IMPLEMENTED`. See
[`chunk-39-validator-accountability.md`](./chunk-39-validator-accountability.md).
Chunk 40 implements development protocol governance at
`packages/sunrey-chain`. Capability `sunrey-protocol-governance`
is `IMPLEMENTED`. See
[`chunk-40-protocol-governance.md`](./chunk-40-protocol-governance.md).
Chunk 45 implements machine economic identity and commerce at
`packages/sunrey-chain/src/machine-economy`. Capability
`sunrey-machine-economy` is `IMPLEMENTED`. See
[`chunk-45-machine-economy.md`](./chunk-45-machine-economy.md).
Do not create `packages/machine-economy` or a second exchange.
Chunk 43 implements the sovereign oracle network at
`packages/sunrey-chain`. Capability `sunrey-oracle-network` is
`IMPLEMENTED`. See
[`chunk-43-oracle-network.md`](./chunk-43-oracle-network.md).
Consensus never calls external systems. VerifiedEconomicFacts are
not money and do not authorize MoonRey issuance.
Do not create `packages/validators`, `packages/staking`, or
`packages/validator-v2`.
Chunk 41 implements dual native assets at
`packages/sunrey-chain`. Capability `sunrey-native-assets` is
`IMPLEMENTED`. See
[`chunk-41-dual-native-assets.md`](./chunk-41-dual-native-assets.md).
Chunk 42 implements native fees and resource metering at
`packages/sunrey-chain`. Capability `sunrey-native-fees` is
`IMPLEMENTED`. See
[`chunk-42-native-fees.md`](./chunk-42-native-fees.md).
Chunk 73 implements FeePolicyV2 adaptive resource pricing at
`packages/sunrey-chain/src/fees/v2`. Capability
`sunrey-adaptive-fee-market` is `IMPLEMENTED`. Historic v1 fee
semantics are preserved. Production parameters remain unconfigured.
See [`chunk-73-adaptive-fee-market.md`](./chunk-73-adaptive-fee-market.md).
Chunk 48 connects SunRey Exchange to native-chain atomic DVP at
`packages/sunrey-exchange` and `packages/sunrey-chain`. Capability
`sunrey-exchange-native-settlement` is `IMPLEMENTED`. See
[`chunk-48-exchange-native-settlement.md`](./chunk-48-exchange-native-settlement.md).
Do not create a second exchange ledger.
Do not create `packages/validators`, `packages/staking`,
`packages/validator-v2`, or `packages/moonrey-coin`.
Chunk 37 implements the development Tendermint-class BFT engine at
`packages/sunrey-chain/rust/crates/consensus`. Capability
`blockchain-consensus` is `IMPLEMENTED`.
`evaluateChunkRequirements` returns `mustStop: false` for CHUNK-37.
Do not create `packages/tendermint`, `packages/cometbft`,
`packages/consensus-engine`, `packages/bft`, or
`packages/blockchain-consensus`. Production consensus remains
unimplemented.
Chunk 34R implements the local deterministic node at
`packages/sunrey-chain/rust` after Chunks 31, 32R, and 33R.
Capability `sunrey-local-node` is `IMPLEMENTED`. The original
documentation-only stop is historical:
[`chunk-34-stop.md`](./chunk-34-stop.md). Resume:
[`chunk-34-resume.md`](./chunk-34-resume.md). Do not create
`packages/sunrey-blockchain`, `packages/sunrey-node`,
`packages/blockchain-v2`, `packages/new-chain`, `packages/l1`,
`packages/ledger-chain`, or `packages/web3-chain`. Do not replace
`packages/sunrey-chain`. Production mainnet BFT remains unimplemented.
Chunk 38 implements development networked BFT at
`packages/sunrey-chain/node`. Capability `blockchain-consensus`
is `IMPLEMENTED` for that development engine. See
[`chunk-38-networked-consensus.md`](./chunk-38-networked-consensus.md).
Chunk 31 freezes the SunRey Blockchain production architecture at
the existing owner `packages/sunrey-chain`. Capability
`sunrey-blockchain-architecture` is `IMPLEMENTED` (specification
only). Production node capabilities `blockchain-node` and
`blockchain-runtime` remain `PLANNED` internal modules.
`blockchain-consensus` is `IMPLEMENTED` as a development engine
(Chunks 37–38); production consensus remains unimplemented. MoonRey
Coin remains `PLANNED` and distinct.
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
Arbitrary `NATIVE_ASSET ISSUE` of MoonRey remains unavailable.
Public tickers remain `NOT_ASSIGNED`.
Chunk 44 implements the derived Global Productive Capacity Graph
and development MoonRey issuance from verified productive
contributions at `packages/sunrey-chain`. Capabilities
`sunrey-productive-capacity` and `moonrey-issuance-engine` are
`IMPLEMENTED`. See
[`chunk-44-productive-capacity-moonrey.md`](./chunk-44-productive-capacity-moonrey.md).
Do not create `packages/moonrey` or `packages/moonrey-coin`.
The public MoonRey Coin product (`moonrey-coin`) remains `PLANNED`.
Chunk 50 implements the development interoperability gateway at
`packages/sunrey-chain`. Capability `sunrey-interop` is
`IMPLEMENTED`. See
[`chunk-50-interoperability.md`](./chunk-50-interoperability.md).
Do not create `packages/ibc`, `packages/bridge`, or
`packages/interop`. Production interoperability remains unimplemented.
Chunk 49 implements the Universal Economic Exchange at the existing
owner `packages/sunrey-exchange`. Capability `sunrey-exchange` remains
`IMPLEMENTED`. Four market families: digital assets, human-information
rights, intelligence/compute, and productive capacity. See
[`chunk-49-universal-economic-exchange.md`](./chunk-49-universal-economic-exchange.md).
Do not create `packages/exchange-v2` or a second matching engine.
Chunk 47 implements institutional native-asset custody at
`packages/custody`. Capability `sunrey-institutional-custody` is
`IMPLEMENTED`. HSM/KMS contracts extend `packages/security`. The
native-chain port extends `packages/sunrey-chain`. See
[`chunk-47-institutional-custody.md`](./chunk-47-institutional-custody.md).
Do not create `packages/custody-v2`, `packages/blockchain-custody`,
`packages/institutional-custody-v2`, or `packages/hsm-security-v2`.
The evaluator returns `mustStop: false`.
Chunk 46 implements sovereign wallets, versioned addresses,
BlockchainAccount authorization, multi-auth, recovery, delegated keys,
and a local encrypted development keystore at `packages/sunrey-chain`.
Capability `sunrey-sovereign-wallets` is `IMPLEMENTED`. See
[`chunk-46-sovereign-wallets.md`](./chunk-46-sovereign-wallets.md).
Do not create `packages/wallet-v2`, `packages/blockchain-wallet`,
`packages/crypto-wallet`, or `packages/sunrey-wallet-ledger`.
Wallet metadata is not a second native-asset ledger.
Chunk 55 implements multi-failure-domain resilience, observability,
backup, and disaster-recovery drills at `packages/sunrey-chain`.
Capability `sunrey-ops-resilience` is `IMPLEMENTED`. See
[`chunk-55-resilience-observability.md`](./chunk-55-resilience-observability.md).
Do not create `packages/sunrey-ops`, `packages/observability`, or
`packages/disaster-recovery`. Engineering SLOs remain
`ENGINEERING_TEST_TARGETS`.
Chunk 54 implements validator operator infrastructure at
`packages/sunrey-chain`. Capability `sunrey-validator-operations`
is `IMPLEMENTED`. See
[`chunk-54-validator-operations.md`](./chunk-54-validator-operations.md).
Do not create `packages/sunrey-ops`, `packages/validator-ops`,
`packages/sentry`, or `packages/remote-signer`.
Chunk 53 implements the public TEST NETWORK package at
`packages/sunrey-chain`. Capability `sunrey-public-testnet` is
`IMPLEMENTED`. See
[`chunk-53-public-testnet.md`](./chunk-53-public-testnet.md).
Network `net_sunrey_testnet_1` / chain `chn_sunrey_testnet_1`.
Not mainnet. Tickers remain `NOT_ASSIGNED`. Do not create
`packages/sunrey-testnet` or enable production banking rails.
Chunk 52 implements the rebuildable SunRey explorer at
`packages/sunrey-explorer`. Capability `sunrey-explorer` is
`IMPLEMENTED`. See
[`chunk-52-explorer.md`](./chunk-52-explorer.md).
The explorer is a projection. Canonical authority remains finalized
SunRey Blockchain state. Do not create `packages/block-explorer`,
`packages/chain-indexer`, or a second indexer.
Chunk 51 implements the official developer platform at
`packages/sunrey-sdk`. Capability `sunrey-developer-sdk` is
`IMPLEMENTED`. See
[`chunk-51-developer-platform.md`](./chunk-51-developer-platform.md).
Do not create `packages/blockchain-v2`,
`packages/sunrey-chain-sdk-ledger`, `packages/sdk-ledger`, or
`packages/exchange-v2`. The evaluator returns `mustStop: false`.
Chunk 60 integrates a standardized post-quantum provider
(`@noble/post-quantum@0.5.4`) into the existing CryptoSuite at
`packages/security` for development/testnet hybrid migration.
Capability `sunrey-pqc-testnet` is `IMPLEMENTED`. See
[`chunk-60-post-quantum-integration.md`](./chunk-60-post-quantum-integration.md).
Do not create `packages/post-quantum`, `packages/pqc-core`,
`packages/quantum-security`, or `packages/crypto-v2`.
Production / HSM / counsel approval remains pending. Not quantum-proof.
Chunk 59 implements software supply-chain security, reproducible
releases, and dependency assurance at `packages/sunrey-chain`.
Capability `sunrey-supply-chain` is `IMPLEMENTED`. See
[`chunk-59-supply-chain.md`](./chunk-59-supply-chain.md).
`ReleaseAuthority` signs artifacts only and does not activate
protocol change. Do not create `packages/supply-chain`,
`packages/sunrey-release`, `packages/sbom`, or
`packages/reproducible-builds`.
Chunk 58 implements the sunrey-bench performance, load, soak, and
capacity suite at `packages/sunrey-chain`. Capability
`sunrey-performance-engineering` is `IMPLEMENTED`. See
[`chunk-58-performance.md`](./chunk-58-performance.md).
Do not create `packages/sunrey-bench`, `packages/performance`, or
`packages/load-test`. Results are engineering measurements, not
production guarantees. The evaluator returns `mustStop: false`.
Chunk 57 implements the isolated adversarial cyber-economic test
range at `packages/sunrey-range`. Capability
`sunrey-adversarial-range` is `IMPLEMENTED`. See
[`chunk-57-adversarial-range.md`](./chunk-57-adversarial-range.md).
Chunk 157 extends the same capability with a production-safety
campaign. See
[`docs/security/chunk-157-production-adversarial-resilience.md`](../security/chunk-157-production-adversarial-resilience.md).
Do not create `packages/red-team`, `packages/attack-sim`,
`packages/sunrey-pentest`, `packages/chaos-v2`,
`packages/security-range-v2`, `packages/pentest`, or
`packages/adversarial-v2`. The evaluator returns `mustStop: false`.
Chunk 56 implements SunRey protocol fuzzing, property tests,
differential TypeScript/Rust drivers, and deterministic replay at
`packages/sunrey-chain`. Capability `sunrey-assurance` is
`IMPLEMENTED`. See
[`chunk-56-assurance-fuzzing.md`](./chunk-56-assurance-fuzzing.md).
Do not create `packages/sunrey-test`, `packages/fuzz`,
`packages/assurance`, or `tools/sunrey-test`. This is not formal
verification. The evaluator returns `mustStop: false`.
Chunk 70 implements the SunRey full mainnet launch rehearsal at
`packages/sunrey-chain/src/launch-rehearsal`. Capability
`sunrey-launch-rehearsal` is `IMPLEMENTED`. See
[`chunk-70-launch-rehearsal.md`](./chunk-70-launch-rehearsal.md).
It does not launch mainnet or enable `LIVE_*` services. Do not
create `packages/sunrey-launch`, `packages/launch-rehearsal`, or
`packages/mainnet-rehearsal`. The evaluator returns
`mustStop: false`.
Chunk 71 implements the SunRey dual-native-asset monetary
constitution at `packages/sunrey-chain/src/economics`. Capability
`sunrey-monetary-constitution` is `IMPLEMENTED`. See
[`chunk-71-monetary-constitution.md`](./chunk-71-monetary-constitution.md).
It does not invent production tokenomics or create a second ledger.
Do not create `packages/monetary-policy`,
`packages/tokenomics`, or `packages/genesis-economy`.
`packages/sunrey-economics` is the Chunk 75/76 laboratory owner, not
a second monetary constitution. The evaluator
returns `mustStop: false`.
Chunk 65 implements mainnet readiness evidence, a per-capability
activation matrix, and deterministic genesis-candidate tooling at
`packages/sunrey-chain/src/mainnet`. Capability
`sunrey-mainnet-readiness` is `IMPLEMENTED`. See
[`chunk-65-mainnet-readiness.md`](./chunk-65-mainnet-readiness.md).
It does not launch mainnet or enable `LIVE_*` services. Do not
create `packages/mainnet`, `packages/sunrey-mainnet`,
`packages/genesis-candidate`, `packages/readiness-registry`, or
`packages/activation-control`. The evaluator returns
`mustStop: false`.
Chunk 69 implements the production-candidate Exchange and custody
regulated integration framework at `packages/sunrey-exchange`,
`packages/custody`, `packages/kernel`, `packages/security`, and
`packages/sunrey-chain`. Capability `sunrey-regulated-integration`
is `IMPLEMENTED`. See
[`chunk-69-regulated-integration.md`](./chunk-69-regulated-integration.md).
It does not activate live regulated services. Do not create
`packages/regulated-exchange`, `packages/provider-registry`,
`packages/travel-rule-production`, `packages/custody-activation`, or
`packages/exchange-kyc`. The evaluator returns `mustStop: false`.
Chunk 68 implements production-candidate oracle provider onboarding,
off-chain collection, provenance, independence, and MoonRey
eligibility at `packages/sunrey-chain/src/oracle`. Capability
`sunrey-production-oracles` is `IMPLEMENTED`. See
[`chunk-68-production-oracles.md`](./chunk-68-production-oracles.md).
Consensus never calls HTTP. Do not create
`packages/production-oracles`, `packages/oracle-onboarding`, or
`packages/oracle-collector`. The evaluator returns `mustStop: false`.
Chunk 66 implements provider-neutral production infrastructure,
secret/KMS/HSM adapters, workload identity, and network zoning at
`packages/sunrey-chain/src/infra`. Capability
`sunrey-production-infrastructure` is `IMPLEMENTED`. See
[`chunk-66-production-infrastructure.md`](./chunk-66-production-infrastructure.md).
It does not launch mainnet or enable `LIVE_*` services. Do not
create `packages/sunrey-infra`, `packages/infrastructure`,
`packages/production-infrastructure`, `packages/cloud-adapters`, or
`packages/sunrey-cloud`. The evaluator returns `mustStop: false`.
Chunk 64 implements production-class root-of-trust and key-ceremony
architecture at `packages/security`. Capability
`sunrey-root-of-trust` is `IMPLEMENTED`. See
[`chunk-64-root-of-trust.md`](./chunk-64-root-of-trust.md).
CI uses clearly identified simulation providers. No production
private keys. No commercial HSM or completed production ceremony
claim. The evaluator returns `mustStop: false`.
Chunk 63 implements the Testnet release-candidate freeze,
qualification, and release-control system at
`packages/sunrey-chain`. Capability `sunrey-testnet-rc` is
`IMPLEMENTED`. See
[`chunk-63-testnet-rc.md`](./chunk-63-testnet-rc.md).
Not mainnet. Tickers remain `NOT_ASSIGNED`. Do not create
`packages/sunrey-rc`, `packages/release-candidate`,
`packages/testnet-rc`, `packages/sunrey-qualification`, or
`packages/rc-control`. The evaluator returns `mustStop: false`.
Chunk 72 implements validator bonding, reward, and accountability
economics at `packages/sunrey-chain/src/validator-economics`.
Capability `sunrey-validator-economics` is `IMPLEMENTED`. See
[`chunk-72-validator-economics.md`](./chunk-72-validator-economics.md)
and `docs/economics/`. Production bond asset remains
`UNCONFIGURED`. Do not create `packages/validator-economics`,
`packages/staking`, `packages/slashing`, or
`packages/liquid-staking`. The evaluator returns `mustStop: false`.
Chunk 62 implements independent security-review preparation at
`packages/sunrey-chain`. Capability `sunrey-audit-readiness` is
`IMPLEMENTED`. See
[`chunk-62-audit-readiness.md`](./chunk-62-audit-readiness.md).
The bundle does not claim an external audit occurred or passed.
Do not create `packages/sunrey-audit`, `packages/audit`,
`packages/security-review`, or `packages/audit-evidence`.
Chunk 83 implements independent security-review findings ingestion,
remediation, and retest evidence management at
`packages/sunrey-chain`. Capability `sunrey-audit-remediation` is
`IMPLEMENTED`. See
[`chunk-83-audit-remediation.md`](./chunk-83-audit-remediation.md).
The workflow does not claim an external audit occurred or passed.
Do not create `packages/audit-remediation` or
`packages/security-audit-v2`.
Chunk 61 implements bounded TLA+/TLC protocol models, selected Rust
bounded verification, and implementation-trace conformance at
`packages/sunrey-chain`. Capability `sunrey-formal-assurance` is
`IMPLEMENTED`. See
[`chunk-61-formal-models.md`](./chunk-61-formal-models.md).
Results are model checked within stated bounds. Do not create
`packages/formal`, `packages/tla`, `packages/model-checker`,
`packages/sunrey-formal`, or `tools/formal`. The evaluator returns
`mustStop: false`.
Chunk 75 implements the SunRey / MoonRey dual-economy simulation
laboratory at `packages/sunrey-economics`. Capability
`sunrey-dual-economy-simulator` is `IMPLEMENTED`. See
[`chunk-75-dual-economy.md`](./chunk-75-dual-economy.md).
It does not predict prices, promise returns, or activate production
monetary policy. Do not create `packages/dual-economy`,
`packages/moonrey-macro`, or `packages/economic-bridge`. The
evaluator returns `mustStop: false`.
Chunk 78 implements economic release-candidate freeze, policy freeze,
and qualification at
`packages/sunrey-chain/src/release-candidate/economic`. Capability
`sunrey-economic-rc` is `IMPLEMENTED`. See
[`chunk-78-economic-rc.md`](./chunk-78-economic-rc.md).
It does not authorize mainnet or invent production parameters. Do not
create `packages/sunrey-economic-rc`, `packages/economic-rc`,
`packages/economic-qualification`, `packages/sunrey-economic-release`,
or `packages/economic-policy-freeze`. The evaluator returns
`mustStop: false`.
Chunk 84 implements the SunRey Mainnet Release Candidate freeze,
full-system qualification, and release evidence bundle at
`packages/sunrey-chain/src/release-candidate/mainnet`. Capability
`sunrey-mainnet-rc` is `IMPLEMENTED`. See
[`chunk-84-mainnet-rc.md`](./chunk-84-mainnet-rc.md).
It does not launch mainnet or treat engineering qualification as
authorization. Do not create `packages/sunrey-mainnet-rc`,
`packages/mainnet-rc`, `packages/mainnet-qualification`,
`packages/sunrey-mainnet-release`, or
`packages/mainnet-release-candidate`. The evaluator returns
`mustStop: false`.
Chunk 89 implements post-genesis stabilization and progressive
capability activation at `packages/sunrey-chain/src/post-genesis`.
Capability `sunrey-post-genesis-stabilization` is `IMPLEMENTED`. See
[`chunk-89-post-genesis-stabilization.md`](./chunk-89-post-genesis-stabilization.md).
It does not launch mainnet or activate real production capabilities.
Do not create `packages/post-genesis`, `packages/sunrey-post-genesis`,
`packages/stabilization`, `packages/capability-activation`, or
`packages/production-activation`. The evaluator returns
`mustStop: false`.
Chunk 76 reconciles the merged Chunk 71–75 economic stack and
implements the adversarial economic stress laboratory at
`packages/sunrey-economics/src/stress` with
`packages/sunrey-chain/src/economics/stack.ts`. Capability
`sunrey-economic-stress-lab` is `IMPLEMENTED`. See
[`chunk-76-economic-stress-lab.md`](./chunk-76-economic-stress-lab.md).
It does not authorize production or assign tickers. Do not create
`packages/economic-stress`, `packages/sunrey-stress-chain`, or
`packages/economic-red-team`. The evaluator returns `mustStop: false`.
Chunk 74 implements MoonRey productive-economy issuance policy
governance, normalization, and macro supply controls at
`packages/sunrey-chain/src/productive/policy-governance`. Capability
`moonrey-policy-governance` is `IMPLEMENTED`. See
[`chunk-74-moonrey-issuance-policy.md`](./chunk-74-moonrey-issuance-policy.md).
It extends Chunk 44 and does not create a second MoonRey asset or mint
path. Production caps remain `UNCONFIGURED`. Chunk 121 extends the
same owner with cross-domain attribution policy at
`packages/sunrey-chain/src/productive/policy-governance/attribution`.
Do not create `packages/moonrey-policy`, `packages/moonrey-economics`,
`packages/issuance-policy`, `packages/attribution-policy`, or
`packages/moonrey-attribution`. The evaluator returns `mustStop: false`.
Chunk 79 implements production governance operations, economic policy
change control, and bounded emergency authority at
`packages/sunrey-chain/src/governance-ops`. Capability
`sunrey-governance-operations` is `IMPLEMENTED`. See
[`chunk-79-governance-operations.md`](./chunk-79-governance-operations.md).
Existing Chunk 40 protocol governance remains authoritative. Do not
create `packages/governance-ops`, `packages/sunrey-governance`, or
`packages/governance-token`. The evaluator returns `mustStop: false`.
Chunk 77 implements the blockchain-native SunRey protocol treasury
and reserve architecture at
`packages/sunrey-chain/src/economics/treasury`. Capability
`sunrey-protocol-treasury` is `IMPLEMENTED`. See
[`chunk-77-protocol-treasury.md`](./chunk-77-protocol-treasury.md).
It is distinct from `packages/treasury`. It does not create a
second financial Ledger, a new native asset, a price peg, or a
treasury mint. Production treasury remains inactive. Do not create
`packages/sunrey-protocol-treasury`, `packages/native-treasury`, or
`packages/reserve-bank`. The evaluator returns `mustStop: false`.

Chunk 82 implements external production provider acceptance at
`packages/sunrey-chain/src/providers`. Capability
`sunrey-production-provider-acceptance` is `IMPLEMENTED`. See
[`chunk-82-production-provider-acceptance.md`](./chunk-82-production-provider-acceptance.md).
It reuses Chunk 66/68/69/64 registries and feeds Chunk 65 readiness.
Do not create `packages/provider-acceptance`,
`packages/production-providers`, `packages/external-providers`, or
`packages/sunrey-providers`. The evaluator returns `mustStop: false`.
Chunk 81 implements the second-generation SunRey production-network
candidate at `packages/sunrey-chain/src/mainnet/candidate-v2`.
Capability `sunrey-production-network-candidate` is `IMPLEMENTED`.
See [`chunk-81-production-network-candidate-v2.md`](./chunk-81-production-network-candidate-v2.md).
It binds the reconciled Chunks 76–80 stack into
`SUNREY_PRODUCTION_NETWORK_CANDIDATE_2` without launching mainnet,
enabling `LIVE_*`, or converting missing external evidence into
approved evidence. Do not create `packages/production-network`,
`packages/sunrey-production-network`, `packages/candidate-v2`,
`packages/mainnet-v2`, or `packages/production-candidate-v2`. The
evaluator returns `mustStop: false`.
Chunk 88 implements the authorized production genesis execution engine
and launch control room at
`packages/sunrey-chain/src/genesis-execution`. Capability
`sunrey-production-genesis-execution` is `IMPLEMENTED`. Automated
tests use isolated rehearsal inputs only. It does not launch mainnet,
enable `LIVE_*` flags, or automatically activate customer financial
capabilities. Do not create `packages/genesis-execution`,
`packages/sunrey-genesis-execution`,
`packages/production-genesis-execution`, `packages/mainnet-execution`,
or `packages/launch-execution`. The evaluator returns `mustStop: false`.
Chunk 87 implements the isolated pre-genesis production shadow network
and operational qualification system at
`packages/sunrey-chain/src/pregenesis`. Capability
`sunrey-pregenesis-qualification` is `IMPLEMENTED`. See
[`chunk-87-pregenesis-qualification.md`](./chunk-87-pregenesis-qualification.md).
It does not launch mainnet or treat engineering qualification as
authorization. Do not create `packages/sunrey-pregenesis`,
`packages/pregenesis`, `packages/shadow-network`,
`packages/pregenesis-qualification`, or `packages/sunrey-shadow`. The
evaluator returns `mustStop: false`.
Chunk 85 implements the production genesis ceremony at
`packages/sunrey-chain/src/production-ceremony`. Capability
`sunrey-production-genesis-ceremony` is `IMPLEMENTED`. See
[`chunk-85-production-genesis-ceremony.md`](./chunk-85-production-genesis-ceremony.md).
It binds the actual Chunk 81 Candidate V2 and Chunk 84 Mainnet RC.
Do not create `packages/sunrey-ceremony`, `packages/production-genesis`,
`packages/genesis-ceremony`, `packages/launch-authorization`, or
`packages/production-ceremony`. The evaluator returns `mustStop: false`.
Chunk 86 implements the production-environment provisioning control
plane at `packages/sunrey-chain/src/infra/provisioning`. Capability
`sunrey-production-provisioning` is `IMPLEMENTED`. See
[`chunk-86-production-provisioning.md`](./chunk-86-production-provisioning.md).
It extends Chunk 66. CI uses local/rehearsal infrastructure only.
Do not create `packages/sunrey-production-platform`,
`packages/mainnet-infrastructure-v2`, or
`packages/cloud-control-plane`. The evaluator returns `mustStop: false`.

Chunk 98 implements user-controlled AI agent mandates, transaction
proposals, and bounded financial automation at `packages/sunrey-agent`.
Capability `sunrey-user-agent-mandates` is `IMPLEMENTED`. See
[`chunk-98-agent-mandates.md`](./chunk-98-agent-mandates.md). AI
proposes. Execution requires a human mandate and the canonical
wallet, custody, or Execution Authority path. It does not create a
second AI authority system, wallet, Execution Authority, Exchange,
risk engine, or financial Ledger. Do not create
`packages/ai-authority`, `packages/agent-authority`,
`packages/user-agent-v2`, `packages/agent-execution`,
`packages/financial-automation`, or `packages/mandate-v2`. The
evaluator returns `mustStop: false`.
Chunk 95 implements production-candidate institutional market
operations at `packages/sunrey-exchange/src/ops`. Capability
`sunrey-exchange-market-operations` is `IMPLEMENTED`. It extends
the canonical Exchange. It does not create a second Exchange or a
second native-asset balance ledger. Production market activation
remains dependent on real external authorization. Do not create
`packages/market-operations`, `packages/institutional-gateway`,
`packages/exchange-ops`, or `packages/sunrey-exchange-ops`. The
evaluator returns `mustStop: false`.
Chunk 99 implements the consumer Exchange, portfolio, quote, and
simple trading backend at `packages/sunrey-exchange/src/consumer`.
Capability `sunrey-exchange-consumer-trading` is `IMPLEMENTED`. It
extends the canonical Exchange. It does not create a second Exchange,
matching engine, or balance ledger. Production consumer trading
remains dependent on real external authorization. Do not create
`packages/consumer-exchange`, `packages/sunrey-consumer-exchange`,
`packages/retail-exchange`, or `packages/consumer-trading`. The
evaluator returns `mustStop: false`.
Chunk 94 implements the SunRey developer application platform at
`packages/sunrey-sdk/src/developer-platform`. Capability
`sunrey-developer-platform` is `IMPLEMENTED`. See
[`chunk-94-developer-platform.md`](./chunk-94-developer-platform.md).
It extends Chunk 51 and Chunk 53. Developer credentials cannot sign
user funds. Production application registration does not activate
production financial capabilities. Do not create
`packages/sunrey-developer-platform`, `packages/developer-portal`,
`packages/app-registry`, `packages/webhook-service`, or
`packages/developer-platform-v2`. The evaluator returns
`mustStop: false`.
Chunk 93 implements the public RPC edge, Explorer HA, and production
network data plane at `packages/sunrey-chain/src/public-data-plane`.
Capability `sunrey-public-data-plane` is `IMPLEMENTED`. See
[`chunk-93-public-data-plane.md`](./chunk-93-public-data-plane.md).
RPC reads canonical chain state. Explorer is rebuildable and
non-authoritative. Do not create `packages/public-rpc`,
`packages/sunrey-rpc-edge`, `packages/rpc-gateway`,
`packages/explorer-ha`, or `packages/public-data-plane`. The evaluator
returns `mustStop: false`.
Chunk 92 implements the validator operator platform, fleet
management, and production operator control plane at
`packages/sunrey-chain/src/validator-operator`. Capability
`sunrey-validator-operator-platform` is `IMPLEMENTED`. See
[`chunk-92-validator-operator-platform.md`](./chunk-92-validator-operator-platform.md).
It consumes the validator registry, Chunk 36 lifecycle, Chunk 39
accountability, Chunk 54 operations, Chunk 72 economics, Chunk 81
Candidate V2, Chunk 85 dossiers, Chunk 87 qualification, and Chunk 90
production operations. It does not create a second registry,
consensus engine, public delegated staking, or governance token.
Do not create `packages/validator-operator`,
`packages/sunrey-validator-ops`, `packages/operator-platform`,
`packages/validator-fleet`, or `packages/delegated-staking`. The
evaluator returns `mustStop: false`.
Chunk 91 implements the executable provider runtime at
`packages/sunrey-chain/src/provider-runtime`. Capability
`sunrey-provider-runtime` is `IMPLEMENTED`. See
[`chunk-91-provider-runtime.md`](./chunk-91-provider-runtime.md).
It extends Chunks 66, 68, 69, 82, and 90. Adapter success is not
approval. Do not create `packages/provider-runtime`,
`packages/sunrey-provider-runtime`, `packages/executable-providers`,
`packages/provider-adapters`, or `packages/integration-providers`.
The evaluator returns `mustStop: false`.
Chunk 100 implements production-candidate Human Information Network
interfaces at `packages/information-market/src/network`. Capability
`sunrey-human-information-network` is `IMPLEMENTED`. It extends
canonical Consent, Clean Room, Personal Data Vault, the information
marketplace, and Exchange `HUMAN_INFORMATION_RIGHT` eligibility.
Sensitive source data remains off-chain. Production remains
`RESEARCH_REQUIRED` until privacy review, legal analysis, jurisdiction
policy, terms, requester controls, and human authorization exist.
Do not create `packages/human-information-network`,
`packages/information-market-v2`, `packages/human-information-v2`,
`packages/data-marketplace`, or `packages/sunrey-information-network`.
The evaluator returns `mustStop: false`.
Chunk 97 implements mobile wallet synchronization at
`packages/sunrey-chain/src/wallet/mobile-sync`. Capability
`sunrey-mobile-wallet-sync` is `IMPLEMENTED`. See
[`chunk-97-mobile-sync.md`](./chunk-97-mobile-sync.md).
It extends Chunks 46, 51, 93, 94, and 96. Wallet projections are
rebuildable. Backend sync is not a second ledger. Do not create
`packages/mobile-wallet-sync`, `packages/sunrey-mobile-sync`,
`packages/wallet-sync`, `packages/mobile-wallet-v2`, or
`packages/sunrey-push`. The evaluator returns `mustStop: false`.
Chunk 96 implements advanced wallet security at
`packages/sunrey-chain/src/wallet/security`. Capability
`sunrey-wallet-security` is `IMPLEMENTED`. See
[`chunk-96-wallet-security.md`](./chunk-96-wallet-security.md).
It extends Chunk 46. Application login is not native signing.
Recovery cannot rewrite finalized state. Do not create
`packages/wallet-security`, `packages/sunrey-wallet-security`,
`packages/wallet-auth`, `packages/device-trust`, or
`packages/wallet-recovery-v2`. The evaluator returns
`mustStop: false`.
Chunk 101 implements the canonical AI inference runtime at
`packages/ai-runtime`. Capability `sunrey-ai-runtime` is
`IMPLEMENTED`. See [`chunk-101-ai-runtime.md`](./chunk-101-ai-runtime.md)
and [`docs/ai/chunk-101-ai-runtime.md`](../ai/chunk-101-ai-runtime.md).
It is an inference plane only. S3M is the intended primary
intelligence engine. xAI/Grok is reserved for Chunk 103 and is not
networked here. The Financial Agent remains
`packages/sunrey-agent`. Do not create `packages/ai-engine`,
`packages/model-runtime`, `packages/grok-runtime`, `packages/s3m`,
`packages/llm`, or `packages/inference-v2`. The evaluator returns
`mustStop: false`.
Chunk 102 implements the S3M primary intelligence adapter at
`packages/ai-runtime/src/providers/s3m`. Capability
`sunrey-s3m-provider` is `IMPLEMENTED`. See
[`chunk-102-s3m-provider.md`](./chunk-102-s3m-provider.md) and
[`docs/ai/chunk-102-s3m-provider.md`](../ai/chunk-102-s3m-provider.md).
S3M is a separate AI system. SunRey communicates through a bounded
inference-provider adapter and a configurable transport contract.
Grok is not implemented here. Do not create `packages/s3m`,
`packages/s3m-runtime`, or `packages/s3m-training`. The evaluator
returns `mustStop: false`.
Chunk 108 implements the Human Contribution to SunRey monetary
evidence bridge at
`packages/sunrey-chain/src/economics/human-contribution-bridge`.
Capability `sunrey-human-contribution-monetary-bridge` is
`IMPLEMENTED`. See
[`chunk-108-human-contribution-monetary-bridge.md`](./chunk-108-human-contribution-monetary-bridge.md)
and
[`docs/economics/chunk-108-human-contribution-monetary-bridge.md`](../economics/chunk-108-human-contribution-monetary-bridge.md).
It adapts privacy-safe verified contribution fields into existing
Chunk 71 `HumanEconomicEvidence` and `MonetaryIssuanceAuthority`.
It is not a second mint. Chunk 112 extends the same owner with an
engineering-implemented valuation-to-settlement path. Production
valuation remains unactivated. Legacy fixtures remain simulation-only.
Do not create `packages/human-contribution-mint`,
`packages/human-valuation-engine`, `packages/contribution-issuance`,
`packages/human-worth-token`, or `packages/peve-mint`. The evaluator
returns `mustStop: false`.
Chunk 107 implements the Human Information Network to Human
Economic Contribution Registry adapter at
`packages/information-market/src/network/contribution`. Capability
`sunrey-hin-contribution-integration` is `IMPLEMENTED`. See
[`chunk-107-hin-contribution-integration.md`](./chunk-107-hin-contribution-integration.md)
and
[`docs/economics/chunk-107-hin-contribution-integration.md`](../economics/chunk-107-hin-contribution-integration.md).
HIN is the source adapter for `INFORMATION_RIGHT_CONTRIBUTION`.
Other contribution classes use their own verified attestation paths.
Compensation remains `mintRequested: false`. Do not create
`packages/hin-contribution-registry`,
`packages/information-contribution-v2`, or
`packages/human-information-contribution`. The evaluator returns
`mustStop: false`.
Chunk 140 completes Human Information chain-anchor finality, reorg
handling, and reconciliation at
`packages/information-market/src/network/chain-anchor`. Capability
`sunrey-hin-chain-anchoring` is `IMPLEMENTED`. See
[`chunk-140.json`](./chunks/chunk-140.json) and
[`docs/economics/chunk-140-hin-chain-finality.md`](../economics/chunk-140-hin-chain-finality.md).
HIN uses the existing SunRey Chain lifecycle through
`HumanInformationChainAnchorPort`. Chain finality is evidence, not
legal consent authority. Do not create `packages/hin-chain-anchor`,
`packages/hin-finality`, `packages/information-chain-node`, or
`packages/hin-blockchain`. The evaluator returns
`mustStop: false`.
Chunk 104 implements the canonical Human Economic Contribution
ontology at `packages/human-economic-contribution`. Capability
`sunrey-human-economic-contributions` is `IMPLEMENTED`. See
[`chunk-104-human-contribution-ontology.md`](./chunk-104-human-contribution-ontology.md)
and [`docs/economics/chunk-104-human-contribution-ontology.md`](../economics/chunk-104-human-contribution-ontology.md).
It defines what a human economic contribution is. PEVE remains
`packages/platform/src/value`. HIN remains
`packages/information-market`. The monetary constitution remains
Chunk 71. Measurement is not token valuation. Do not create
`packages/human-contribution`,
`packages/human-economic-contribution-v2`,
`packages/contribution-ontology`, `packages/human-worth`,
`packages/contribution-valuation`,
`packages/human-contribution-score`, or
`packages/sunrey-contribution`. The evaluator returns
`mustStop: false`.
Chunk 106 extends the same capability with the canonical verified
contribution registry at `packages/human-economic-contribution`.
See [`chunk-106-human-contribution-registry.md`](./chunk-106-human-contribution-registry.md)
and [`docs/economics/chunk-106-human-contribution-registry.md`](../economics/chunk-106-human-contribution-registry.md).
It is the system of record for verified contribution records. It does
not value, mint, or issue Execution Authority. Do not create
`packages/human-contribution-registry`,
`packages/contribution-registry`, or
`packages/human-economic-contribution-registry`. The evaluator returns
`mustStop: false`.
Chunk 113 implements the canonical Dataset and Economic Asset Registry
at `packages/economic-asset-registry`. Capability
`sunrey-economic-asset-registry` is `IMPLEMENTED`. See
[`chunk-113-economic-asset-registry-foundation.md`](./chunk-113-economic-asset-registry-foundation.md)
and
[`docs/economics/chunk-113-economic-asset-registry-foundation.md`](../economics/chunk-113-economic-asset-registry-foundation.md).
It is the master metadata registry above HIN, PDV, PEG, the Human
Economic Contribution Registry, oracles, productive registries, and
the monetary constitution. It does not store raw datasets or authorize
minting. Do not create `packages/dataset-registry`,
`packages/economic-assets`, `packages/data-assets-v2`,
`packages/universal-data-registry`, or `packages/tokenized-data`. The
evaluator returns `mustStop: false`.
Chunk 114 extends the same owner with rights, provenance, and lineage
verification at `packages/economic-asset-registry/src/verification`.
Capability `sunrey-economic-asset-verification` is `IMPLEMENTED` on
that owner. See
[`chunk-114-economic-asset-verification.md`](./chunk-114-economic-asset-verification.md)
and
[`docs/economics/chunk-114-economic-asset-verification.md`](../economics/chunk-114-economic-asset-verification.md).
`VERIFIED` means the descriptor passed a versioned policy. It does
not value, mint, or issue Execution Authority. Do not create
`packages/dataset-verification`, `packages/data-rights-registry`,
`packages/economic-provenance`, `packages/asset-rights`, or
`packages/economic-assets-v2`. The evaluator returns `mustStop: false`.
Chunk 115 extends the same Economic Asset Registry owner with the
cross-domain integration fabric. Source-domain adapters project
privacy-safe metadata from HIN, the Human Contribution Registry, the
Oracle Network, and the productive economy through
`EconomicAssetRegistryPort`. The registry is not the source of truth
for those domains and does not mint. Do not create a second registry
package. The evaluator returns `mustStop: false`.
Chunk 111 implements the Deterministic Human Contribution Valuation
Engine at `packages/human-economic-contribution/src/valuation`.
Capability `sunrey-human-contribution-valuation` is `IMPLEMENTED`.
See [`chunk-111-human-contribution-valuation-engine.md`](./chunk-111-human-contribution-valuation-engine.md)
and
[`docs/economics/chunk-111-human-contribution-valuation-engine.md`](../economics/chunk-111-human-contribution-valuation-engine.md).
It evaluates a VERIFIED contribution under an active versioned
valuation policy. A valuation result is not settlement authorization,
SunRey issuance, PEVE, or a human-worth score. Do not create
`packages/human-valuation-engine`, `packages/contribution-valuation`,
or `packages/human-contribution-valuation`. The evaluator returns
`mustStop: false`.
Chunk 110 implements the Human Contribution Valuation constitution
and methodology registry at
`packages/human-economic-contribution/src/valuation`. Capability
`sunrey-human-contribution-valuation` is `IMPLEMENTED`. See
[`chunk-110-human-contribution-valuation-constitution.md`](./chunk-110-human-contribution-valuation-constitution.md)
and
[`docs/economics/chunk-110-human-contribution-valuation-constitution.md`](../economics/chunk-110-human-contribution-valuation-constitution.md).
It is event-specific and versioned. PEVE remains
`packages/platform/src/value`. A reference value is not a SunRey
quantity and does not mint. Production valuation remains
unconfigured. Do not create `packages/human-valuation-engine`,
`packages/contribution-valuation`, or `packages/human-valuation`. The
evaluator returns `mustStop: false`.
Chunk 109 hardens verification at
`packages/human-economic-contribution/src/verification`. Capability
`sunrey-human-contribution-verification` is `IMPLEMENTED` on the same
owner. See
[`chunk-109-human-contribution-verification.md`](./chunk-109-human-contribution-verification.md)
and
[`docs/economics/chunk-109-human-contribution-verification.md`](../economics/chunk-109-human-contribution-verification.md).
VERIFIED means the contribution passed a versioned evidence policy.
It does not value, mint, or issue Execution Authority. Do not create
`packages/human-contribution-verification`,
`packages/contribution-verification`, or `packages/human-worth`.
The evaluator returns `mustStop: false`.
Chunk 118 implements the canonical economic unit normalization
constitution at `packages/sunrey-chain/src/units`. Capability
`sunrey-economic-unit-normalization` is `IMPLEMENTED`. See
[`chunk-118-canonical-economic-units.md`](./chunk-118-canonical-economic-units.md)
and
[`docs/economics/chunk-118-canonical-economic-units.md`](../economics/chunk-118-canonical-economic-units.md).
It extends the Chunk 43 protocol unit contract. The productive
`UnitRegistry` remains a compatibility facade. Conversion is exact
rational arithmetic. It does not issue MoonRey or activate live
providers. Do not create `packages/unit-registry`,
`packages/economic-units`, `packages/sunrey-units`,
`packages/normalization`, or `packages/canonical-units`. The
evaluator returns `mustStop: false`.
Chunk 125 implements the Productive Value → MoonRey settlement
conversion bridge at
`packages/sunrey-chain/src/productive/policy-governance/value-settlement`.
Capability `moonrey-productive-value-settlement` is `IMPLEMENTED`.
GPUV is not MoonRey. Chunk 71 remains the only mint. The evaluator
returns `mustStop: false`.
Chunk 122 extends `moonrey-policy-governance` with
`ProductiveAttributionBook` at
`packages/sunrey-chain/src/productive/policy-governance/attribution-accounting`.
See
[`chunk-122-moonrey-attribution-reconciliation.md`](./chunk-122-moonrey-attribution-reconciliation.md)
and
[`docs/economics/chunk-122-moonrey-attribution-reconciliation.md`](../economics/chunk-122-moonrey-attribution-reconciliation.md).
The book is a non-monetary share record. It is not a second ledger,
AssetSupplyBook, wallet, or MoonRey supply. It does not calculate
Productive Value. Do not create `packages/attribution-ledger`,
`packages/moonrey-attribution-book`, or
`packages/productive-attribution-ledger`. The evaluator returns
Chunk 121 extends `moonrey-policy-governance` with the governed
MoonRey cross-domain attribution policy engine at
`packages/sunrey-chain/src/productive/policy-governance/attribution`.
See [`chunk-121-moonrey-attribution-policy.md`](./chunk-121-moonrey-attribution-policy.md)
and
[`docs/economics/chunk-121-moonrey-attribution-policy.md`](../economics/chunk-121-moonrey-attribution-policy.md).
It evolves Chunk 74 allocation rules into a versioned attribution
policy. Historical policy versions remain reproducible. Attribution
does not mint MoonRey or determine final quantity. Do not create
`packages/attribution-policy`, `packages/moonrey-attribution`,
`packages/productive-attribution`, or `packages/attribution-engine`.
The evaluator returns `mustStop: false`.
Chunk 120 implements canonical productive economic event identity at
`packages/sunrey-chain/src/productive/policy-governance/attribution`.
Capability `moonrey-economic-event-attribution` is `IMPLEMENTED`. See
[`chunk-120-productive-economic-event-identity.md`](./chunk-120-productive-economic-event-identity.md)
and
[`docs/economics/chunk-120-productive-economic-event-identity.md`](../economics/chunk-120-productive-economic-event-identity.md).
It extends Chunk 74. Event fingerprint v3 does not delete v1/v2.
The attribution graph cannot mint. Do not create
`packages/moonrey-attribution`, `packages/economic-event-graph`,
`packages/deduplication-engine`, or
`packages/productive-attribution-v2`. The evaluator returns
Chunk 119 migrates the MoonRey productive pipeline onto the Chunk 118
canonical unit authority via `CanonicalProductiveMeasurement` at
`packages/sunrey-chain/src/units`. Capability
`sunrey-economic-unit-normalization` remains the single owner. See
[`chunk-119-canonical-unit-migration.md`](./chunk-119-canonical-unit-migration.md)
and
[`docs/economics/chunk-119-canonical-unit-migration.md`](../economics/chunk-119-canonical-unit-migration.md).
New contributions require a normalization receipt. Physical
measurement does not apply quality, economic-category, or MoonRey
factors. Historical v1 fingerprints remain unchanged. Do not create
`packages/moonrey-units`, `packages/productive-units-v2`,
`packages/economic-normalization-v2`, `packages/measurement-engine`,
or `packages/unit-registry-v2`. The evaluator returns
`mustStop: false`.
Chunk 117 enforces the MoonRey source / fact / claim mapping at
`packages/sunrey-chain/src/oracle/source-taxonomy` and
`packages/sunrey-chain/src/productive/claim-candidate`. It extends
`sunrey-production-oracles` and `sunrey-productive-capacity`. See
[`chunk-117-moonrey-source-claim-enforcement.md`](./chunk-117-moonrey-source-claim-enforcement.md)
and
[`docs/economics/chunk-117-moonrey-source-claim-enforcement.md`](../economics/chunk-117-moonrey-source-claim-enforcement.md).
A compatible mapping and a `ProductiveClaimCandidate` do not mint
MoonRey. Do not create `packages/moonrey-source-taxonomy`,
`packages/source-claim-enforcement`, or
`packages/productive-claim-candidate`. The evaluator returns
`mustStop: false`.
Chunk 116 implements the canonical MoonRey source-to-productive
taxonomy at `packages/sunrey-chain/src/productive/source-taxonomy`.
Capability `moonrey-source-taxonomy` is `IMPLEMENTED`. See
[`chunk-116-moonrey-source-taxonomy.md`](./chunk-116-moonrey-source-taxonomy.md)
and
[`docs/economics/chunk-116-moonrey-source-taxonomy.md`](../economics/chunk-116-moonrey-source-taxonomy.md).
It maps data-source categories to fact types, productive categories,
source units, and allowed claim types. A mapping is not MoonRey
issuance. Do not create `packages/moonrey-taxonomy`,
`packages/source-taxonomy`, `packages/productive-taxonomy`, or
`packages/moonrey-source-taxonomy`. The evaluator returns
`mustStop: false`.
Chunk 127 implements the off-chain production economic data connector
runtime at `packages/sunrey-chain/src/oracle/production`. Capability
`sunrey-economic-data-connector-runtime` is `IMPLEMENTED`. See
[`chunk-127-economic-data-connector-runtime.md`](./chunk-127-economic-data-connector-runtime.md)
and
[`docs/economics/chunk-127-economic-data-connector-runtime.md`](../economics/chunk-127-economic-data-connector-runtime.md).
It extends Chunk 68. Consensus never calls HTTP. A successful fetch
is not a verified fact and does not mint MoonRey. Do not create
`packages/oracle-connectors`, `packages/data-ingestion`,
`packages/moonrey-connectors`, or `packages/provider-runtime-v2`.
The evaluator returns `mustStop: false`.
Chunk 123 implements the governed MoonRey Productive Value Function
constitution at
`packages/sunrey-chain/src/productive/policy-governance/value-function`.
Capability `moonrey-productive-value-function` is `IMPLEMENTED` on the
existing MoonRey policy-governance owner. It does not mint or replace
the legacy issuance formula. Do not create `packages/moonrey-value`,
`packages/productive-value`, `packages/moonrey-tokenomics`,
`packages/moonrey-pricing`, or `packages/value-function-v2`. The
evaluator returns `mustStop: false`.
Chunk 128 implements economic data provider certification at
`packages/sunrey-chain/src/oracle/production/certification`.
Capability `sunrey-provider-certification` is `IMPLEMENTED` on the
existing production-oracle owner. See
[`chunk-128-provider-certification.md`](./chunk-128-provider-certification.md)
and
[`docs/economics/chunk-128-provider-certification.md`](../economics/chunk-128-provider-certification.md).
Certification is not a verified fact, productive contribution, or
MoonRey mint. Do not create `packages/provider-certification`,
`packages/oracle-certification`, or a second oracle registry. The
evaluator returns `mustStop: false`.
Chunk 132 implements the logistics, freight, delivery, and storage
economic data fabric at
`packages/sunrey-chain/src/oracle/production/provider-families/logistics`.
Capability `sunrey-logistics-storage-data-fabric` is `IMPLEMENTED`.
See
[`chunk-132-logistics-storage-data-fabric.md`](./chunk-132-logistics-storage-data-fabric.md)
and
[`docs/economics/chunk-132-logistics-storage-data-fabric.md`](../economics/chunk-132-logistics-storage-data-fabric.md).
It extends Chunk 68 / 127 / 128. Named carriers are not contacted.
Goods production is not recounted as logistics. Warehouse capacity is
not realized storage. Logistics and storage facts cannot auto-mint.
Do not create `packages/logistics-data-fabric`,
`packages/freight-oracles`, `packages/warehouse-storage-oracles`, or
`packages/moonrey-logistics`. The evaluator returns `mustStop: false`.

Capability `sunrey-manufacturing-robotics-data-fabric` is `IMPLEMENTED`
on the existing production-oracle owner. See
[`chunk-131-manufacturing-robotics-data-fabric.md`](./chunk-131-manufacturing-robotics-data-fabric.md)
and
[`docs/economics/chunk-131-manufacturing-robotics-data-fabric.md`](../economics/chunk-131-manufacturing-robotics-data-fabric.md).
The fabric is read-only economic evidence. It does not command
industrial equipment, contact a real factory, or mint MoonRey. Do not
create `packages/manufacturing-oracle`,
`packages/industrial-data-fabric`, `packages/robotics-oracle`, or
`packages/factory-connectors`. The evaluator returns `mustStop: false`.
Chunk 130 implements the provider-neutral compute and AI compute
economic data fabric at
`packages/sunrey-chain/src/oracle/production/provider-families/compute`.
Capability `sunrey-compute-ai-data-fabric` is `IMPLEMENTED` on the
existing production-oracle owner. See
[`chunk-130-compute-ai-data-fabric.md`](./chunk-130-compute-ai-data-fabric.md)
and
[`docs/economics/chunk-130-compute-ai-data-fabric.md`](../economics/chunk-130-compute-ai-data-fabric.md).
Tokens are not GPU-time. Capacity is not realized output. Facts do
not mint MoonRey. Do not create `packages/compute-oracle`,
`packages/ai-compute-provider`, `packages/gpu-metering`, or
`packages/compute-data-fabric`. The evaluator returns `mustStop: false`.
Chunk 129 implements the energy and electrical-grid economic data
fabric at
`packages/sunrey-chain/src/oracle/production/provider-families/energy`.
It extends `sunrey-production-oracles`. It does not contact live
providers, activate production ingestion, or mint MoonRey. Do not
create `packages/energy-oracle`, `packages/grid-oracle`,
`packages/moonrey-energy`, `packages/power-data`, or
`packages/utility-integration`. The evaluator returns `mustStop: false`.
Chunk 133 implements the minerals, natural resources, and extraction
economic data fabric at
`packages/sunrey-chain/src/oracle/production/provider-families/resources`.
Capability `sunrey-resource-extraction-data-fabric` is `IMPLEMENTED` on
the existing production-oracle owner. See
[`chunk-133-resource-extraction-data-fabric.md`](./chunk-133-resource-extraction-data-fabric.md)
and
[`docs/economics/chunk-133-resource-extraction-data-fabric.md`](../economics/chunk-133-resource-extraction-data-fabric.md).
`RESOURCE_RESERVE` is not extraction or OUTPUT. Do not create
`packages/resource-oracles`, `packages/minerals-data`,
`packages/extraction-fabric`, or `packages/resource-data-fabric`.
The evaluator returns `mustStop: false`.
Chunk 134 implements the agriculture, food, and water economic data
fabrics at
`packages/sunrey-chain/src/oracle/production/provider-families/agriculture`
and
`packages/sunrey-chain/src/oracle/production/provider-families/water`.
Capabilities `sunrey-agriculture-food-data-fabric` and
`sunrey-water-data-fabric` are `IMPLEMENTED` on the existing
production-oracle owner. See
[`chunk-134-agriculture-food-water-data-fabric.md`](./chunk-134-agriculture-food-water-data-fabric.md)
and
[`docs/economics/chunk-134-agriculture-food-water-data-fabric.md`](../economics/chunk-134-agriculture-food-water-data-fabric.md).
Planted area and forecast yield are not production.
`WATER_AVAILABILITY` is not production. Irrigation consumption is not
water production. Do not create `packages/agriculture-oracle`,
`packages/food-data-fabric`, `packages/water-oracle`, or
`packages/water-data-fabric`. The evaluator returns `mustStop: false`.
Chunk 137 implements the goods, commerce, and service-delivery
economic data fabric at
`packages/sunrey-chain/src/oracle/production/provider-families/goods`
and
`packages/sunrey-chain/src/oracle/production/provider-families/service-delivery`.
Capability `sunrey-goods-services-data-fabric` is `IMPLEMENTED` on
the existing production-oracle owner. See
[`chunk-137-goods-services-data-fabric.md`](./chunk-137-goods-services-data-fabric.md)
and
[`docs/economics/chunk-137-goods-services-data-fabric.md`](../economics/chunk-137-goods-services-data-fabric.md).
Order, invoice, and payment are not productive output. Facts cannot
auto-mint MoonRey. `service_hour` is the governed time-based service
unit; historical `machine_h` records are preserved. Do not create
`packages/goods-oracles`, `packages/commerce-data-fabric`,
`packages/services-oracle`, or `packages/moonrey-commerce`. The
evaluator returns `mustStop: false`.
Chunk 136 implements the bandwidth, telecom, and digital-network
economic data fabric at
`packages/sunrey-chain/src/oracle/production/provider-families/bandwidth`.
Capability `sunrey-bandwidth-network-data-fabric` is `IMPLEMENTED` on
the existing production-oracle owner. See
[`chunk-136-bandwidth-network-data-fabric.md`](./chunk-136-bandwidth-network-data-fabric.md)
and
[`docs/economics/chunk-136-bandwidth-network-data-fabric.md`](../economics/chunk-136-bandwidth-network-data-fabric.md).
`DATA_RATE` is not `DATA_VOLUME`. Capacity is not realized usage.
Facts do not mint MoonRey. Do not create `packages/bandwidth-oracle`,
`packages/telecom-data-fabric`, `packages/network-oracles`, or
`packages/cdn-metering`. The evaluator returns `mustStop: false`.
Chunk 135 implements the real-estate use and infrastructure economic
data fabric at
`packages/sunrey-chain/src/oracle/production/provider-families/real-estate`
and
`packages/sunrey-chain/src/oracle/production/provider-families/infrastructure`.
Capability `sunrey-real-estate-infrastructure-data-fabric` is
`IMPLEMENTED` on the existing production-oracle owner. See
[`chunk-135-real-estate-infrastructure-data-fabric.md`](./chunk-135-real-estate-infrastructure-data-fabric.md)
and
[`docs/economics/chunk-135-real-estate-infrastructure-data-fabric.md`](../economics/chunk-135-real-estate-infrastructure-data-fabric.md).
`REAL_ESTATE_USE_CAPACITY` is not realized occupancy. New usage is
`REAL_ESTATE_USAGE` in `m2_hour`. Historical infrastructure `machine_h`
stays `LEGACY_INFRASTRUCTURE_MACHINE_H_V1`. Do not create
`packages/real-estate-oracles`, `packages/infrastructure-oracles`,
`packages/property-data-fabric`, or `packages/facility-data-fabric`.
The evaluator returns `mustStop: false`.
Chunk 138 implements the unified multi-provider economic data fabric
at `packages/sunrey-chain/src/oracle/production/economic-data-fabric`.
Capability `sunrey-unified-economic-data-fabric` is `IMPLEMENTED` on
the existing production-oracle owner. See
[`chunk-138-unified-economic-data-fabric.md`](./chunk-138-unified-economic-data-fabric.md)
and
[`docs/economics/chunk-138-unified-economic-data-fabric.md`](../economics/chunk-138-unified-economic-data-fabric.md).
The fabric is not a second oracle, productive registry, attribution
engine, economic asset registry, or mint. Do not create
`packages/economic-data-fabric`, `packages/unified-oracles`,
`packages/cross-domain-reconciliation`, or
`packages/moonrey-data-fabric`. The evaluator returns
`mustStop: false`.
Chunk 143 implements the production economic activation firewall at
`packages/sunrey-chain/src/economics/production-activation`.
Capability `sunrey-production-economic-activation-firewall` is
`IMPLEMENTED` on the existing monetary/economic owner. The firewall
consumes Chunk 65 readiness and Chunk 71 monetary constitution. It
does not activate production, flip `LIVE_*` flags, invent tokenomics,
or create a second mint. Do not create `packages/production-economics`,
`packages/monetary-activation`, `packages/mainnet-economics`,
`packages/tokenomics-v2`, or `packages/launch-economics`. The
evaluator returns `mustStop: false`.
Chunk 148 implements the production economic constitution candidate
bundle at
`packages/sunrey-chain/src/release-candidate/economic/production-constitution`.
Capability `sunrey-economic-rc` is `IMPLEMENTED` on the existing
economic release-candidate owner. The candidate binds Chunk 71, the
Chunk 143 firewall, and the current parameter / policy / rehearsal
evidence by exact version and content hash. It does not activate
production, invent tokenomics, or rewrite historical Economic RC
hashes. Do not create `packages/economic-constitution`,
`packages/economic-rc-v2`, `packages/tokenomics-release`, or
`packages/dual-economy-release`. The evaluator returns
`mustStop: false`.
Chunk 147 extends the existing economic mainnet rehearsal owner at
`packages/sunrey-chain/src/economic-rehearsal/parameterized-candidate`.
Capability `sunrey-economic-mainnet-rehearsal` remains `IMPLEMENTED`.
The rehearsal feeds a complete `REHEARSAL_FIXTURE` parameter package
through the production validators, SunRey and MoonRey candidate
policies, Exchange DVP, and dual-economy stress. Fixture values have
no production economic meaning. The Chunk 143 firewall remains
production-blocked. Do not create `packages/parameterized-rehearsal`,
`packages/dual-economy-rehearsal`, or a second economic rehearsal
owner. The evaluator returns `mustStop: false`.
Chunk 145 implements the SunRey production issuance policy candidate at
`packages/human-economic-contribution/src/valuation/production-candidate`,
`packages/sunrey-chain/src/economics/human-contribution-bridge/production-candidate`,
and
`packages/sunrey-chain/src/economics/production-activation/sunrey-package`.
Capability `sunrey-production-issuance-policy-candidate` is
`IMPLEMENTED` on the existing valuation, settlement-bridge, and
production-activation owners. It does not select production quantities
or activate issuance. Fixture packages cannot authorize production.
Do not create `packages/sunrey-tokenomics`,
`packages/production-valuation`, `packages/issuance-parameters`, or
`packages/human-worth-token`. The evaluator returns `mustStop: false`.
Chunk 144 implements the canonical production economic parameter
registry at
`packages/sunrey-chain/src/economics/production-activation/parameter-package`.
Capability `sunrey-production-economic-parameters` is `IMPLEMENTED` on
the existing monetary/economic owner. It reuses Chunk 143 parameter
IDs and does not choose production tokenomics, activate production,
flip `LIVE_*` flags, or create a second mint. Do not create
`packages/tokenomics`, `packages/economic-parameters`,
`packages/monetary-policy-v2`, `packages/coin-supply`, or
`packages/production-mint`. The evaluator returns `mustStop: false`.
Chunk 141 implements the canonical SunRey product identity and legacy
naming inventory at `packages/config/src/product-identity.ts`.
Capability `sunrey-canonical-product-identity` is `IMPLEMENTED` on the
existing configuration owner. See
[`sunrey-naming-constitution.md`](./sunrey-naming-constitution.md).
This is not a second branding package, not a repository rename, and
not a protocol rewrite. Do not create `packages/branding`,
`packages/product-identity`, or `packages/sunrey-brand`. The evaluator
returns `mustStop: false`.
Chunk 139 implements the Human Information Network → SunRey Chain
anchoring foundation at
`packages/information-market/src/network/chain-anchor`. Capability
`sunrey-hin-chain-anchoring` is `IMPLEMENTED` after Chunk 140
completes submit, finality, reorg, and reconciliation. Required
capabilities are `IMPLEMENTED`, so the evaluator returns
`mustStop: false`. The adapter does not create a second chain,
consent ledger, or Evidence Vault. Do not create
`packages/hin-chain`, `packages/information-blockchain`,
`packages/privacy-chain`, `packages/consent-chain`, or
`packages/human-data-ledger`. See
[`chunk-139-hin-chain-anchor-foundation.md`](./chunk-139-hin-chain-anchor-foundation.md)
and
[`docs/economics/chunk-139-hin-chain-anchor-foundation.md`](../economics/chunk-139-hin-chain-anchor-foundation.md).
Chunk 126 implements MoonRey governed-value V2 shadow evaluation,
migration readiness, and economic stress hardening at
`packages/sunrey-chain/src/productive/policy-governance/shadow-economics`.
Capability `moonrey-v2-shadow-economics` is `IMPLEMENTED`. V1 remains
the legacy engineering-simulation model. V2 is the governed-value
simulation model. Production activation remains an explicit future
governance boundary. Do not create `packages/moonrey-shadow`,
`packages/value-migration`, `packages/moonrey-v2-engine`,
`packages/shadow-economics`, or `packages/moonrey-cutover`. The
evaluator returns `mustStop: false`.
Chunk 125 implements the Productive Value → MoonRey settlement
conversion bridge at
`packages/sunrey-chain/src/productive/policy-governance/value-settlement`.
Capability `moonrey-productive-value-settlement` is `IMPLEMENTED`.
GPUV is not MoonRey. Chunk 71 remains the only mint. The evaluator
returns `mustStop: false`.
Chunk 124 adds the deterministic Productive Value Function engine
inside that same module. Engineering implementation is not production
activation. Do not create `packages/moonrey-value-engine`,
`packages/productive-valuation`, `packages/moonrey-valuation`, or
`packages/economic-value-engine`. The evaluator returns
`mustStop: false`.
Chunk 146 defines the MoonRey production-candidate Productive Value,
GPUV conversion, supply, category-cap, and issuance parameter package
at `packages/sunrey-chain/src/productive/policy-governance/value-function/production-candidate`,
`packages/sunrey-chain/src/productive/policy-governance/value-settlement/production-candidate`,
and `packages/sunrey-chain/src/economics/production-activation`.
Capability `moonrey-production-issuance-policy-candidate` is
`IMPLEMENTED` on the existing productive-value and monetary owners.
The package does not invent GPUV values, conversion rates, or
tokenomics and does not activate MoonRey issuance. Chunk 71 remains
the mint. Do not create `packages/moonrey-production-tokenomics`,
`packages/gpuv-conversion`, `packages/moonrey-issuance-policy`,
`packages/production-value-function`, or
`packages/moonrey-production-policy`. The evaluator returns
`mustStop: false`.
Chunk 142 migrates current public runtime and display identity to
SunRey at `packages/config`. Capability
`sunrey-canonical-product-identity` is `IMPLEMENTED`. Canonical env
names are `SUNREY_*`. Legacy `SOLSTICE_*` aliases remain through the
single config authority. Protocol IDs, hash domains, stored event
schema refs, and `reyesnick54/solstice` are unchanged. See
[`sunrey-naming-migration.md`](./sunrey-naming-migration.md).
The evaluator returns `mustStop: false`.
Chunk 152 connects fixture Identity/KYC, sanctions/PEP, AML, Travel
Rule, case-management, and market-surveillance provider-candidate
adapters to existing domain ports. Capability
`sunrey-regulated-provider-candidates` is `IMPLEMENTED`. It does not
replace `identity`, `compliance-screening`, `custody`, or
`market-surveillance`. Provider output never issues Execution
Authority. Do not create `packages/kyc`, `packages/aml`,
`packages/sanctions`, `packages/compliance-v2`, `packages/regtech`,
`packages/travel-rule-v2`, or `packages/surveillance-v2`. The
evaluator returns `mustStop: false`.
Chunk 151 implements banking, payment-rail, and FX provider
production candidates at `packages/payments/src/production-candidate`.
Capability `sunrey-banking-payment-provider-candidates` is
`IMPLEMENTED` on the existing payments owner. The chunk adds
`PAYMENT_RAIL` and `FX_LIQUIDITY` to the existing provider-acceptance
taxonomy and reuses `RailAdapter`. Sandbox / fixture transport only.
It does not connect a real bank, payment network, or FX provider, and
an engineering rail class is not named-network membership. Do not
create `packages/banking-v2`, `packages/baas`,
`packages/payment-provider`, `packages/swift`, `packages/ach`,
`packages/fx-v2`, or `packages/cross-border-core`. The evaluator
returns `mustStop: false`.
Chunk 150 implements external economic oracle provider
production-candidate profiles, transport blueprints, onboarding
packets, and revalidation at
`packages/sunrey-chain/src/oracle/production/external-provider-candidate`.
It extends `sunrey-production-oracles`,
`sunrey-provider-certification`, and
`sunrey-economic-data-connector-runtime`. Injected fake transports
only. No real network calls. The evaluator returns `mustStop: false`.
Do not create `packages/external-oracle-providers`,
`packages/oracle-provider-candidates`, or
`packages/external-economic-oracles`. See
[`chunk-150-external-economic-provider-candidates.md`](./chunk-150-external-economic-provider-candidates.md)
and
[`docs/economics/chunk-150-external-economic-provider-candidates.md`](../economics/chunk-150-external-economic-provider-candidates.md).
Chunk 149 implements the production-candidate provider credential
plane at `packages/security/src/regulated/credentials`. Capability
`sunrey-production-provider-credential-plane` is `IMPLEMENTED` on the
existing security owner. Provider runtime remains
`packages/sunrey-chain`. A credential is not provider approval,
Execution Authority, a mint, or a ledger journal. Do not create
`packages/secrets`, `packages/credentials`,
`packages/provider-security`, `packages/provider-runtime-v2`,
`packages/external-connectivity`, or `packages/vendor-runtime`. The
evaluator returns `mustStop: false`.
Chunk 153 hardens dual-native-asset custody at `packages/custody` and
adds `packages/custody/src/provider-candidate`. Capability
`sunrey-dual-asset-custody-provider-candidate` is `IMPLEMENTED`.
HSM/KMS remain `packages/security`. Native supply remains Chunk 71
`AssetSupplyBook`. Provider credentials bind through the Chunk 149
credential plane. Do not create `packages/moonrey-custody`,
`packages/sunrey-custody-v2`, `packages/key-vault`, `packages/hsm-v2`,
`packages/mpc-v2`, or `packages/custody-provider-v2`. The evaluator
returns `mustStop: false`.
Chunk 158 implements the full-platform production-candidate burn-in,
cross-system reconciliation, readiness evidence bundle, and handoff
gate at
`packages/sunrey-chain/src/production-handoff/full-platform-candidate`.
It extends `sunrey-production-handoff`. It does not create a second
release authority or activate production. `PRODUCTION_ACTIVE` is not
an outcome. The evaluator returns `mustStop: false`. Do not create
`packages/full-platform`, `packages/mainnet-v2`,
`packages/production-ready`, `packages/launch-v2`,
`packages/system-rc`, or `packages/sunrey-production`. See
[`chunk-158-full-platform-production-candidate.md`](../operations/chunk-158-full-platform-production-candidate.md).
Chunk 156 extends `packages/sunrey-chain/src/ops` with a unified
production-candidate control room at `src/ops/control-room`.
Capability `sunrey-unified-control-room` is `IMPLEMENTED`. It is a
read/operations plane and does not post ledger, mint, issue Execution
Authority, or enable `LIVE_*` flags. Do not create
`packages/observability`, `packages/control-room`,
`packages/sunrey-ops`, or `packages/sre`. The evaluator returns
`mustStop: false`. See
[`docs/operations/chunk-156-sunrey-control-room.md`](../operations/chunk-156-sunrey-control-room.md).
Chunk 155 implements distributed idempotency, external side-effect
recovery, transactional workflow safety, and cross-domain reconciliation
at `packages/events/src/operation` with persistence in
`packages/persistence/src/operations`. Capability
`sunrey-distributed-idempotency-recovery` is `IMPLEMENTED`. The
canonical model is `EFFECTIVELY_ONCE_BY_IDEMPOTENCY_AND_RECONCILIATION`.
Do not create `packages/saga-engine`, `packages/workflow-v2`,
`packages/idempotency-service`, `packages/transaction-manager`,
`packages/distributed-ledger`, or `packages/exactly-once`. The evaluator
returns `mustStop: false`.
Chunk 154 hardens operational persistence, crash recovery, state
rehydration, and the repository integrity gate at
`packages/persistence/src/production/recovery`. Capability
`sunrey-operational-persistence-recovery` is `IMPLEMENTED` on
`packages/persistence`. It does not create a second ledger or mint.
Do not create `packages/database-v2`, `packages/state-store`,
`packages/durable-state`, `packages/operational-ledger`,
`packages/financial-database`, or `packages/persistence-v2`. The
evaluator returns `mustStop: false`.
Chunk 162 implements the production provider binding manifest at
`packages/sunrey-chain/src/providers/production-binding`. Capability
`sunrey-production-provider-binding` is `IMPLEMENTED`. It extends
provider acceptance and provider runtime. Connectivity stays
disabled. The evaluator returns `mustStop: false`. Do not create
`packages/integrations-v2`, `packages/vendor-connectivity`,
`packages/provider-manager`, or `packages/live-providers`. See
[`docs/operations/chunk-162-production-provider-binding.md`](../operations/chunk-162-production-provider-binding.md).
