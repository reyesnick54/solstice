# Chunk 34R — SunRey local development node

This resume implements the sovereign **local development** SunRey
Blockchain node inside the canonical owner `packages/sunrey-chain`.

The earlier documentation-only gate
[`chunk-34-stop.md`](./chunk-34-stop.md) is **historical**. It recorded
that Chunks 31–33 had not merged when that stop was written. Chunk 31
architecture (ADR-0016–ADR-0033) is now on `main`. This change set
implements the node against those ADRs and the SRCB v1 schemas under
`packages/sunrey-chain/schemas/`.

## What landed

Rust workspace `packages/sunrey-chain/rust/`:

| Crate | Role |
| --- | --- |
| `sunrey-protocol` | EnvelopeV1, GenesisV1, BlockHeader/Body/Result, SRCB codec, commitments |
| `sunrey-crypto` | CryptoSuite port + `SUNREY_DEV_ED25519_SHA256` simulation provider |
| `sunrey-state` | Deterministic prefixed object store |
| `sunrey-execution` | SYSTEM and EVIDENCE_ANCHOR native modules |
| `sunrey-storage` | Crash-safe file store, WAL discard, checkpoints |
| `sunrey-node` | Admission, local queue, `DEV_BLOCK_PRODUCER` |
| `sunrey-rpc` | Loopback HTTP API and `sunrey-node` CLI |

TypeScript simulation trust layer is unchanged. A reference SRCB codec
lives at `packages/sunrey-chain/src/local-node/codec.ts` so encoding
vectors match Rust.

Capability `sunrey-local-node` is `IMPLEMENTED`. Production modules
`blockchain-node`, `blockchain-consensus`, and P2P remain `PLANNED`.
`productionBlockchainImplemented` stays `false`.

## What this is not

Not production BFT, not a public network, not MoonRey issuance, not a
second financial ledger, and not a competing package
(`packages/sunrey-node` / `packages/sunrey-blockchain` were not
created). Canonical `Ledger.postJournal` remains the money-movement
path. Genesis native-asset supply is zero.

See [`chunk-34-sovereign-node-core.md`](./chunk-34-sovereign-node-core.md)
and [`docs/runbooks/local-sunrey-node.md`](../runbooks/local-sunrey-node.md).
