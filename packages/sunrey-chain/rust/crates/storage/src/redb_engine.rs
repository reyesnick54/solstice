//! Production-candidate engine: redb (pure-Rust ACID embedded KV).
//!
//! Selected instead of RocksDB because the SunRey Rust workspace must stay
//! portable in CI without a C++ toolchain. redb provides crash-safe
//! copy-on-write B-trees and multi-table atomic transactions.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock, Weak};
use std::time::Instant;

use redb::{Database, ReadableTable, TableDefinition};
use sunrey_protocol::{
    hash_to_hex, BlockHeader, GenesisV1, Hash32, RejectReason, SignedTransaction,
};
use sunrey_state::ChainView;
use sunrey_state::{ObjectStore, NS_ASSET};

use crate::checksum::{unwrap_checksum, wrap_checksum};
use crate::durability::DurabilityPolicy;
use crate::engine::{CommitMetadata, FailPoint, NodeRetentionMode, StorageHealth, StorageMetrics};
use crate::file_store::{decode_block, encode_block};
use crate::schema::{SchemaRecord, PRODUCTION_SCHEMA_VERSION};
use crate::{ChainMeta, StoredBlock};

const META: TableDefinition<&[u8], &[u8]> = TableDefinition::new("sys_meta");
const BLOCKS: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_blocks");
const BLOCK_META: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_block_meta");
const CONSENSUS_META: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_consensus_meta");
const STATE: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_state");
const VALIDATOR_HISTORY: TableDefinition<&[u8], &[u8]> =
    TableDefinition::new("ns_validator_history");
const EVIDENCE: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_evidence");
const GOVERNANCE: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_governance");
const TX_LOOKUP: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_tx_lookup");
const INTEROP: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_interop");
const NATIVE_ASSET: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_native_asset");
const ORACLE: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_oracle");
const COMMIT: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_commit");
const SEEN_TX: TableDefinition<&[u8], &[u8]> = TableDefinition::new("ns_seen_tx");

const KEY_SCHEMA: &[u8] = b"schema";
const KEY_CHAIN_META: &[u8] = b"chain_meta";
const KEY_GENESIS: &[u8] = b"genesis";
const KEY_MODE: &[u8] = b"retention_mode";
const KEY_HEAD: &[u8] = b"commit_head";

fn open_shared_db(path: &Path, create: bool) -> Result<Arc<Database>, RejectReason> {
    static OPEN_DBS: OnceLock<Mutex<HashMap<PathBuf, Weak<Database>>>> = OnceLock::new();
    let key = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let mut map = OPEN_DBS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| RejectReason::PersistenceFailure)?;
    if let Some(existing) = map.get(&key).and_then(Weak::upgrade) {
        return Ok(existing);
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|_| RejectReason::PersistenceFailure)?;
    }
    let db = if create || !path.exists() {
        Database::create(path).map_err(|_| RejectReason::PersistenceFailure)?
    } else {
        Database::open(path).map_err(|_| RejectReason::CorruptStore)?
    };
    let arc = Arc::new(db);
    map.insert(key, Arc::downgrade(&arc));
    Ok(arc)
}

pub struct RedbEngine {
    db: Arc<Database>,
    path: PathBuf,
    pub durability: DurabilityPolicy,
    pub mode: NodeRetentionMode,
    pub write_latency_us: u64,
    pub read_latency_us: u64,
    pub errors: u64,
}

impl RedbEngine {
    pub fn create(
        path: impl AsRef<Path>,
        durability: DurabilityPolicy,
        mode: NodeRetentionMode,
    ) -> Result<Self, RejectReason> {
        let path = path.as_ref().to_path_buf();
        let db = open_shared_db(&path, true)?;
        let engine =
            Self { db, path, durability, mode, write_latency_us: 0, read_latency_us: 0, errors: 0 };
        engine.init_schema()?;
        Ok(engine)
    }

    pub fn open(
        path: impl AsRef<Path>,
        durability: DurabilityPolicy,
    ) -> Result<Self, RejectReason> {
        let path = path.as_ref().to_path_buf();
        let db = open_shared_db(&path, false)?;
        let mut engine = Self {
            db,
            path,
            durability,
            mode: NodeRetentionMode::Archive,
            write_latency_us: 0,
            read_latency_us: 0,
            errors: 0,
        };
        let schema = engine.load_schema()?;
        SchemaRecord::require_openable(Some(&schema))?;
        if let Ok(Some(raw)) = engine.read_meta(KEY_MODE) {
            if let Ok(mode) = serde_json::from_slice::<NodeRetentionMode>(&raw) {
                engine.mode = mode;
            }
        }
        Ok(engine)
    }

