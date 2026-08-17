# Chunk 67 production storage

SunRey now has a production-candidate storage architecture:

1. **Chain store** — `redb` behind `StorageEngine` / `ChainStore` in
   `packages/sunrey-chain/rust/crates/storage`.
2. **Application PostgreSQL** — TLS, secret references, pooling,
   migration control, replica roles, and local PITR readiness in
   `packages/persistence/src/production`.
3. **Ops** — `sunrey-ops storage *` and `sunrey-ops database *`.

A finalized block commit writes the block, transaction results, state
changes, state root, protocol version, and commit metadata in one
engine transaction. A crash yields the previous valid commit or the new
valid commit, never a partial economic state.

Development file-store directories can be migrated into redb. That
migration is engineering-only and is not a testnet-to-mainnet path.

Engineering verification does not imply a production provider
deployment.
