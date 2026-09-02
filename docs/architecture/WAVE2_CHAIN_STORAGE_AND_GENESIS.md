# Wave 2 — Chain Storage and Genesis

**Status:** Wave 2 Prompt 2 engineering specification  
**Environment:** `simulation`; all `LIVE_*` flags remain `false`  
**Legal posture:** `RESEARCH_REQUIRED`

Canonical companions:

- [`SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md`](./SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md)
- [`SUNREY_MONETARY_AUTHORITY_CONTRACT.md`](./SUNREY_MONETARY_AUTHORITY_CONTRACT.md)
- [`adr/ADR-0022-sunrey-blockchain-storage-model.md`](./adr/ADR-0022-sunrey-blockchain-storage-model.md)
- [`../storage/chunk-67-production-storage.md`](../storage/chunk-67-production-storage.md)

---

## 1. Storage boundary

### Canonical owner

Consensus-critical chain persistence lives in **`packages/sunrey-chain/rust/crates/storage`** (`ChainStore`), not in application PostgreSQL.

| Plane | Owner | Role |
| --- | --- | --- |
| **Chain monetary / protocol state** | `ChainStore` (redb 2.4 production-candidate engine) | Blocks, headers, canonical `ChainView`, native asset ledger bytes, indexes |
| **Application Solstice state** | `packages/persistence` (`solstice_*` databases) | Customer, ledger journals, evidence, security metadata |
| **Simulation trust-layer snapshots** | `InMemorySunReyChainStore` / `persistSunReyChainState` | Write intents and reconciliation records — **not** consensus authority |

`packages/persistence/src/sunrey-chain/pg-sunrey-chain-store.ts` persists simulation chain **write intents** for the trust-layer adapter. It does not replace `ChainStore` and must not become the protocol.

### `ChainStore` responsibilities

- Versioned **genesis** (`GenesisV1`) and deterministic **genesis hash** / network fingerprint
- Append-only **blocks** and **headers** with Merkle **transaction roots**
- Canonical **state** (`ChainView` / `ObjectStore`) and **state commitments** (`app_hash`)
- **Transaction receipts** (signed envelopes in block bodies) and **tx lookup indexes**
- **Chain meta**: height, tip block id, finalized height (tip in local dev), schema version
- **Native asset supply state** (serialized `NativeAssetLedger` under `NS_ASSET`)
- **Validator / consensus metadata** projections (governance hashes in headers; consensus namespaces reserved)
- Checksum-wrapped records, integrity verification, snapshot export/restore

Indexes (`ns_tx_lookup`, block-by-id map) are **conveniences**. They are rebuilt from block history and never act as a second monetary authority.

### Engine decision

**redb 2.4.0** — pure-Rust ACID embedded KV with multi-table atomic transactions and fsync durability. RocksDB was rejected for CI/toolchain portability. A legacy **file-store** backend remains for migration source only.

---

## 2. Atomicity

Block commitment is **one logical transaction**:

1. Execute transactions into a provisional `ChainView`
2. Compute `app_hash`, `transaction_root`, block id
3. Atomically persist: block body, header meta, state map, native asset bytes, tx indexes, chain meta

Fail points (`FailPoint`) in tests prove crash safety:

| Failure point | Canonical effect |
| --- | --- |
| Before execution / during execution | No block; prior state unchanged |
| Before DB commit / during persistence / during state write | No block; prior state unchanged |
| After commit (before response) | Block and state **retained** |

Partial states (block without matching `app_hash`, supply without tx record) are rejected at startup via `validate_canonical_startup`.

---

## 3. Genesis specification

Genesis is **`GenesisV1`** (`packages/sunrey-chain/rust/crates/protocol/src/genesis.rs`).

### Included fields (network bootstrap only)

| Field | Purpose |
| --- | --- |
| `network_id`, `chain_id` | Network identity separation |
| `protocol_version`, `codec_id`, `schema_registry_hash` | Wire and schema compatibility |
| `crypto_policy_id`, `state_schema_version` | Crypto agility and state layout |
| `genesis_time_unix_ms`, `block_interval_ms` | Time model (deterministic in dev) |
| `max_tx_bytes`, `max_block_txs`, `queue_bound` | Admission bounds |
| `validator_placeholder` | Dev / testnet set label (not production keys) |
| `native_assets` | Asset ids, ticker status, **genesis_supply** (0 in local dev), implemented flag |
| `activated_families` | Permitted transaction families |
| `production_network_enabled` | Must be `false`; decode rejects `true` |
| `environment` | Must be `simulation` for engineering networks |

### Development / local configuration

`local_dev_genesis()` — `chn_sunrey_local_dev` / `net_sunrey_local_dev`:

- Zero genesis supply for `SUNREY_COIN` and `MOONREY_COIN`
- Tickers `NOT_ASSIGNED`
- Faucet issuance only under `DEVELOPMENT_FAUCET_POLICY` in simulation
- No application balance import

Additional engineering profiles: `devnet_genesis`, `testnet_1_genesis`, `preproduction_genesis`.

### Production genesis