    fn init_schema(&self) -> Result<(), RejectReason> {
        let record = SchemaRecord::production();
        let bytes = serde_json::to_vec(&record).map_err(|_| RejectReason::PersistenceFailure)?;
        let mode = serde_json::to_vec(&self.mode).map_err(|_| RejectReason::PersistenceFailure)?;
        let txn = self.begin_write()?;
        {
            let mut meta = txn.open_table(META).map_err(|_| RejectReason::PersistenceFailure)?;
            meta.insert(KEY_SCHEMA, wrap_checksum(&bytes).as_slice())
                .map_err(|_| RejectReason::PersistenceFailure)?;
            meta.insert(KEY_MODE, wrap_checksum(&mode).as_slice())
                .map_err(|_| RejectReason::PersistenceFailure)?;
        }
        {
            let _ = txn.open_table(BLOCKS).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ = txn.open_table(BLOCK_META).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ = txn.open_table(CONSENSUS_META).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ = txn.open_table(STATE).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ =
                txn.open_table(VALIDATOR_HISTORY).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ = txn.open_table(EVIDENCE).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ = txn.open_table(GOVERNANCE).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ = txn.open_table(TX_LOOKUP).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ = txn.open_table(INTEROP).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ = txn.open_table(NATIVE_ASSET).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ = txn.open_table(ORACLE).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ = txn.open_table(COMMIT).map_err(|_| RejectReason::PersistenceFailure)?;
            let _ = txn.open_table(SEEN_TX).map_err(|_| RejectReason::PersistenceFailure)?;
        }
        txn.commit().map_err(|_| RejectReason::PersistenceFailure)
    }

    fn begin_write(&self) -> Result<redb::WriteTransaction, RejectReason> {
        let mut txn = self.db.begin_write().map_err(|_| RejectReason::PersistenceFailure)?;
        txn.set_durability(self.durability.redb_durability());
        Ok(txn)
    }

    fn write_meta(&self, key: &[u8], value: &[u8]) -> Result<(), RejectReason> {
        let txn = self.begin_write()?;
        {
            let mut table = txn.open_table(META).map_err(|_| RejectReason::PersistenceFailure)?;
            table
                .insert(key, wrap_checksum(value).as_slice())
                .map_err(|_| RejectReason::PersistenceFailure)?;
        }
        txn.commit().map_err(|_| RejectReason::PersistenceFailure)
    }

    fn read_meta(&self, key: &[u8]) -> Result<Option<Vec<u8>>, RejectReason> {
        let txn = self.db.begin_read().map_err(|_| RejectReason::CorruptStore)?;
        let table = match txn.open_table(META) {
            Ok(table) => table,
            Err(_) => return Ok(None),
        };
        match table.get(key) {
            Ok(Some(value)) => unwrap_checksum(value.value()).map(Some),
            Ok(None) => Ok(None),
            Err(_) => Err(RejectReason::CorruptStore),
        }
    }

    pub fn load_schema(&self) -> Result<SchemaRecord, RejectReason> {
        let bytes = self.read_meta(KEY_SCHEMA)?.ok_or(RejectReason::CorruptStore)?;
        serde_json::from_slice(&bytes).map_err(|_| RejectReason::CorruptStore)
    }

    pub fn put_genesis(&self, genesis: &GenesisV1) -> Result<(), RejectReason> {
        self.write_meta(KEY_GENESIS, &genesis.encode())
    }

    pub fn load_genesis(&self) -> Result<GenesisV1, RejectReason> {
        let bytes = self.read_meta(KEY_GENESIS)?.ok_or(RejectReason::CorruptStore)?;
        GenesisV1::decode(&bytes)
    }

    pub fn persist_chain_meta(&self, meta: &ChainMeta) -> Result<(), RejectReason> {
        let bytes = serde_json::to_vec(meta).map_err(|_| RejectReason::PersistenceFailure)?;
        self.write_meta(KEY_CHAIN_META, &bytes)
    }

