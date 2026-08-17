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
| sunrey-validator-economics | IMPLEMENTED | packages/sunrey-chain |
| sunrey-protocol-governance | IMPLEMENTED | packages/sunrey-chain |
| sunrey-machine-economy | IMPLEMENTED | packages/sunrey-chain |
| sunrey-productive-capacity | IMPLEMENTED | packages/sunrey-chain |
| moonrey-issuance-engine | IMPLEMENTED | packages/sunrey-chain |
| sunrey-oracle-network | IMPLEMENTED | packages/sunrey-chain |
| sunrey-native-assets | IMPLEMENTED | packages/sunrey-chain |
| sunrey-native-fees | IMPLEMENTED | packages/sunrey-chain |
| sunrey-interop | IMPLEMENTED | packages/sunrey-chain |
| sunrey-exchange-native-settlement | IMPLEMENTED | packages/sunrey-exchange |
| sunrey-institutional-custody | IMPLEMENTED | packages/custody |
| sunrey-sovereign-wallets | IMPLEMENTED | packages/sunrey-chain |
| sunrey-validator-operations | IMPLEMENTED | packages/sunrey-chain |
| sunrey-public-testnet | IMPLEMENTED | packages/sunrey-chain |
| sunrey-explorer | IMPLEMENTED | packages/sunrey-explorer |
| sunrey-developer-sdk | IMPLEMENTED | packages/sunrey-sdk |
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
| sunrey-formal-assurance | IMPLEMENTED | packages/sunrey-chain |
| sunrey-regulated-integration | IMPLEMENTED | packages/sunrey-exchange |
| sunrey-production-oracles | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-storage | IMPLEMENTED | packages/sunrey-chain |
| sunrey-production-infrastructure | IMPLEMENTED | packages/sunrey-chain |

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
Do not create `packages/red-team`, `packages/attack-sim`, or
`packages/sunrey-pentest`. The evaluator returns `mustStop: false`.
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
Chunk 61 implements bounded TLA+/TLC protocol models, selected Rust
bounded verification, and implementation-trace conformance at
`packages/sunrey-chain`. Capability `sunrey-formal-assurance` is
`IMPLEMENTED`. See
[`chunk-61-formal-models.md`](./chunk-61-formal-models.md).
Results are model checked within stated bounds. Do not create
`packages/formal`, `packages/tla`, `packages/model-checker`,
`packages/sunrey-formal`, or `tools/formal`. The evaluator returns
`mustStop: false`.
