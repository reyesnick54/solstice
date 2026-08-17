//! Every durable chain-state schema has an explicit version.

use serde::{Deserialize, Serialize};
use sunrey_protocol::RejectReason;

use crate::checksum::sha256_hex;

/// Production-candidate chain-state schema. File-store development dumps are v0.
pub const PRODUCTION_SCHEMA_VERSION: u32 = 1;
pub const MIN_COMPATIBLE_SCHEMA_VERSION: u32 = 1;
pub const FILE_STORE_SCHEMA_VERSION: u32 = 0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SchemaCompatibility {
    Compatible,
    MigrationRequired,
    UnsupportedFuture,
    CorruptMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SchemaRecord {
    pub schema_version: u32,
    pub min_compatible: u32,
    pub engine: String,
    pub engine_version: String,
    pub record_sha256: String,
}

impl SchemaRecord {
    pub fn production() -> Self {
        let mut record = Self {
            schema_version: PRODUCTION_SCHEMA_VERSION,
            min_compatible: MIN_COMPATIBLE_SCHEMA_VERSION,
            engine: crate::PRODUCTION_ENGINE_NAME.to_string(),
            engine_version: crate::PRODUCTION_ENGINE_VERSION.to_string(),
            record_sha256: String::new(),
        };
        record.record_sha256 = record.compute_hash();
        record
    }

    pub fn compute_hash(&self) -> String {
        sha256_hex(
            format!(
                "{}|{}|{}|{}",
                self.schema_version, self.min_compatible, self.engine, self.engine_version
            )
            .as_bytes(),
        )
    }

    pub fn classify(found: Option<&Self>, current: u32) -> SchemaCompatibility {
        let Some(found) = found else {
            return SchemaCompatibility::CorruptMetadata;
        };
        if found.record_sha256 != found.compute_hash() {
            return SchemaCompatibility::CorruptMetadata;
        }
        if found.schema_version == current {
            SchemaCompatibility::Compatible
        } else if found.schema_version < current && found.schema_version >= found.min_compatible {
            SchemaCompatibility::MigrationRequired
        } else if found.schema_version > current {
            SchemaCompatibility::UnsupportedFuture
        } else {
            SchemaCompatibility::MigrationRequired
        }
    }

    pub fn require_openable(found: Option<&Self>) -> Result<(), RejectReason> {
        match Self::classify(found, PRODUCTION_SCHEMA_VERSION) {
            SchemaCompatibility::Compatible => Ok(()),
            SchemaCompatibility::MigrationRequired => Err(RejectReason::IncompatibleProtocol),
            SchemaCompatibility::UnsupportedFuture => Err(RejectReason::UnsupportedVersion),
            SchemaCompatibility::CorruptMetadata => Err(RejectReason::CorruptStore),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_schema_versions() {
        let current = SchemaRecord::production();
        assert_eq!(
            SchemaRecord::classify(Some(&current), PRODUCTION_SCHEMA_VERSION),
            SchemaCompatibility::Compatible
        );
        let mut future = current.clone();
        future.schema_version = 99;
        future.record_sha256 = future.compute_hash();
        assert_eq!(
            SchemaRecord::classify(Some(&future), PRODUCTION_SCHEMA_VERSION),
            SchemaCompatibility::UnsupportedFuture
        );
        assert_eq!(
            SchemaRecord::classify(None, PRODUCTION_SCHEMA_VERSION),
            SchemaCompatibility::CorruptMetadata
        );
        let mut corrupt = current;
        corrupt.record_sha256 = "00".repeat(32);
        assert_eq!(
            SchemaRecord::classify(Some(&corrupt), PRODUCTION_SCHEMA_VERSION),
            SchemaCompatibility::CorruptMetadata
        );
    }
}
