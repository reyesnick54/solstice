# SunRey Chain

Canonical owner: `packages/sunrey-chain`.

SunRey Chain is the simulation trust, provenance, permission,
attestation, policy, and settlement-anchor layer. It is not the
financial source of truth. Canonical ledger journals remain
authoritative. Chain balances are never authoritative.

## What this package does

- Accepts `ChainWriteIntent` records after classification and a
  default-deny policy gate.
- Commits only `ON_CHAIN_SAFE` hashes, scoped subject references, and
  public protocol metadata.
- Signs operations with the canonical `KeyProvider` purpose
  `CHAIN_OPERATION_SIGNING`.
- Submits through a `SunReyChainAdapter`. The only implemented adapter
  is `SimulationChainAdapter`.
- Tracks async finality, `CHAIN_SUBMISSION_UNKNOWN`, and reorg
  observation without rewriting ledger state.
- Reconciles source, intent, adapter, receipt, and finality. Mismatches
  are not auto-fixed.

## What this package does not do

- Post ledger journals or issue Execution Authority.
- Mint, transfer, or burn SunRey Coin.
- Invent a public ticker.
- Store raw PDV, PAN/CVV, health, genetic, or private-key material.
- Connect to a live RPC, mainnet, or testnet.
- Implement SunRey Exchange matching.

Network mode is `SIMULATION`. `DEVELOPMENT`,
`TEST_NETWORK_PLACEHOLDER`, and `PRODUCTION_DISABLED` exist as types
only. Production is disabled.

Engineering finality thresholds are an `ENGINEERING_FIXTURE` with
`RESEARCH_REQUIRED` counsel status. They are not a selected production
finality policy.

See ADR-0015. The simulation foundation remains `PROPOSED`.

Chunk 31 freezes the **production** architecture (ADR-0016 through
ADR-0033) without implementing a production node. Canonical spec:
[`sunrey-blockchain-protocol.json`](./sunrey-blockchain-protocol.json).
Authority split: [`sunrey-chain-authority-matrix.md`](./sunrey-chain-authority-matrix.md).
MoonRey Coin is a distinct planned native asset. Its ticker is
`NOT_ASSIGNED`. Do not invent a ticker. Do not claim the chain is
production-ready, quantum-secure, decentralized, or mainnet-ready.