    pub fn load_chain_meta(&self) -> Result<ChainMeta, RejectReason> {
        let bytes = self.read_meta(KEY_CHAIN_META)?.ok_or(RejectReason::CorruptStore)?;
        serde_json::from_slice(&bytes).map_err(|_| RejectReason::CorruptStore)
    }

    pub fn persist_view(&self, view: &ChainView) -> Result<(), RejectReason> {
        let txn = self.begin_write()?;
        {
            let mut state = txn.open_table(STATE).map_err(|_| RejectReason::PersistenceFailure)?;
            let mut native =
                txn.open_table(NATIVE_ASSET).map_err(|_| RejectReason::PersistenceFailure)?;
            let mut evidence =
                txn.open_table(EVIDENCE).map_err(|_| RejectReason::PersistenceFailure)?;
            for (key, value) in view.store.entries() {
                let wrapped = wrap_checksum(&value);
                state
                    .insert(key.as_slice(), wrapped.as_slice())
                    .map_err(|_| RejectReason::PersistenceFailure)?;
                if key.starts_with(NS_ASSET) {
                    native
                        .insert(key.as_slice(), wrapped.as_slice())
                        .map_err(|_| RejectReason::PersistenceFailure)?;
                }
                if key.starts_with(sunrey_state::NS_EVIDENCE) {
                    evidence
                        .insert(key.as_slice(), wrapped.as_slice())
                        .map_err(|_| RejectReason::PersistenceFailure)?;
                }
            }
            let mut seen = txn.open_table(SEEN_TX).map_err(|_| RejectReason::PersistenceFailure)?;
            for tx_id in &view.seen_tx_ids {
                seen.insert(tx_id.as_slice(), wrap_checksum(tx_id).as_slice())
                    .map_err(|_| RejectReason::PersistenceFailure)?;
            }
        }
        txn.commit().map_err(|_| RejectReason::PersistenceFailure)
    }

    pub fn load_view(&self) -> Result<ChainView, RejectReason> {
        let started = Instant::now();
        let txn = self.db.begin_read().map_err(|_| RejectReason::CorruptStore)?;
        let mut map = std::collections::BTreeMap::new();
        if let Ok(state) = txn.open_table(STATE) {
            for entry in state.iter().map_err(|_| RejectReason::CorruptStore)? {
                let (key, value) = entry.map_err(|_| RejectReason::CorruptStore)?;
                map.insert(key.value().to_vec(), unwrap_checksum(value.value())?);
            }
        }
        let mut seen = std::collections::BTreeSet::new();
        if let Ok(table) = txn.open_table(SEEN_TX) {
            for entry in table.iter().map_err(|_| RejectReason::CorruptStore)? {
                let (key, value) = entry.map_err(|_| RejectReason::CorruptStore)?;
                let _ = unwrap_checksum(value.value())?;
                let hash: Hash32 =
                    key.value().try_into().map_err(|_| RejectReason::CorruptStore)?;
                seen.insert(hash);
            }
        }
        let _ = started;
        Ok(ChainView { store: ObjectStore::from_entries(map), seen_tx_ids: seen })
    }

