//! Production-candidate chain store. Not the customer PostgreSQL financial database.
//!
//! Engine decision: **redb 2.4** (pure-Rust ACID embedded KV). RocksDB was
//! considered and rejected for this workspace because it requires a C++
//! toolchain in CI. redb supplies multi-table atomic transactions and fsync
//! durability. See `docs/storage/blockchain-storage-engine.md`.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sunrey_protocol::{
    block_id, genesis_hash, hash_from_hex, hash_to_hex, BlockHeader, DomainHasher, GenesisV1,
    Hash32, RejectReason, SignedTransaction,
};
use sunrey_state::ChainView;

mod checksum;
mod durability;
mod engine;
mod file_store;
mod migration;
mod namespaces;
mod rebuild;
mod redb_engine;
mod schema;
mod snapshot;
mod wal;

pub use checksum::{sha256_hex, unwrap_checksum, wrap_checksum};
pub use durability::{DurabilityClass, DurabilityPolicy};
pub use engine::{
    CommitMetadata, FailPoint, NodeRetentionMode, StorageEngine, StorageHealth, StorageMetrics,
};
pub use migration::{
    fingerprint, fingerprints_equal, migrate_file_store_to_production, CommitFingerprint,
    MigrationReport,
};
pub use namespaces::*;
pub use rebuild::{assert_state_root, rebuild_state_root, StateRootRebuild};
pub use schema::{
    SchemaCompatibility, SchemaRecord, FILE_STORE_SCHEMA_VERSION, PRODUCTION_SCHEMA_VERSION,
};
pub use snapshot::{
    create_production_snapshot, mutate_snapshot_chunk, restore_production_snapshot,
    verify_production_snapshot, ProductionSnapshot, ProductionSnapshotManifest,
};
pub use wal::{
    WalDomain, APPLICATION_STATE_COMMIT_KIND, CONSENSUS_WAL_KIND, SIGNER_SAFETY_DB_KIND,
};

pub const PRODUCTION_ENGINE_NAME: &str = "redb";
pub const PRODUCTION_ENGINE_VERSION: &str = "2.4.0"; // pinned for Rust 1.83 / edition 2021
pub const PRODUCTION_DB_FILE: &str = "chain.redb";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChainMeta {
    pub height: u64,
    pub tip_block_id: String,
    pub app_hash: String,
    pub transaction_root: String,
    pub schema_version: u32,
}

#[derive(Debug, Clone)]
pub struct StoredBlock {
    pub header: BlockHeader,
    pub transactions: Vec<SignedTransaction>,
    pub block_id: Hash32,
}

enum Backend {
    File,
    Production(redb_engine::RedbEngine),
}

pub struct ChainStore {
    root: PathBuf,
    pub genesis: GenesisV1,
    pub view: ChainView,
    pub meta: ChainMeta,
    pub fail_point: FailPoint,
    backend: Backend,
}

impl ChainStore {
    pub fn exists(root: impl AsRef<Path>) -> bool {
        let root = root.as_ref();
        root.join(PRODUCTION_DB_FILE).exists() || root.join(file_store::FILE_GENESIS).exists()
    }

    pub fn init(
        root: impl AsRef<Path>,
        genesis: GenesisV1,
        genesis_hash: Hash32,
        app_hash: Hash32,
    ) -> Result<Self, RejectReason> {
        Self::init_production(root, genesis, genesis_hash, app_hash)
    }

    pub fn init_file(
        root: impl AsRef<Path>,
        genesis: GenesisV1,
        genesis_hash: Hash32,
        app_hash: Hash32,
    ) -> Result<Self, RejectReason> {
        let root = root.as_ref().to_path_buf();
        file_store::init_dirs(&root)?;
        if root.join(file_store::FILE_GENESIS).exists() {
            return Self::open_file(root);
        }
        let meta = ChainMeta {
            height: 0,
            tip_block_id: hash_to_hex(&genesis_hash),
            app_hash: hash_to_hex(&app_hash),
            transaction_root: hash_to_hex(&app_hash),
            schema_version: FILE_STORE_SCHEMA_VERSION,
        };
        file_store::write_genesis(&root, &genesis)?;
        let store = Self {
            root,
            genesis,
            view: ChainView::default(),
            meta,
            fail_point: FailPoint::None,
            backend: Backend::File,
        };
        store.persist_state_and_meta()?;
        Ok(store)
    }

