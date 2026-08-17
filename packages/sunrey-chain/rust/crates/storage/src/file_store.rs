//! Development/test file store. Migration source only — not the production engine.

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use sunrey_protocol::{
    hash_to_hex, BlockHeader, GenesisV1, Hash32, RejectReason, SignedTransaction,
};
use sunrey_state::ChainView;

use crate::engine::FailPoint;
use crate::{ChainMeta, StoredBlock};

pub const FILE_GENESIS: &str = "genesis.bin";
pub const FILE_STATE: &str = "state.bin";
pub const FILE_META: &str = "meta.json";
pub const FILE_WAL: &str = "wal.bin";
pub const DIR_BLOCKS: &str = "blocks";
pub const DIR_CHECKPOINTS: &str = "checkpoints";
pub const DIR_TXINDEX: &str = "txindex";

pub fn is_file_store(root: &Path) -> bool {
    root.join(FILE_GENESIS).exists() && !root.join(crate::PRODUCTION_DB_FILE).exists()
}

pub fn init_dirs(root: &Path) -> Result<(), RejectReason> {
    fs::create_dir_all(root).map_err(|_| RejectReason::PersistenceFailure)?;
    fs::create_dir_all(root.join(DIR_BLOCKS)).map_err(|_| RejectReason::PersistenceFailure)?;
    fs::create_dir_all(root.join(DIR_CHECKPOINTS)).map_err(|_| RejectReason::PersistenceFailure)?;
    fs::create_dir_all(root.join(DIR_TXINDEX)).map_err(|_| RejectReason::PersistenceFailure)?;
    Ok(())
}

pub fn write_genesis(root: &Path, genesis: &GenesisV1) -> Result<(), RejectReason> {
    atomic_write(root.join(FILE_GENESIS), &genesis.encode())
}

pub fn load_genesis(root: &Path) -> Result<GenesisV1, RejectReason> {
    GenesisV1::decode(&read_file(root.join(FILE_GENESIS))?)
}

pub fn persist_state_and_meta(
    root: &Path,
    view: &ChainView,
    meta: &ChainMeta,
) -> Result<(), RejectReason> {
    write_state(root, view)?;
    atomic_write(
        root.join(FILE_META),
        &serde_json::to_vec_pretty(meta).map_err(|_| RejectReason::PersistenceFailure)?,
    )
}

pub fn load_meta(root: &Path) -> Result<ChainMeta, RejectReason> {
    serde_json::from_slice(&read_file(root.join(FILE_META))?)
        .map_err(|_| RejectReason::CorruptStore)
}

pub fn load_state(root: &Path) -> Result<ChainView, RejectReason> {
    let bytes = read_file(root.join(FILE_STATE))?;
    if bytes.len() < 4 {
        return Err(RejectReason::CorruptStore);
    }
    let (body, checksum_bytes) = bytes.split_at(bytes.len() - 4);
    let expected =
        u32::from_be_bytes(checksum_bytes.try_into().map_err(|_| RejectReason::CorruptStore)?);
    if checksum32(body) != expected {
        return Err(RejectReason::CorruptStore);
    }
    let mut input = body;
    let count =
        sunrey_protocol::decode_u32(&mut input).map_err(|_| RejectReason::CorruptStore)? as usize;
    let mut map = std::collections::BTreeMap::new();
    for _ in 0..count {
        let key =
            sunrey_protocol::decode_bytes(&mut input).map_err(|_| RejectReason::CorruptStore)?;
        let value =
            sunrey_protocol::decode_bytes(&mut input).map_err(|_| RejectReason::CorruptStore)?;
        map.insert(key, value);
    }
    let tx_count =
        sunrey_protocol::decode_u32(&mut input).map_err(|_| RejectReason::CorruptStore)? as usize;
    let mut seen = std::collections::BTreeSet::new();
    for _ in 0..tx_count {
        let id =
            sunrey_protocol::decode_bytes(&mut input).map_err(|_| RejectReason::CorruptStore)?;
        let hash: Hash32 = id.as_slice().try_into().map_err(|_| RejectReason::CorruptStore)?;
        seen.insert(hash);
    }
    if !input.is_empty() {
        return Err(RejectReason::CorruptStore);
    }
    Ok(ChainView { store: sunrey_state::ObjectStore::from_entries(map), seen_tx_ids: seen })
}

