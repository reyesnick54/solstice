//! Controlled storage migration. Engineering only — not a testnet-to-mainnet path.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sunrey_protocol::RejectReason;
use sunrey_state::{NS_ASSET, NS_SYSTEM};

use crate::checksum::sha256_hex;
use crate::engine::FailPoint;
use crate::file_store;
use crate::redb_engine::RedbEngine;
use crate::schema::PRODUCTION_SCHEMA_VERSION;
use crate::{ChainMeta, ChainStore, DurabilityPolicy, NodeRetentionMode};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommitFingerprint {
    pub height: u64,
    pub block_id: String,
    pub state_root: String,
    pub native_supply: String,
    pub validator_set: String,
}

pub fn fingerprint(view: &sunrey_state::ChainView, meta: &ChainMeta) -> CommitFingerprint {
    CommitFingerprint {
        height: meta.height,
        block_id: meta.tip_block_id.clone(),
        state_root: meta.app_hash.clone(),
        native_supply: namespace_hash(view, NS_ASSET),
        validator_set: namespace_hash(view, NS_SYSTEM),
    }
}

fn namespace_hash(view: &sunrey_state::ChainView, prefix: &[u8]) -> String {
    let mut acc = Vec::new();
    for (key, value) in view.store.entries() {
        if key.starts_with(prefix) {
            acc.extend_from_slice(&key);
            acc.extend_from_slice(&value);
        }
    }
    sha256_hex(&acc)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MigrationReport {
    pub migration_id: String,
    pub source_engine: String,
    pub destination_engine: String,
    pub source_schema: u32,
    pub target_schema: u32,
    pub source_hash: String,
    pub destination_hash: String,
    pub source_fingerprint: CommitFingerprint,
    pub destination_fingerprint: CommitFingerprint,
    pub restartable: bool,
    pub idempotent: bool,
    pub verified: bool,
    pub engineering_only: bool,
    pub not_testnet_to_production: bool,
}

pub fn migrate_file_store_to_production(
    source: impl AsRef<Path>,
    destination: impl AsRef<Path>,
    fail_point: FailPoint,
) -> Result<MigrationReport, RejectReason> {
    let source = source.as_ref();
    let destination = destination.as_ref();
    if fail_point == FailPoint::DuringMigration {
        return Err(RejectReason::PersistenceFailure);
    }
    let src = ChainStore::open_file(source)?;
    let source_fp = fingerprint(&src.view, &src.meta);
    let source_hash = sha256_hex(
        format!("{}|{}|{}", source_fp.height, source_fp.block_id, source_fp.state_root).as_bytes(),
    );
    std::fs::create_dir_all(destination).map_err(|_| RejectReason::PersistenceFailure)?;
    let progress = destination.join("migration.progress.json");
    if progress.exists() {
        if let Ok(existing) =
            serde_json::from_slice::<MigrationReport>(&std::fs::read(&progress).unwrap_or_default())
        {
            if existing.verified {
                return Ok(existing);
            }
        }
    }
    let mut dest =
        ChainStore::init_production(destination, src.genesis.clone(), [0u8; 32], [0u8; 32])?;
    dest.view = src.view.clone();
    dest.meta = src.meta.clone();
    dest.meta.schema_version = PRODUCTION_SCHEMA_VERSION;
    dest.persist_state_and_meta()?;
    for height in 1..=src.meta.height {
        match file_store::load_block(source, height, src.meta.height) {
            Ok(block) => dest.import_block(height, &block)?,
            Err(RejectReason::NotFound) => continue,
            Err(err) => return Err(err),
        }
    }
    dest.reindex_from_view()?;
    let dest_fp = fingerprint(&dest.view, &dest.meta);
    if dest_fp != source_fp {
        return Err(RejectReason::WrongStateRoot);
    }
    let destination_hash = sha256_hex(
        format!("{}|{}|{}", dest_fp.height, dest_fp.block_id, dest_fp.state_root).as_bytes(),
    );
    let report = MigrationReport {
        migration_id: format!("mig_{}_{}", source_fp.height, &source_hash[..12]),
        source_engine: "file-store".to_string(),
        destination_engine: crate::PRODUCTION_ENGINE_NAME.to_string(),
        source_schema: crate::schema::FILE_STORE_SCHEMA_VERSION,
        target_schema: PRODUCTION_SCHEMA_VERSION,
        source_hash,
        destination_hash,
        source_fingerprint: source_fp,
        destination_fingerprint: dest_fp,
        restartable: true,
        idempotent: true,
        verified: true,
        engineering_only: true,
        not_testnet_to_production: true,
    };
    crate::file_store::atomic_write(
        progress,
        &serde_json::to_vec_pretty(&report).map_err(|_| RejectReason::PersistenceFailure)?,
    )?;
    let _ = dest.production_db_path();
    let _ = RedbEngine::open(
        destination.join(crate::PRODUCTION_DB_FILE),
        DurabilityPolicy::PRODUCTION_CANDIDATE,
    );
    let _ = NodeRetentionMode::Archive;
    let _ = PathBuf::from(".");
    Ok(report)
}

pub fn fingerprints_equal(before: &CommitFingerprint, after: &CommitFingerprint) -> bool {
    before == after
        && before.height == after.height
        && before.block_id == after.block_id
        && before.state_root == after.state_root
        && before.native_supply == after.native_supply
        && before.validator_set == after.validator_set
}
