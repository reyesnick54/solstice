//! Canonical StorageEngine operations.

use std::path::Path;

use serde::{Deserialize, Serialize};
use sunrey_protocol::RejectReason;
use sunrey_state::ChainView;

use crate::durability::DurabilityPolicy;
use crate::schema::{SchemaCompatibility, SchemaRecord};
use crate::{ChainMeta, StoredBlock};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeRetentionMode {
    Archive,
    Pruned { retain_finalized_blocks: u64 },
}

impl NodeRetentionMode {
    pub fn archive() -> Self {
        Self::Archive
    }

    pub fn pruned(retain_finalized_blocks: u64) -> Self {
        Self::Pruned { retain_finalized_blocks: retain_finalized_blocks.max(1) }
    }

    pub fn may_drop_block(self, height: u64, finalized_height: u64) -> bool {
        match self {
            Self::Archive => false,
            Self::Pruned { retain_finalized_blocks } => {
                if height == 0 || height >= finalized_height {
                    return false;
                }
                finalized_height.saturating_sub(height) > retain_finalized_blocks
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommitMetadata {
    pub height: u64,
    pub block_id: String,
    pub state_root: String,
    pub protocol_version: u32,
    pub schema_version: u32,
    pub native_supply: String,
    pub validator_set: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StorageHealth {
    pub engine: String,
    pub schema_version: u32,
    pub schema: SchemaCompatibility,
    pub durability: DurabilityPolicy,
    pub mode: NodeRetentionMode,
    pub height: u64,
    pub ready: bool,
    pub errors: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct StorageMetrics {
    pub chain_db_bytes: u64,
    pub state_db_bytes: u64,
    pub block_db_bytes: u64,
    pub wal_bytes: u64,
    pub snapshot_bytes: u64,
    pub storage_write_latency_us: u64,
    pub storage_read_latency_us: u64,
    pub storage_errors: u64,
    pub remaining_capacity_bytes: u64,
}

/// Canonical storage operations. Implementations must not become a second
/// financial ledger.
pub trait StorageEngine {
    fn read(&self, namespace: &str, key: &[u8]) -> Result<Option<Vec<u8>>, RejectReason>;
    fn atomic_batch_write(
        &mut self,
        writes: &[(String, Vec<u8>, Vec<u8>)],
    ) -> Result<(), RejectReason>;
    fn persist_block(&mut self, height: u64, bytes: &[u8]) -> Result<(), RejectReason>;
    fn persist_metadata(&mut self, key: &str, value: &[u8]) -> Result<(), RejectReason>;
    fn commit_state(&mut self, view: &ChainView, meta: &ChainMeta) -> Result<(), RejectReason>;
    fn snapshot(&self, dest: &Path) -> Result<(), RejectReason>;
    fn verify_integrity(&self) -> Result<(), RejectReason>;
    fn schema_version(&self) -> Result<SchemaRecord, RejectReason>;
    fn health(&self) -> Result<StorageHealth, RejectReason>;
    fn load_block(&self, height: u64) -> Result<StoredBlock, RejectReason>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FailPoint {
    None,
    BeforeExecution,
    DuringExecution,
    BeforeDatabaseCommit,
    DuringPersistence,
    AfterCommitBeforeResponse,
    DuringStateWrite,
    DuringMetadataWrite,
    DuringSnapshot,
    DuringMigration,
}