pub fn discard_orphan_wal(root: &Path) {
    let wal = root.join(FILE_WAL);
    if wal.exists() {
        let _ = fs::remove_file(&wal);
    }
}

pub fn commit_block(
    root: &Path,
    header: &BlockHeader,
    block_id: Hash32,
    transactions: &[SignedTransaction],
    tx_ids: &[Hash32],
    next_view: ChainView,
    fail_point: FailPoint,
) -> Result<(ChainView, ChainMeta), RejectReason> {
    if fail_point == FailPoint::BeforeDatabaseCommit {
        return Err(RejectReason::PersistenceFailure);
    }
    let wal = encode_block(header, transactions);
    if fail_point == FailPoint::DuringPersistence
        || fail_point == FailPoint::DuringStateWrite
        || fail_point == FailPoint::DuringMetadataWrite
    {
        return Err(RejectReason::PersistenceFailure);
    }
    atomic_write(root.join(FILE_WAL), &wal)?;
    let encoded_block = encode_block(header, transactions);
    let block_path = root.join(DIR_BLOCKS).join(format!("{:016x}.blk", header.height));
    atomic_write(&block_path, &encoded_block)?;
    for tx_id in tx_ids {
        let idx = root.join(DIR_TXINDEX).join(format!("{}.idx", hash_to_hex(tx_id)));
        atomic_write(idx, header.height.to_be_bytes().as_slice())?;
    }
    let meta = ChainMeta {
        height: header.height,
        tip_block_id: hash_to_hex(&block_id),
        app_hash: hash_to_hex(&header.app_hash),
        transaction_root: hash_to_hex(&header.transaction_root),
        schema_version: crate::schema::FILE_STORE_SCHEMA_VERSION,
    };
    persist_state_and_meta(root, &next_view, &meta)?;
    let _ = fs::remove_file(root.join(FILE_WAL));
    if fail_point == FailPoint::AfterCommitBeforeResponse {
        return Err(RejectReason::PersistenceFailure);
    }
    Ok((next_view, meta))
}

pub fn load_block(root: &Path, height: u64, tip: u64) -> Result<StoredBlock, RejectReason> {
    if height == 0 || height > tip {
        return Err(RejectReason::NotFound);
    }
    let path = root.join(DIR_BLOCKS).join(format!("{height:016x}.blk"));
    decode_block(&read_file(path)?)
}

pub fn load_block_by_id(
    root: &Path,
    block_id_hex: &str,
    tip: u64,
) -> Result<StoredBlock, RejectReason> {
    for height in 1..=tip {
        let stored = load_block(root, height, tip)?;
        if hash_to_hex(&stored.block_id) == block_id_hex {
            return Ok(stored);
        }
    }
    Err(RejectReason::NotFound)
}

pub fn lookup_tx_height(root: &Path, tx_id_hex: &str) -> Result<u64, RejectReason> {
    let path = root.join(DIR_TXINDEX).join(format!("{tx_id_hex}.idx"));
    let bytes = read_file(path)?;
    let arr: [u8; 8] = bytes.try_into().map_err(|_| RejectReason::CorruptStore)?;
    Ok(u64::from_be_bytes(arr))
}