    pub fn commit_block(
        &mut self,
        header: &BlockHeader,
        block_id: Hash32,
        transactions: &[SignedTransaction],
        tx_ids: &[Hash32],
        next_view: &ChainView,
        fail_point: FailPoint,
    ) -> Result<ChainMeta, RejectReason> {
        if fail_point == FailPoint::BeforeDatabaseCommit {
            self.errors += 1;
            return Err(RejectReason::PersistenceFailure);
        }
        let started = Instant::now();
        let encoded_block = encode_block(header, transactions);
        let height_key = header.height.to_be_bytes();
        let meta = ChainMeta {
            height: header.height,
            tip_block_id: hash_to_hex(&block_id),
            app_hash: hash_to_hex(&header.app_hash),
            transaction_root: hash_to_hex(&header.transaction_root),
            schema_version: PRODUCTION_SCHEMA_VERSION,
        };
        let fingerprint = crate::fingerprint(next_view, &meta);
        let commit = CommitMetadata {
            height: meta.height,
            block_id: meta.tip_block_id.clone(),
            state_root: meta.app_hash.clone(),
            protocol_version: header.version,
            schema_version: PRODUCTION_SCHEMA_VERSION,
            native_supply: fingerprint.native_supply,
            validator_set: fingerprint.validator_set,
        };
        let commit_bytes =
            serde_json::to_vec(&commit).map_err(|_| RejectReason::PersistenceFailure)?;
        let meta_bytes = serde_json::to_vec(&meta).map_err(|_| RejectReason::PersistenceFailure)?;
        let header_bytes = header.encode();

        if fail_point == FailPoint::DuringPersistence
            || fail_point == FailPoint::DuringStateWrite
            || fail_point == FailPoint::DuringMetadataWrite
        {
            self.errors += 1;
            return Err(RejectReason::PersistenceFailure);
        }

        let txn = self.begin_write()?;
        {
            let mut blocks =
                txn.open_table(BLOCKS).map_err(|_| RejectReason::PersistenceFailure)?;
            blocks
                .insert(height_key.as_slice(), wrap_checksum(&encoded_block).as_slice())
                .map_err(|_| RejectReason::PersistenceFailure)?;
            let mut block_meta =
                txn.open_table(BLOCK_META).map_err(|_| RejectReason::PersistenceFailure)?;
            block_meta
                .insert(height_key.as_slice(), wrap_checksum(&header_bytes).as_slice())
                .map_err(|_| RejectReason::PersistenceFailure)?;
            block_meta
                .insert(meta.tip_block_id.as_bytes(), wrap_checksum(&height_key).as_slice())
                .map_err(|_| RejectReason::PersistenceFailure)?;
            let mut state = txn.open_table(STATE).map_err(|_| RejectReason::PersistenceFailure)?;
            let mut native =
                txn.open_table(NATIVE_ASSET).map_err(|_| RejectReason::PersistenceFailure)?;
            for (key, value) in next_view.store.entries() {
                let wrapped = wrap_checksum(&value);
                state
                    .insert(key.as_slice(), wrapped.as_slice())
                    .map_err(|_| RejectReason::PersistenceFailure)?;
                if key.starts_with(NS_ASSET) {
                    native
                        .insert(key.as_slice(), wrapped.as_slice())
                        .map_err(|_| RejectReason::PersistenceFailure)?;
                }
            }
            let mut seen = txn.open_table(SEEN_TX).map_err(|_| RejectReason::PersistenceFailure)?;
            for tx_id in &next_view.seen_tx_ids {
                seen.insert(tx_id.as_slice(), wrap_checksum(tx_id).as_slice())
                    .map_err(|_| RejectReason::PersistenceFailure)?;
            }
            let mut tx_lookup =
                txn.open_table(TX_LOOKUP).map_err(|_| RejectReason::PersistenceFailure)?;
            for tx_id in tx_ids {
                tx_lookup
                    .insert(hash_to_hex(tx_id).as_bytes(), wrap_checksum(&height_key).as_slice())
                    .map_err(|_| RejectReason::PersistenceFailure)?;
            }
            let mut commits =
                txn.open_table(COMMIT).map_err(|_| RejectReason::PersistenceFailure)?;
            commits
                .insert(height_key.as_slice(), wrap_checksum(&commit_bytes).as_slice())
                .map_err(|_| RejectReason::PersistenceFailure)?;
            let mut consensus =
                txn.open_table(CONSENSUS_META).map_err(|_| RejectReason::PersistenceFailure)?;
            consensus
                .insert(KEY_HEAD, wrap_checksum(&commit_bytes).as_slice())
                .map_err(|_| RejectReason::PersistenceFailure)?;
            let mut meta_table =
                txn.open_table(META).map_err(|_| RejectReason::PersistenceFailure)?;
            meta_table
                .insert(KEY_CHAIN_META, wrap_checksum(&meta_bytes).as_slice())
                .map_err(|_| RejectReason::PersistenceFailure)?;
            meta_table
                .insert(KEY_HEAD, wrap_checksum(&commit_bytes).as_slice())
                .map_err(|_| RejectReason::PersistenceFailure)?;
        }
        txn.commit().map_err(|_| RejectReason::PersistenceFailure)?;
        self.write_latency_us = started.elapsed().as_micros() as u64;
        self.maybe_prune(header.height)?;
        if fail_point == FailPoint::AfterCommitBeforeResponse {
            self.errors += 1;
            return Err(RejectReason::PersistenceFailure);
        }
        Ok(meta)
    }

