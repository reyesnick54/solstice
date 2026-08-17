//! Chunk 54 snapshot integration for the production-candidate engine.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sunrey_protocol::RejectReason;

use crate::checksum::sha256_hex;
use crate::engine::FailPoint;
use crate::schema::PRODUCTION_SCHEMA_VERSION;
use crate::ChainStore;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProductionSnapshotManifest {
    pub network: String,
    pub chain: String,
    pub height: u64,
    pub block_id: String,
    pub state_root: String,
    pub storage_schema: u32,
    pub protocol_version: String,
    pub hash_manifest: String,
    pub payload_sha256: String,
}

impl ProductionSnapshotManifest {
    pub fn compute_hash(&self) -> String {
        sha256_hex(
            format!(
                "{}|{}|{}|{}|{}|{}|{}|{}",
                self.network,
                self.chain,
                self.height,
                self.block_id,
                self.state_root,
                self.storage_schema,
                self.protocol_version,
                self.payload_sha256
            )
            .as_bytes(),
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProductionSnapshot {
    pub manifest: ProductionSnapshotManifest,
    pub payload_dir: PathBuf,
}

pub fn create_production_snapshot(
    store: &ChainStore,
    dest: impl AsRef<Path>,
    network: &str,
    chain: &str,
    protocol_version: &str,
    fail_point: FailPoint,
) -> Result<ProductionSnapshot, RejectReason> {
    if fail_point == FailPoint::DuringSnapshot {
        return Err(RejectReason::PersistenceFailure);
    }
    let dest = dest.as_ref().to_path_buf();
    std::fs::create_dir_all(&dest).map_err(|_| RejectReason::PersistenceFailure)?;
    store.export_engine(&dest)?;
    let payload = read_dir_bytes(&dest)?;
    let mut manifest = ProductionSnapshotManifest {
        network: network.to_string(),
        chain: chain.to_string(),
        height: store.meta.height,
        block_id: store.meta.tip_block_id.clone(),
        state_root: store.meta.app_hash.clone(),
        storage_schema: PRODUCTION_SCHEMA_VERSION,
        protocol_version: protocol_version.to_string(),
        hash_manifest: String::new(),
        payload_sha256: sha256_hex(&payload),
    };
    manifest.hash_manifest = manifest.compute_hash();
    crate::file_store::atomic_write(
        dest.join("manifest.json"),
        &serde_json::to_vec_pretty(&manifest).map_err(|_| RejectReason::PersistenceFailure)?,
    )?;
    Ok(ProductionSnapshot { manifest, payload_dir: dest })
}

pub fn verify_production_snapshot(snapshot: &ProductionSnapshot) -> Result<(), RejectReason> {
    if snapshot.manifest.hash_manifest != snapshot.manifest.compute_hash() {
        return Err(RejectReason::CorruptStore);
    }
    let payload = read_dir_bytes(&snapshot.payload_dir)?;
    if sha256_hex(&payload) != snapshot.manifest.payload_sha256 {
        return Err(RejectReason::CorruptStore);
    }
    Ok(())
}

pub fn restore_production_snapshot(
    snapshot: &ProductionSnapshot,
    dest: impl AsRef<Path>,
) -> Result<ChainStore, RejectReason> {
    verify_production_snapshot(snapshot)?;
    if snapshot.manifest.storage_schema != PRODUCTION_SCHEMA_VERSION {
        return Err(RejectReason::UnsupportedVersion);
    }
    let dest = dest.as_ref();
    std::fs::create_dir_all(dest).map_err(|_| RejectReason::PersistenceFailure)?;
    let src_db = snapshot.payload_dir.join(crate::PRODUCTION_DB_FILE);
    if src_db.exists() {
        std::fs::copy(&src_db, dest.join(crate::PRODUCTION_DB_FILE))
            .map_err(|_| RejectReason::PersistenceFailure)?;
    }
    let store = ChainStore::open(dest)?;
    if store.meta.height != snapshot.manifest.height
        || store.meta.tip_block_id != snapshot.manifest.block_id
        || store.meta.app_hash != snapshot.manifest.state_root
    {
        return Err(RejectReason::WrongStateRoot);
    }
    Ok(store)
}

fn read_dir_bytes(dir: &Path) -> Result<Vec<u8>, RejectReason> {
    let mut names: Vec<_> = std::fs::read_dir(dir)
        .map_err(|_| RejectReason::PersistenceFailure)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.file_name().and_then(|n| n.to_str()) != Some("manifest.json"))
        .collect();
    names.sort();
    let mut out = Vec::new();
    for path in names {
        if path.is_file() {
            out.extend_from_slice(&crate::file_store::read_file(path)?);
        }
    }
    Ok(out)
}

pub fn mutate_snapshot_chunk(snapshot: &ProductionSnapshot) -> Result<(), RejectReason> {
    let db = snapshot.payload_dir.join(crate::PRODUCTION_DB_FILE);
    if !db.exists() {
        return Err(RejectReason::NotFound);
    }
    let mut bytes = crate::file_store::read_file(&db)?;
    if bytes.len() > 64 {
        let idx = bytes.len() / 2;
        bytes[idx] ^= 0xff;
    }
    std::fs::write(db, bytes).map_err(|_| RejectReason::PersistenceFailure)
}