pub fn create_checkpoint(root: &Path, label: &str) -> Result<PathBuf, RejectReason> {
    if label.is_empty() || label.contains('/') || label.contains('\\') {
        return Err(RejectReason::StatelessInvalid);
    }
    let dest = root.join(DIR_CHECKPOINTS).join(label);
    fs::create_dir_all(&dest).map_err(|_| RejectReason::PersistenceFailure)?;
    for name in [FILE_GENESIS, FILE_STATE, FILE_META] {
        fs::copy(root.join(name), dest.join(name)).map_err(|_| RejectReason::PersistenceFailure)?;
    }
    let blocks_src = root.join(DIR_BLOCKS);
    let blocks_dest = dest.join(DIR_BLOCKS);
    fs::create_dir_all(&blocks_dest).map_err(|_| RejectReason::PersistenceFailure)?;
    for entry in fs::read_dir(blocks_src).map_err(|_| RejectReason::PersistenceFailure)? {
        let entry = entry.map_err(|_| RejectReason::PersistenceFailure)?;
        fs::copy(entry.path(), blocks_dest.join(entry.file_name()))
            .map_err(|_| RejectReason::PersistenceFailure)?;
    }
    Ok(dest)
}

pub fn encode_block(header: &BlockHeader, transactions: &[SignedTransaction]) -> Vec<u8> {
    let mut out = Vec::new();
    sunrey_protocol::encode_bytes(&mut out, &header.encode());
    sunrey_protocol::encode_u32(&mut out, transactions.len() as u32);
    for tx in transactions {
        sunrey_protocol::encode_bytes(&mut out, &tx.encode());
    }
    out
}

pub fn decode_block(bytes: &[u8]) -> Result<StoredBlock, RejectReason> {
    let mut rest = bytes;
    let header_bytes =
        sunrey_protocol::decode_bytes(&mut rest).map_err(|_| RejectReason::DecodeFailed)?;
    let header = BlockHeader::decode(&header_bytes)?;
    let count =
        sunrey_protocol::decode_u32(&mut rest).map_err(|_| RejectReason::DecodeFailed)? as usize;
    let mut transactions = Vec::with_capacity(count);
    for _ in 0..count {
        let encoded =
            sunrey_protocol::decode_bytes(&mut rest).map_err(|_| RejectReason::DecodeFailed)?;
        transactions.push(SignedTransaction::decode(&encoded)?);
    }
    if !rest.is_empty() {
        return Err(RejectReason::SchemaInvalid);
    }
    Ok(StoredBlock { header, transactions, block_id: [0u8; 32] })
}

fn write_state(root: &Path, view: &ChainView) -> Result<(), RejectReason> {
    let mut out = Vec::new();
    let entries = view.store.entries();
    sunrey_protocol::encode_u32(&mut out, entries.len() as u32);
    for (key, value) in entries {
        sunrey_protocol::encode_bytes(&mut out, &key);
        sunrey_protocol::encode_bytes(&mut out, &value);
    }
    sunrey_protocol::encode_u32(&mut out, view.seen_tx_ids.len() as u32);
    for tx_id in &view.seen_tx_ids {
        sunrey_protocol::encode_bytes(&mut out, tx_id);
    }
    let checksum = checksum32(&out);
    out.extend_from_slice(&checksum.to_be_bytes());
    atomic_write(root.join(FILE_STATE), &out)
}

fn checksum32(bytes: &[u8]) -> u32 {
    let mut acc: u32 = 0x811c_9dc5;
    for byte in bytes {
        acc ^= u32::from(*byte);
        acc = acc.wrapping_mul(0x0100_0193);
    }
    acc
}

pub fn atomic_write(path: impl AsRef<Path>, bytes: &[u8]) -> Result<(), RejectReason> {
    let path = path.as_ref();
    let tmp = path.with_extension("tmp");
    {
        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&tmp)
            .map_err(|_| RejectReason::PersistenceFailure)?;
        file.write_all(bytes).map_err(|_| RejectReason::PersistenceFailure)?;
        file.sync_all().map_err(|_| RejectReason::PersistenceFailure)?;
    }
    fs::rename(&tmp, path).map_err(|_| RejectReason::PersistenceFailure)?;
    if let Some(dir) = path.parent() {
        if let Ok(dir_file) = File::open(dir) {
            let _ = dir_file.sync_all();
        }
    }
    Ok(())
}

pub fn read_file(path: impl AsRef<Path>) -> Result<Vec<u8>, RejectReason> {
    let mut file = File::open(path).map_err(|_| RejectReason::NotFound)?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).map_err(|_| RejectReason::CorruptStore)?;
    Ok(bytes)
}