    fn maybe_prune(&self, finalized_height: u64) -> Result<(), RejectReason> {
        let NodeRetentionMode::Pruned { retain_finalized_blocks } = self.mode else {
            return Ok(());
        };
        if finalized_height <= retain_finalized_blocks {
            return Ok(());
        }
        let floor = finalized_height - retain_finalized_blocks;
        let txn = self.begin_write()?;
        {
            let mut blocks =
                txn.open_table(BLOCKS).map_err(|_| RejectReason::PersistenceFailure)?;
            for height in 1..floor {
                if !self.mode.may_drop_block(height, finalized_height) {
                    continue;
                }
                let key = height.to_be_bytes();
                let _ = blocks.remove(key.as_slice());
            }
        }
        txn.commit().map_err(|_| RejectReason::PersistenceFailure)
    }

    pub fn load_block(&self, height: u64) -> Result<StoredBlock, RejectReason> {
        let started = Instant::now();
        let txn = self.db.begin_read().map_err(|_| RejectReason::CorruptStore)?;
        let table = txn.open_table(BLOCKS).map_err(|_| RejectReason::NotFound)?;
        let key = height.to_be_bytes();
        let value = table.get(key.as_slice()).map_err(|_| RejectReason::CorruptStore)?;
        let Some(value) = value else {
            return Err(RejectReason::NotFound);
        };
        let bytes = unwrap_checksum(value.value())?;
        let _ = started;
        decode_block(&bytes)
    }

    pub fn load_block_by_id(&self, block_id_hex: &str) -> Result<StoredBlock, RejectReason> {
        let txn = self.db.begin_read().map_err(|_| RejectReason::CorruptStore)?;
        let meta = txn.open_table(BLOCK_META).map_err(|_| RejectReason::NotFound)?;
        let Some(height_raw) =
            meta.get(block_id_hex.as_bytes()).map_err(|_| RejectReason::CorruptStore)?
        else {
            return Err(RejectReason::NotFound);
        };
        let height_bytes = unwrap_checksum(height_raw.value())?;
        let arr: [u8; 8] =
            height_bytes.as_slice().try_into().map_err(|_| RejectReason::CorruptStore)?;
        self.load_block(u64::from_be_bytes(arr))
    }

    pub fn lookup_tx_height(&self, tx_id_hex: &str) -> Result<u64, RejectReason> {
        let txn = self.db.begin_read().map_err(|_| RejectReason::CorruptStore)?;
        let table = txn.open_table(TX_LOOKUP).map_err(|_| RejectReason::NotFound)?;
        let Some(value) =
            table.get(tx_id_hex.as_bytes()).map_err(|_| RejectReason::CorruptStore)?
        else {
            return Err(RejectReason::NotFound);
        };
        let bytes = unwrap_checksum(value.value())?;
        let arr: [u8; 8] = bytes.as_slice().try_into().map_err(|_| RejectReason::CorruptStore)?;
        Ok(u64::from_be_bytes(arr))
    }

    pub fn verify_integrity(&self) -> Result<(), RejectReason> {
        let txn = self.db.begin_read().map_err(|_| RejectReason::CorruptStore)?;
        for (def, name) in
            [(STATE, "state"), (BLOCKS, "blocks"), (META, "meta"), (COMMIT, "commit")]
        {
            let table = txn.open_table(def).map_err(|_| RejectReason::CorruptStore)?;
            for entry in table.iter().map_err(|_| RejectReason::CorruptStore)? {
                let (_key, value) = entry.map_err(|_| RejectReason::CorruptStore)?;
                unwrap_checksum(value.value()).map_err(|_| {
                    let _ = name;
                    RejectReason::CorruptStore
                })?;
            }
        }
        Ok(())
    }

    pub fn health(&self) -> Result<StorageHealth, RejectReason> {
        let schema = self.load_schema().ok();
        let meta = self.load_chain_meta().ok();
        Ok(StorageHealth {
            engine: crate::PRODUCTION_ENGINE_NAME.to_string(),
            schema_version: schema.as_ref().map(|row| row.schema_version).unwrap_or(0),
            schema: SchemaRecord::classify(schema.as_ref(), PRODUCTION_SCHEMA_VERSION),
            durability: self.durability,
            mode: self.mode,
            height: meta.as_ref().map(|row| row.height).unwrap_or(0),
            ready: schema.is_some() && meta.is_some(),
            errors: self.errors,
        })
    }

