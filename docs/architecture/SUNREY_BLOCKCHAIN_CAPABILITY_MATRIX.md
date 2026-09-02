# SunRey Blockchain Capability Matrix

Status: Wave 2 completion audit (2026-09-02)  
Scope: sovereign blockchain **core** in `packages/sunrey-chain` — simulation / development / testnet rehearsal only.  
Legend: **IMPLEMENTED** · **PARTIAL** · **SIMULATION** · **TEST ONLY** · **NOT IMPLEMENTED** · **BLOCKED**

Production mainnet is **NOT IMPLEMENTED** and **BLOCKED** by layered gates. This matrix does not claim public mainnet readiness.

---

## Core state and execution

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Canonical deterministic state | IMPLEMENTED | `rust/crates/state`, `rust/crates/execution`; `node/tests/determinism.rs` |
| Native asset state | IMPLEMENTED | `rust/crates/native-assets`; dev/test only |
| Supply authority | IMPLEMENTED | `native-assets/authority.rs`, `docs/architecture/native-asset-authority-boundary.md`, ADR-0031 |
| Transactions | IMPLEMENTED | `rust/crates/protocol`, `src/protocol/` |
| Signatures | IMPLEMENTED | `rust/crates/crypto`, `packages/security` CryptoSuite |
| Nonces | IMPLEMENTED | Protocol envelope + native-asset ledger |
| Replay protection | IMPLEMENTED | Idempotency keys, issuance replay registry, cross-network guards |
| Mempool | PARTIAL | `packages/sunrey-chain/node/src/mempool/` — dev P2P only |
| Block model | IMPLEMENTED | `rust/crates/protocol/src/block.rs` |
| Transaction commitment | IMPLEMENTED | Deterministic `transaction_root` in block header |
| Monetary state commitment | IMPLEMENTED | `app_hash` via `ChainView`; native-asset supply reconciliation |

---

## Persistence and recovery

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Persistence | IMPLEMENTED | `rust/crates/storage` (redb production-candidate engine) |
| Genesis | IMPLEMENTED | Versioned genesis in `protocol/genesis.rs`; MAINNET fail-closed |
| Snapshots | IMPLEMENTED | `storage/snapshot.rs`, `create_production_snapshot` |
| Recovery | IMPLEMENTED | WAL recovery, snapshot restore, `assert_state_root`; `runtime/recovery.ts` rehearsal |
| Derived-index deletion/rebuild | PARTIAL | `storage/rebuild.rs` — state root rebuild tested; not all derived indexes |

---

## Validators and consensus

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Validator identities | IMPLEMENTED | `rust/crates/validators`, `src/validators/` |
| Validator set | IMPLEMENTED | `validators/set.rs`, dev four-validator harness |
| Consensus | IMPLEMENTED | `rust/crates/consensus` + `node/src/consensus/` (dev/test) |
| BFT fault tolerance | SIMULATION | Tendermint-family BFT in local four-validator harness; not production network |
| Finality | IMPLEMENTED | `protocol/finality.rs` — `FINALIZED` only on `CommitCertificate`; engineering semantics documented |
| Block sync | PARTIAL | P2P gossip + catch-up in dev node; no production sync service |
| State sync | NOT IMPLEMENTED | Planned in ADR-0016; dev restart-from-disk only |
| RPC | SIMULATION | `rust/crates/rpc` — local dev; untrusted plane |
| Observability | PARTIAL | Metrics in consensus/node; production control room separate |

---

## Protocol and environment

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Protocol versioning | IMPLEMENTED | `schema_version`, `codec_id`, `protocol_version` in envelopes |
| Environment isolation | IMPLEMENTED | `network_id` / `chain_id` registry; cross-network replay rejection |
| Mainnet activation | BLOCKED | Layered gates: flags, genesis, economic firewall, launch freeze, production gates |

---

## Wave 3 / 4 — Economic Proof Architecture (not Wave 2 scope)

| Capability | Status | Notes |
| --- | --- | --- |
| Evidence Root | NOT IMPLEMENTED | ADR-0032 schema; anchoring family in dev execution only |
| Rights Root | NOT IMPLEMENTED | Access Fabric commitments separate; no canonical Rights Root |
| Policy Root | NOT IMPLEMENTED | Kernel policy authority; chain stores optional anchors only |
| Economic Claims | PARTIAL | Wave 3 proof lattice at `src/economic-proof`; durable registry and roots pending |
| Information Consensus | NOT IMPLEMENTED | HIN / information-market off-chain; no on-chain information consensus |

---

## Asset isolation (explicit)

| Asset | Native chain state | Application ledger | Isolation evidence |
| --- | --- | --- | --- |
| SUNREY_COIN | IMPLEMENTED (dev) | IMPLEMENTED (`packages/sunrey-coin`) | Separate asset id, issuance policy, supply books; `native_assets.rs` tests |
| MOONREY_COIN | IMPLEMENTED (dev) | NOT IMPLEMENTED (no app package) | `moonreyIssuanceActivated(): false` at protocol layer; distinct registry entry |

---

## Authority summary

| Forbidden monetary authority | Status |
| --- | --- |
| Frontend / Consumer BFF | FAIL CLOSED — orchestration only |
| Exchange / Exchange DB | FAIL CLOSED — red-team tests |
| Operational PostgreSQL | FAIL CLOSED — not chain canonical store |
| AI agent | FAIL CLOSED — no Execution Authority from agent |
| HIN / PEVE / GPUV / oracle / external provider | FAIL CLOSED — observations ≠ money |
| Validator without monetary authorization | FAIL CLOSED — consensus boundary test |
| Consensus agreement alone | FAIL CLOSED — does not issue supply |
