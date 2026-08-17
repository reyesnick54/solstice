//! Explicit fsync / durability policy. Production prefers correctness over
//! benchmark-only throughput.

use redb::Durability;
use serde::{Deserialize, Serialize};

/// When a write is considered durably committed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DurabilityClass {
    /// fsync WAL + data before commit returns. Production candidate default.
    ImmediateFsync,
    /// Group commit; may lose the last few milliseconds after a power loss.
    Eventual,
    /// Memory only. Tests / benchmarks. Never a production candidate.
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DurabilityPolicy {
    pub class: DurabilityClass,
    pub prefer_correctness: bool,
}

impl DurabilityPolicy {
    pub const PRODUCTION_CANDIDATE: Self =
        Self { class: DurabilityClass::ImmediateFsync, prefer_correctness: true };

    pub const DEVELOPMENT: Self =
        Self { class: DurabilityClass::Eventual, prefer_correctness: false };

    pub fn redb_durability(self) -> Durability {
        match self.class {
            DurabilityClass::ImmediateFsync => Durability::Immediate,
            DurabilityClass::Eventual => Durability::Eventual,
            DurabilityClass::None => Durability::None,
        }
    }

    pub fn committed_when(self) -> &'static str {
        match self.class {
            DurabilityClass::ImmediateFsync => {
                "after the engine write transaction returns Ok: WAL and data pages have been fsynced"
            }
            DurabilityClass::Eventual => {
                "after the engine acknowledges the transaction; a power loss may drop the newest commits"
            }
            DurabilityClass::None => "only in process memory; a crash loses unflushed writes",
        }
    }
}

impl Default for DurabilityPolicy {
    fn default() -> Self {
        Self::PRODUCTION_CANDIDATE
    }
}