    pub fn metrics(&self) -> StorageMetrics {
        let chain_db_bytes = std::fs::metadata(&self.path).map(|row| row.len()).unwrap_or(0);
        let mut state_db_bytes = 0u64;
        let mut block_db_bytes = 0u64;
        if let Ok(txn) = self.db.begin_read() {
            if let Ok(state) = txn.open_table(STATE) {
                if let Ok(iter) = state.iter() {
                    for entry in iter.flatten() {
                        state_db_bytes += entry.1.value().len() as u64;
                    }
                }
            }
            if let Ok(blocks) = txn.open_table(BLOCKS) {
                if let Ok(iter) = blocks.iter() {
                    for entry in iter.flatten() {
                        block_db_bytes += entry.1.value().len() as u64;
                    }
                }
            }
        }
        StorageMetrics {
            chain_db_bytes,
            state_db_bytes,
            block_db_bytes,
            wal_bytes: 0,
            snapshot_bytes: 0,
            storage_write_latency_us: self.write_latency_us,
            storage_read_latency_us: self.read_latency_us,
            storage_errors: self.errors,
            remaining_capacity_bytes: remaining_capacity(&self.path, chain_db_bytes),
        }
    }

    pub fn export_snapshot(&self, dest: &Path) -> Result<Vec<u8>, RejectReason> {
        std::fs::create_dir_all(dest).map_err(|_| RejectReason::PersistenceFailure)?;
        std::fs::copy(&self.path, dest.join(crate::PRODUCTION_DB_FILE))
            .map_err(|_| RejectReason::PersistenceFailure)?;
        let meta = self.load_chain_meta()?;
        let bytes = serde_json::to_vec(&meta).map_err(|_| RejectReason::PersistenceFailure)?;
        Ok(bytes)
    }

    pub fn put_raw_for_test(
        &self,
        table: &str,
        key: &[u8],
        raw_value: &[u8],
    ) -> Result<(), RejectReason> {
        let txn = self.begin_write()?;
        match table {
            "ns_blocks" => {
                let mut t = txn.open_table(BLOCKS).map_err(|_| RejectReason::PersistenceFailure)?;
                t.insert(key, raw_value).map_err(|_| RejectReason::PersistenceFailure)?;
            }
            "ns_state" => {
                let mut t = txn.open_table(STATE).map_err(|_| RejectReason::PersistenceFailure)?;
                t.insert(key, raw_value).map_err(|_| RejectReason::PersistenceFailure)?;
            }
            "sys_meta" => {
                let mut t = txn.open_table(META).map_err(|_| RejectReason::PersistenceFailure)?;
                t.insert(key, raw_value).map_err(|_| RejectReason::PersistenceFailure)?;
            }
            _ => return Err(RejectReason::StatelessInvalid),
        }
        txn.commit().map_err(|_| RejectReason::PersistenceFailure)
    }

    #[allow(dead_code)]
    pub fn db_path(&self) -> &Path {
        &self.path
    }
}

fn remaining_capacity(path: &Path, used: u64) -> u64 {
    const DEFAULT_CAP: u64 = 200 * 1024 * 1024 * 1024;
    let cap = std::env::var("SUNREY_STORAGE_CAPACITY_BYTES")
        .ok()
        .and_then(|raw| raw.parse().ok())
        .unwrap_or(DEFAULT_CAP);
    cap.saturating_sub(used).saturating_sub(path_used_hint(path))
}

fn path_used_hint(_path: &Path) -> u64 {
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_db() -> PathBuf {
        let nanos =
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("sunrey-redb-{nanos}")).join(crate::PRODUCTION_DB_FILE)
    }

    #[test]
    fn schema_round_trip() {
        let path = temp_db();
        let genesis = sunrey_protocol::local_dev_genesis(vec![1], "dev".into());
        {
            let engine = RedbEngine::create(
                &path,
                DurabilityPolicy::PRODUCTION_CANDIDATE,
                NodeRetentionMode::Archive,
            )
            .unwrap();
            engine.put_genesis(&genesis).unwrap();
        }
        let opened = RedbEngine::open(&path, DurabilityPolicy::PRODUCTION_CANDIDATE).unwrap();
        assert_eq!(opened.load_schema().unwrap().schema_version, PRODUCTION_SCHEMA_VERSION);
        assert_eq!(opened.load_genesis().unwrap().encode(), genesis.encode());
    }
}
