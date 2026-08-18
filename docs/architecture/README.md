# Architecture

- [Constitution](./constitution.md) — canonical owners, boundaries, and dependency direction
- [Manifest](./manifest.json) — machine-readable enforcement input
- [ADR index](./adr/README.md) — decision records (not renumbered)
- [Chunk dependencies](./chunk-dependencies.md) — stop if a protected requirement is not IMPLEMENTED
- [Chunk 12 stop (historical)](./chunk-12-stop.md) — original stop while Cards was PLANNED
- [Chunk 12 resume](./chunk-12-resume.md) — wallet / Tap-to-Pay implemented after Cards merged
- [Chunk 13 stop (historical)](./chunk-13-stop.md) — original process-gate stop before treasury existed
- [Chunk 13 resume](./chunk-13-resume.md) — treasury / liquidity / routing intelligence implemented
- [Chunk 15 stop (historical)](./chunk-15-stop.md) — original stop while Treasury was still PLANNED; agent later landed as proposal-only
- [Historical PR guidance](./historical-implementation.md) — older PRs are not automatically canonical
- [PostgreSQL persistence fabric](./persistence.md) — durable adapter behind existing ports
- [Durable event fabric](./events.md) — envelope, outbox, inbox, replay, delivery semantics
- Policy engine — `packages/kernel/src/policy/` (ADR-0006 Option C, simulation only)
- [Compliance screening fabric](./compliance.md) — AML, sanctions, PEP, TM, fraud, cases (ADR-0010)
- [Security and cryptography](./security.md) — KeyProvider, secrets, envelopes, key lifecycle
- Identity lives in `packages/identity` (Chunk 5). ADR-0007 remains PROPOSED.
- [Personal Economic Graph](./economic-graph.md) — first SFF 2.0 intelligence layer. Does not execute.
- Growth Orchestrator and mandates live in `packages/platform` (Chunk 16). The Personal Economy Agent lives in `packages/agent`. Neither executes. ADR-0012 remains PROPOSED.
- Regulatory Digital Twin lives in `packages/regulatory-twin` (Chunk 18). Simulation/counterfactual only. Not a second Kernel or policy engine.
- Personal Economic Value Engine lives in `packages/platform/src/value` (Chunk 17). Measurement only. ADR-0013 remains PROPOSED.

- [Privacy Clean Room](./clean-room.md) — consent-gated computation at
  `packages/clean-room`. Historical stop:
  [`chunk-25-stop.md`](./chunk-25-stop.md). Resume:
  [`chunk-25-resume.md`](./chunk-25-resume.md).
- [SunRey Coin](./sunrey-coin.md) — simulation economic ledger at
  `packages/sunrey-coin`. Historical stop:
  [`chunk-26-stop.md`](./chunk-26-stop.md). Resume:
  [`chunk-26-resume.md`](./chunk-26-resume.md). Public ticker is
  UNDECIDED.
- [SunRey Chain](./sunrey-chain.md) — simulation trust layer at
  `packages/sunrey-chain`. Not the financial source of truth.
  ADR-0015 remains PROPOSED.
- [Chunk 31 production architecture freeze](./chunk-31-sunrey-blockchain-production-architecture.md)
  — protocol ADR pack, authority matrix, and machine-readable spec.
  Production blockchain is not implemented.
- [SunRey chain authority matrix](./sunrey-chain-authority-matrix.md)
- [SunRey Blockchain protocol spec](./sunrey-blockchain-protocol.json)
- [Chunk 30 stop (historical)](./chunk-30-stop.md) — original stop while
  custody and market-surveillance were PLANNED
- [Chunk 30 resume](./chunk-30-resume.md) — custody, Travel Rule,
  listing governance, surveillance, and kill switches after Exchange
  core merged
- [Chunk 37 BFT consensus core](./chunk-37-bft-consensus-core.md) —
  development Tendermint-class engine at
  `packages/sunrey-chain/rust/crates/consensus`. Production consensus
  is not implemented.
- [Chunk 36 stop (historical)](./chunk-36-stop.md) — original
  reservation while the local node and P2P plane were absent
- [Chunk 36 resume](./chunk-36-resume.md) — validator registry,
  lifecycle, and signer safety at `packages/sunrey-chain`
- [Chunk 36 validator lifecycle](./chunk-36-validator-lifecycle.md)
- [Chunk 39 validator accountability](./chunk-39-validator-accountability.md)
  — equivocation evidence, jail, tombstone, simulation penalties
- [Chunk 40 protocol governance](./chunk-40-protocol-governance.md) —
  height-activated UpgradePlan. No governance token.
- [Chunk 45 machine economy](./chunk-45-machine-economy.md) —
  controller-bound machine identity and commerce.
  [Identity model](./machine-economic-identity.md).
  [Commerce protocol](./machine-commerce-protocol.md).
- [Chunk 49 universal economic exchange](./chunk-49-universal-economic-exchange.md) —
  four market families at `packages/sunrey-exchange`.
  [Market families](./exchange-market-families.md).
  [Information-right market](./information-right-market.md).
  [Compute market](./compute-capacity-market.md).
  [Productive capacity market](./productive-capacity-market.md).
- [Chunk 46 sovereign wallets](./chunk-46-sovereign-wallets.md) —
  addresses, BlockchainAccount authorization, multi-auth, recovery.
  [Address spec](./sunrey-address-spec.md).
  [Authorization](./blockchain-account-authorization.md).
