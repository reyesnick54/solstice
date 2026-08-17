# Blockchain storage engine

## Decision

**Selected engine:** [redb](https://github.com/cberner/redb) **2.4.0**
(MIT / Apache-2.0).

redb is a crash-safe, copy-on-write B-tree embedded database with
multi-table atomic transactions and an explicit `Durability::Immediate`
fsync policy.

## Why not RocksDB

RocksDB is the usual blockchain default. It was rejected here because:

- the workspace toolchain is Rust **1.83 / edition 2021**
- RocksDB requires cmake, clang, and a C++ toolchain in every CI job
- redb 2.6+ requires Rust 1.85 / edition 2024, so the crate is pinned
  to **2.4.0**

## Supply-chain impact

- New Rust crate: `redb = "=2.4.0"` in
  `packages/sunrey-chain/rust/Cargo.toml`
- Pure Rust plus `libc` (already in the graph)
- No C/C++ native module, no new npm package
- TCB: a supply-chain compromise of redb can corrupt or fork local
  chain state. Operators must pin and review `Cargo.lock`.

## When data is durably committed

With `DurabilityPolicy::PRODUCTION_CANDIDATE` (`ImmediateFsync`), a
write is durable after the redb write transaction returns `Ok`. WAL and
data pages have been fsynced. `Eventual` and `None` exist only for
development / benchmarks.

## Namespaces

Logical domains are separate tables: blocks, block metadata, consensus
metadata, state, validator history, evidence, governance, transaction
lookup, interop, native-asset, oracle/productive, and commit records.
State-root semantics remain the Merkle commitment over the canonical
state map.

## WAL domains

| Domain | Owner | Property |
| --- | --- | --- |
| Consensus WAL | `sunrey-consensus` | append-only; do not rewind |
| Application state commit | `sunrey-storage` | atomic finalized economic state |
| Signer-safety DB | consensus / validators | monotonic high-watermark |

These are not interchangeable.