    pub fn init_production(
        root: impl AsRef<Path>,
        genesis: GenesisV1,
        genesis_hash: Hash32,
        app_hash: Hash32,
    ) -> Result<Self, RejectReason> {
        let root = root.as_ref().to_path_buf();
        std::fs::create_dir_all(&root).map_err(|_| RejectReason::PersistenceFailure)?;
        if root.join(PRODUCTION_DB_FILE).exists() {
            return Self::open(root);
        }
        if file_store::is_file_store(&root) {
            return Self::open_file(root);
        }
        let engine = redb_engine::RedbEngine::create(
            root.join(PRODUCTION_DB_FILE),
            DurabilityPolicy::PRODUCTION_CANDIDATE,
            NodeRetentionMode::Archive,
        )?;
        engine.put_genesis(&genesis)?;
        let meta = ChainMeta {
            height: 0,
            tip_block_id: hash_to_hex(&genesis_hash),
            app_hash: hash_to_hex(&app_hash),
            transaction_root: hash_to_hex(&app_hash),
            schema_version: PRODUCTION_SCHEMA_VERSION,
        };
        engine.persist_chain_meta(&meta)?;
        file_store::write_genesis(&root, &genesis)?;
        let store = Self {
            root,
            genesis,
            view: ChainView::default(),
            meta,
            fail_point: FailPoint::None,
            backend: Backend::Production(engine),
        };
        store.persist_state_and_meta()?;
        Ok(store)
    }

    pub fn open(root: impl AsRef<Path>) -> Result<Self, RejectReason> {
        let root = root.as_ref().to_path_buf();
        if root.join(PRODUCTION_DB_FILE).exists() {
            return Self::open_production(root);
        }
        Self::open_file(root)
    }

    pub fn open_file(root: impl AsRef<Path>) -> Result<Self, RejectReason> {
        let root = root.as_ref().to_path_buf();
        let genesis = file_store::load_genesis(&root)?;
        file_store::discard_orphan_wal(&root);
        let meta = file_store::load_meta(&root)?;
        let view = file_store::load_state(&root)?;
        Ok(Self { root, genesis, view, meta, fail_point: FailPoint::None, backend: Backend::File })
    }

    fn open_production(root: PathBuf) -> Result<Self, RejectReason> {
        let engine = redb_engine::RedbEngine::open(
            root.join(PRODUCTION_DB_FILE),
            DurabilityPolicy::PRODUCTION_CANDIDATE,
        )?;
        let genesis = engine.load_genesis().or_else(|_| file_store::load_genesis(&root))?;
        let meta = engine.load_chain_meta()?;
        let view = engine.load_view()?;
        Ok(Self {
            root,
            genesis,
            view,
            meta,
            fail_point: FailPoint::None,
            backend: Backend::Production(engine),
        })
    }

    pub fn data_dir(&self) -> &Path {
        &self.root
    }

    pub fn production_db_path(&self) -> Option<PathBuf> {
        match self.backend {
            Backend::Production(_) => Some(self.root.join(PRODUCTION_DB_FILE)),
            Backend::File => None,
        }
    }

