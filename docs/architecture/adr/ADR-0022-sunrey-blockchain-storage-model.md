# ADR-0022 — SunRey Blockchain storage model

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0016, ADR-0019, ADR-0021
- Implementation status: IMPLEMENTED (production-candidate redb 2.4 engine in packages/sunrey-chain/rust/crates/storage; file store retained as migration source)

## Context

A production node needs crash-safe, replayable storage. The current
`InMemorySunReyChainStore` is a simulation. PostgreSQL in
`packages/persistence` is the durable adapter for Solstice
application state. It must not be silently reused as the blockchain
state database in a way that makes chain rows a second ledger.

## Decision

1. Production node storage is an internal module of
   `packages/sunrey-chain`, not `packages/persistence` as a second
   chain, and not a new `packages/on-chain-ledger`.
2. Logical stores:
   - **Block store:** append-only finalized blocks and headers.
   - **State store:** authenticated tree (Merkle-class or
     Jellyfish-class) whose root is `app_hash`.
   - **Write-ahead log:** consensus and execution WAL for crash
     recovery.
   - **Evidence / index projections:** rebuildable, not
     authoritative.
3. Pruning may drop historical *execution traces* after a configured
   height if the `app_hash` chain and block headers remain
   verifiable. Pruning must not delete the only copy of a Kernel
   evidence record (those live in the Evidence Vault).
4. Checksums and replay from genesis (or from a documented snapshot
   + header proof) must reproduce `app_hash`.
5. Application PostgreSQL databases (`solstice_ledger`,
   `solstice_evidence`, …) remain application stores. Chain storage
   must not write `Ledger` journals.

## Alternatives considered

- **Use PostgreSQL as the only chain store.**
- **IPFS / content-addressed public storage as primary state.**
- **Store balances on Account rows.**

## Why rejected

- PostgreSQL can back a later adapter, but treating SQL tables as
  consensus state without an authenticated app-hash invites silent
  edits. If used, it is an implementation of the storage port, not
  the authority.
- Public content-addressed networks add availability and legal
  exposure without solving consensus.
- Account balances are already forbidden on the domain Account.

## Security implications

A writable admin path on the state store is a consensus bypass.
Snapshots must be hash-chained to headers. Supply-chain compromise of
the storage engine is in the TCB.

## Compliance implications

Data-retention and right-to-erasure collide with append-only blocks.
The protocol stores commitments, not raw PDV. Erasure of personal
data remains a PDV/crypto-shred problem, not a block rewrite.
`RESEARCH_REQUIRED`.

## Operability implications

Backup is headers + state snapshots + WAL. Restore is verify then
replay. Operators must not "fix" state with SQL.

## Migration implications

In-memory simulation snapshots are not portable production state.

## Unresolved questions

- Concrete tree (IAVL, JMT, or another authenticated structure).
- Concrete tree remains the existing Merkle commitment over the state map.
- Embedded engine selected in Chunk 67: redb 2.4.0 (RocksDB rejected for CI/toolchain compatibility).

## Status

`ACCEPTED_FOR_ENGINEERING` for append-only blocks plus authenticated
state. Production-candidate storage: **implemented** in Chunk 67.
Legal confidence: `RESEARCH_REQUIRED`.