`mainnet_genesis()` and `generate_genesis(Mainnet)` **fail closed** (`GovernanceRejected`). Production allocations, simulation balances, and application ledger imports are **forbidden** in this wave.

---

## 4. Genesis hash / network fingerprint

Canonical encoding: `GenesisV1::encode()` → domain-separated hash `genesis_hash(hasher, &genesis)` (`DOMAIN_GENESIS`).

Validators joining a network must present the same genesis bytes fingerprint. Changing consensus-critical fields (chain id, protocol version, native asset definitions, bounds, etc.) changes the fingerprint.

At height 0, `tip_block_id` equals the genesis hash hex. Stored genesis must match the expected fingerprint at node startup.

---

## 5. Canonical persistence and recovery

### Stop → restart flow

1. `LocalNode::open` → `ChainStore::open`
2. `validate_canonical_startup` — integrity checksums, genesis fingerprint, tip linkage, state root rebuild
3. Native asset `reconcile_all` — supply conservation
4. `verify_chain` — parent hash chain, header commitments, tx roots

No recreation of supply from PostgreSQL or application databases.

### Reconstruction

- **From persisted state:** `rebuild_state_root` recomputes `app_hash` from `ChainView`; must match `ChainMeta.app_hash`
- **From history:** `verify_chain` validates each header against parent, tx root, and recorded `app_hash` at tip
- **From snapshot:** `create_production_snapshot` / `restore_production_snapshot` with manifest hash verification before availability

State is **not** trusted from raw deserialization alone; commitments are checked against recomputation and header linkage.

---

## 6. Indexes

| Index | Key | Value | Authority |
| --- | --- | --- | --- |
| Block by height | `ns_blocks` height BE | Checksum-wrapped block bytes | Convenience |
| Block by id | `ns_block_meta` block id hex | Height | Convenience |
| Tx by id | `ns_tx_lookup` tx id hex | Height | Convenience |
| State | `ns_state` | Object store entries | **Authoritative** with `app_hash` |
| Native asset | `ns_native_asset` | Ledger bytes | **Authoritative** within state |

---

## 7. Corruption detection (fail-closed startup)

`ChainStore::validate_canonical_startup` and `LocalNode::open` reject:

| Condition | Rejection |
| --- | --- |
| Checksum / table corruption | `CorruptStore` |
| Genesis fingerprint mismatch | `IncompatibleProtocol` |
| `app_hash` ≠ recomputed state root | `WrongStateRoot` |
| Tip block id ≠ block id at height | `CorruptStore` |
| Missing / corrupt block at height | `CorruptStore` / `NotFound` |
| Broken parent chain | `IncorrectParent` (via `verify_chain`) |
| Wrong tx root / state root in header | `WrongTransactionRoot` / `WrongStateRoot` |
| Native supply inconsistency | `SupplyInconsistency` |

Validators do not silently continue on corrupted canonical state.

---

## 8. Migration boundaries

Explicit gates remain **false** (TypeScript and Rust authority boundary):

| Gate | Location | Value |
| --- | --- | --- |
| `applicationSupplyImported` | `native-assets/authority.ts` | `false` |
| `productionMigrationPerformed` | `native-assets/migration.ts` | `false` |
| `mainnetEconomicsAuthorized` | production activation firewall | not activated |

- **No** simulation supply import in this prompt
- **No** PostgreSQL ledger → chain supply migration
- File-store → production redb migration (`migrate_file_store_to_production`) preserves fingerprints for engineering only; `engineering_only` and `not_testnet_to_production` flags apply

---

## 9. Tests

| Suite | Coverage |
| --- | --- |
| `storage/tests/production.rs` | Atomic commit, crash points, corruption, snapshot, state root rebuild, migration |
| `node/tests/atomicity.rs` | Node-level fail points |
| `node/tests/restart_persistence.rs` | Genesis restart, lifecycle restart, state hash, corruption, genesis mismatch, interrupted commit |
| `node/tests/determinism.rs` | Independent nodes match commitments |
| `rpc/tests/restart.rs` | Process restart with HTTP node |
| `protocol/genesis.rs` tests | Genesis encoding stability and fingerprint sensitivity |

---

## 10. Recovery assumptions

- Single-node local development: tip height is finalized height
- Queue (`queue.bin`) is non-authoritative; may be lost on crash without affecting committed blocks
- Governance / oracle side files are reloaded separately; they do not override chain supply
- Backup unit: `chain.redb` + genesis sidecar + optional snapshots with manifest hashes
- Restore: verify snapshot → open store → `validate_canonical_startup` → `verify_chain`

---

## 11. Unresolved risks

| Risk | Mitigation path |
| --- | --- |
| Multi-validator BFT finality vs local dev producer | Wave 2 consensus prompt; separate finalized height semantics |
| Evidence / Rights / Policy roots in blocks | Wave 3 commitment model before root integration |
| PostgreSQL adapter for chain (optional) | Must implement `ChainStore` port, not duplicate supply |
| Legal retention vs append-only chain | PDV/crypto-shred; no block rewrite (`RESEARCH_REQUIRED`) |
| Production genesis ceremony | Chunks 164–165; engineering genesis remains fail-closed |

---

*End of Wave 2 chain storage and genesis specification.*
