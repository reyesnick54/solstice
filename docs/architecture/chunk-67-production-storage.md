# Chunk 67 — Production-class storage and database durability

Chunk 67 replaces development-only durability assumptions with a
production-candidate storage architecture.

## Owners

- Blockchain storage: `packages/sunrey-chain/rust/crates/storage`
- Application PostgreSQL: `packages/persistence`
- Operator CLI / readiness: `packages/sunrey-chain/src/ops` and
  `packages/sunrey-chain/src/mainnet`

## Authority boundaries

- Finalized SunRey chain state remains the native-asset authority.
- `Ledger.postJournal` remains the fiat / application financial authority.
- Application PostgreSQL is not consensus state.
- Events, custody metadata, and exchange reservations are not journals.

## Forbidden packages

Do not create `packages/blockchain-db`, `packages/chain-storage-v2`,
`packages/sunrey-ledger-db`, `packages/sunrey-ops`, or a second ledger.

## Engine

The production-candidate engine is **redb 2.4.0**, a pure-Rust ACID
embedded KV store. RocksDB was considered and rejected because this
workspace's Rust 1.83 CI cannot compile a C++ storage engine.

## Status

Engineering verification only. This chunk does not deploy a managed
database provider, enable `LIVE_*` flags, or migrate testnet state into
production genesis.