- [Chunk 43 oracle network](./chunk-43-oracle-network.md) —
  signed observations and VerifiedEconomicFacts. Not money.
- [Oracle economic fact spec](./oracle-economic-fact-spec.md)
- [Chunk 77 protocol treasury](./chunk-77-protocol-treasury.md) —
  protocol-owned native reserves, budgets, and governed disbursements
- [Chunk 73 adaptive fee market](./chunk-73-adaptive-fee-market.md) —
  FeePolicyV2 resource pricing, disposition, anti-spam economics
- [Chunk 42 native fees](./chunk-42-native-fees.md) —
  resource metering, integer fee schedule, reservation/charge/release
- [SunRey resource metering](./sunrey-resource-metering.md)
- [Chunk 35 stop (historical)](./chunk-35-stop.md) — original
  documentation-only gate before the local node existed
- [Chunk 35 resume](./chunk-35-resume.md) — P2P / mempool / sync
  development network at `packages/sunrey-chain/node`
- [Chunk 34 stop (historical)](./chunk-34-stop.md) — original
  documentation-only gate
- [Chunk 34 resume](./chunk-34-resume.md) — local development node
  implemented inside `packages/sunrey-chain/rust`
- [Chunk 33 stop (historical)](./chunk-33-stop.md) — original
  process-gate stop before the CryptoSuite implementation.
- [Chunk 33R crypto-agility](./chunk-33-crypto-agility.md) —
  CryptoSuite registry, Ed25519, PQ ports, hybrid envelope, and
  policy at `packages/security`. Not quantum-proof.
- [Cryptographic inventory](../security/cryptographic-inventory.md)
- [SunRey Blockchain threat model](../security/sunrey-blockchain-threat-model.md)
- [Chunk 32 stop (historical)](./chunk-32-stop.md) — original
  process-gate stop before Chunk 31 architecture was canonical
- [Chunk 32 resume](./chunk-32-resume.md) — canonical transaction
  envelope, economic objects, protobuf codec, and test vectors at
  `packages/sunrey-chain`

- [Chunk 47 institutional custody](./chunk-47-institutional-custody.md)
  — native-asset vaults, remote/HSM signing, finalized deposits.
  [Signing architecture](./native-custody-signing.md).

- [Chunk 55 resilience and observability](./chunk-55-resilience-observability.md)
  — multi-failure-domain operations, backups, and DR drills at
  `packages/sunrey-chain/src/ops`.
- [Chunk 58 performance engineering](./chunk-58-performance.md)
  — sunrey-bench load, soak, and capacity measurements at
  `packages/sunrey-chain/src/perf`.
- [Chunk 56 fuzzing and property assurance](./chunk-56-assurance-fuzzing.md)
  — protocol fuzzing, property tests, differential drivers, and
  replay fixtures at `packages/sunrey-chain`. See
  [`docs/assurance/`](../assurance/chunk-56-fuzzing.md).
- [Chunk 51 developer platform](./chunk-51-developer-platform.md) —
  official SDK, versioned public API v1, and real-time events at
  `packages/sunrey-sdk`.
- [Chunk 57 adversarial range](./chunk-57-adversarial-range.md) —
  isolated cyber-economic attack simulator at `packages/sunrey-range`.
- [Chunk 62 audit readiness](./chunk-62-audit-readiness.md) —
  independent security-review bundle at
  `packages/sunrey-chain/src/audit`. See [`docs/audit/`](../audit/README.md).
- [Chunk 83 audit remediation](./chunk-83-audit-remediation.md) —
  findings ingestion, remediation, retest, and risk acceptance at
  `packages/sunrey-chain/src/audit/remediation`.
- [Chunk 80 economic mainnet rehearsal](./chunk-80-economic-mainnet-rehearsal.md)
  — complete economic launch rehearsal at
  `packages/sunrey-chain/src/economic-rehearsal`. See
  [`docs/mainnet/chunk-80-economic-mainnet-rehearsal.md`](../mainnet/chunk-80-economic-mainnet-rehearsal.md).
- [Chunk 85 production genesis ceremony](./chunk-85-production-genesis-ceremony.md)
  — production-genesis and validator-onboarding ceremony architecture
  at `packages/sunrey-chain/src/production-ceremony`. See
  [`docs/mainnet/chunk-85-production-genesis-ceremony.md`](../mainnet/chunk-85-production-genesis-ceremony.md).
- [Chunk 88 authorized genesis execution](./chunk-88-genesis-execution.md)
  — production genesis execution engine and launch control room at
  `packages/sunrey-chain/src/genesis-execution`. See
  [`docs/mainnet/chunk-88-genesis-execution.md`](../mainnet/chunk-88-genesis-execution.md).
- [Chunk 87 pre-genesis qualification](./chunk-87-pregenesis-qualification.md)
  — isolated production-like shadow network at
  `packages/sunrey-chain/src/pregenesis`. See
  [`docs/mainnet/chunk-87-pregenesis-qualification.md`](../mainnet/chunk-87-pregenesis-qualification.md).
- [Chunk 95 Exchange market operations](./chunk-95-market-operations.md)
  — institutional gateway, sequenced market data, risk controls,
  circuit breakers, and reopening auctions at
  `packages/sunrey-exchange/src/ops`.

Implementation inventory: [`docs/build-status.md`](../build-status.md).