    pub fn engine_name(&self) -> &'static str {
        match self.backend {
            Backend::File => "file-store",
            Backend::Production(_) => PRODUCTION_ENGINE_NAME,
        }
    }

    pub fn persist_state_and_meta(&self) -> Result<(), RejectReason> {
        match &self.backend {
            Backend::File => file_store::persist_state_and_meta(&self.root, &self.view, &self.meta),
            Backend::Production(engine) => {
                engine.persist_view(&self.view)?;
                engine.persist_chain_meta(&self.meta)
            }
        }
    }

    pub fn commit_block(
        &mut self,
        header: &BlockHeader,
        block_id: Hash32,
        transactions: &[SignedTransaction],
        tx_ids: &[Hash32],
        next_view: ChainView,
    ) -> Result<(), RejectReason> {
        match &mut self.backend {
            Backend::File => {
                let (view, meta) = file_store::commit_block(
                    &self.root,
                    header,
                    block_id,
                    transactions,
                    tx_ids,
                    next_view,
                    self.fail_point,
                )?;
                self.view = view;
                self.meta = meta;
                Ok(())
            }
            Backend::Production(engine) => {
                let meta = engine.commit_block(
                    header,
                    block_id,
                    transactions,
                    tx_ids,
                    &next_view,
                    self.fail_point,
                )?;
                self.view = next_view;
                self.meta = meta;
                Ok(())
            }
        }
    }

    pub fn load_block(&self, height: u64) -> Result<StoredBlock, RejectReason> {
        match &self.backend {
            Backend::File => file_store::load_block(&self.root, height, self.meta.height),
            Backend::Production(engine) => engine.load_block(height),
        }
    }

    pub fn load_block_by_id(&self, block_id_hex: &str) -> Result<StoredBlock, RejectReason> {
        match &self.backend {
            Backend::File => {
                file_store::load_block_by_id(&self.root, block_id_hex, self.meta.height)
            }
            Backend::Production(engine) => engine.load_block_by_id(block_id_hex),
        }
    }

    pub fn lookup_tx_height(&self, tx_id_hex: &str) -> Result<u64, RejectReason> {
        match &self.backend {
            Backend::File => file_store::lookup_tx_height(&self.root, tx_id_hex),
            Backend::Production(engine) => engine.lookup_tx_height(tx_id_hex),
        }
    }

    pub fn create_checkpoint(&self, label: &str) -> Result<PathBuf, RejectReason> {
        match &self.backend {
            Backend::File => file_store::create_checkpoint(&self.root, label),
            Backend::Production(_) => {
                let dest = self.root.join("checkpoints").join(label);
                let snap = create_production_snapshot(
                    self,
                    &dest,
                    "net_sunrey_local_dev",
                    "chn_sunrey_local_dev",
                    "1",
                    FailPoint::None,
                )?;
                Ok(snap.payload_dir)
            }
        }
    }

    pub fn export_engine(&self, dest: &Path) -> Result<(), RejectReason> {
        match &self.backend {
            Backend::File => {
                file_store::create_checkpoint(&self.root, "export")?;
                Ok(())
            }
            Backend::Production(engine) => {
                engine.export_snapshot(dest)?;
                Ok(())
            }
        }
    }

    pub fn import_block(&mut self, height: u64, block: &StoredBlock) -> Result<(), RejectReason> {
        match &self.backend {
            Backend::File => {
                let path =
                    self.root.join(file_store::DIR_BLOCKS).join(format!("{height:016x}.blk"));
                file_store::atomic_write(
                    path,
                    &file_store::encode_block(&block.header, &block.transactions),
                )
            }
            Backend::Production(engine) => {
                let encoded = file_store::encode_block(&block.header, &block.transactions);
                engine.put_raw_for_test(
                    "ns_blocks",
                    &height.to_be_bytes(),
                    &wrap_checksum(&encoded),
                )?;
                if !block.header.app_hash.iter().all(|b| *b == 0) {
                    engine.put_raw_for_test(
                        "ns_blocks",
                        hash_to_hex(&block.block_id).as_bytes(),
                        &wrap_checksum(&height.to_be_bytes()),
                    )?;
                }
                Ok(())
            }
        }
    }

    pub fn reindex_from_view(&self) -> Result<(), RejectReason> {
        self.persist_state_and_meta()
    }

    pub fn health(&self) -> Result<StorageHealth, RejectReason> {
        match &self.backend {
            Backend::File => Ok(StorageHealth {
                engine: "file-store".to_string(),
                schema_version: self.meta.schema_version,
                schema: SchemaCompatibility::MigrationRequired,
                durability: DurabilityPolicy::DEVELOPMENT,
                mode: NodeRetentionMode::Archive,
                height: self.meta.height,
                ready: true,
                errors: 0,
            }),
            Backend::Production(engine) => engine.health(),
        }
    }

    pub fn metrics(&self) -> StorageMetrics {
        match &self.backend {
            Backend::File => StorageMetrics::default(),
            Backend::Production(engine) => engine.metrics(),
        }
    }

    /// Fail-closed startup validation for consensus-critical persistence.
    ///
    /// Verifies checksum integrity, genesis fingerprint, state-root commitment,
    /// tip linkage, and block height continuity. Indexes are conveniences; this
    /// checks the authoritative block + state binding.
    pub fn validate_canonical_startup(
        &self,
        hasher: &dyn DomainHasher,
        expected_genesis_hash: &Hash32,
    ) -> Result<(), RejectReason> {
        self.verify_integrity()?;
        let computed = genesis_hash(hasher, &self.genesis);
        if computed != *expected_genesis_hash {
            return Err(RejectReason::IncompatibleProtocol);
        }
        let tip = hash_from_hex(&self.meta.tip_block_id)?;
        if self.meta.height == 0 {
            if tip != *expected_genesis_hash {
                return Err(RejectReason::IncompatibleProtocol);
            }
        } else {
            let stored = self.load_block(self.meta.height)?;
            let expected_tip = block_id(hasher, &stored.header);
            if tip != expected_tip {
                return Err(RejectReason::CorruptStore);
            }
            if stored.header.height != self.meta.height {
                return Err(RejectReason::IncorrectHeight);
            }
            if hash_to_hex(&stored.header.app_hash) != self.meta.app_hash {
                return Err(RejectReason::WrongStateRoot);
            }
        }
        assert_state_root(self, hasher)?;
        Ok(())
    }

    pub fn verify_integrity(&self) -> Result<(), RejectReason> {
        match &self.backend {
            Backend::File => {
                let _ = file_store::load_state(&self.root)?;
                Ok(())
            }
            Backend::Production(engine) => engine.verify_integrity(),
        }
    }

    pub fn set_retention_mode(&mut self, mode: NodeRetentionMode) {
        if let Backend::Production(engine) = &mut self.backend {
            engine.mode = mode;
        }
    }

    pub fn corrupt_for_test(&self, target: &str) -> Result<(), RejectReason> {
        match &self.backend {
            Backend::File => {
                let path = match target {
                    "block" => {
                        self.root.join(file_store::DIR_BLOCKS).join(format!("{:016x}.blk", 1u64))
                    }
                    "state" => self.root.join(file_store::FILE_STATE),
                    "meta" => self.root.join(file_store::FILE_META),
                    _ => return Err(RejectReason::StatelessInvalid),
                };
                let mut bytes = file_store::read_file(&path)?;
                if !bytes.is_empty() {
                    let idx = bytes.len() / 2;
                    bytes[idx] ^= 0xff;
                    std::fs::write(path, bytes).map_err(|_| RejectReason::PersistenceFailure)?;
                }
                Ok(())
            }
            Backend::Production(engine) => match target {
                "block" => {
                    engine.put_raw_for_test("ns_blocks", &1u64.to_be_bytes(), b"not-a-checksum")
                }
                "state" => engine.put_raw_for_test("ns_state", b"corrupt", b"not-a-checksum"),
                "meta" => engine.put_raw_for_test("sys_meta", b"chain_meta", b"not-a-checksum"),
                _ => Err(RejectReason::StatelessInvalid),
            },
        }
    }
}

impl std::fmt::Debug for ChainStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ChainStore")
            .field("root", &self.root)
            .field("meta", &self.meta)
            .field("engine", &self.engine_name())
            .finish()
    }
}
