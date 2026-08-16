use serde::{Deserialize, Serialize};

use crate::authority::AssetAuthority;
use crate::error::AssetError;
use crate::registry::{NativeAssetId, TICKER_STATUS_NOT_ASSIGNED};

pub const MIGRATION_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AccountMapping {
    pub source_account_id: String,
    pub destination_actor_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MigrationSignature {
    pub suite_id: String,
    pub public_key_hex: String,
    pub signature_hex: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetMigrationManifest {
    pub schema_version: u32,
    pub source_system: AssetAuthority,
    pub destination_system: AssetAuthority,
    pub source_snapshot_id: String,
    pub asset_id: NativeAssetId,
    pub account_mappings: Vec<AccountMapping>,
    pub source_supply_scaled: String,
    pub destination_supply_scaled: String,
    pub merkle_commitment: String,
    pub migration_height: u64,
    pub signatures: Vec<MigrationSignature>,
    pub audit_evidence_id: String,
    pub production_migration_performed: bool,
    pub ticker_status: String,
}

impl AssetMigrationManifest {
    pub fn validate_schema(&self) -> Result<(), AssetError> {
        if self.schema_version != MIGRATION_SCHEMA_VERSION {
            return Err(AssetError::SchemaInvalid);
        }
        if self.source_system != AssetAuthority::CurrentApplicationAuthority {
            return Err(AssetError::WrongAuthority);
        }
        if self.destination_system != AssetAuthority::NativeBlockchainAuthority {
            return Err(AssetError::WrongAuthority);
        }
        if self.ticker_status != TICKER_STATUS_NOT_ASSIGNED {
            return Err(AssetError::SchemaInvalid);
        }
        if self.production_migration_performed {
            return Err(AssetError::WrongAuthority);
        }
        if self.merkle_commitment.len() != 64 {
            return Err(AssetError::SchemaInvalid);
        }
        Ok(())
    }

    pub fn development_fixture() -> Self {
        Self {
            schema_version: MIGRATION_SCHEMA_VERSION,
            source_system: AssetAuthority::CurrentApplicationAuthority,
            destination_system: AssetAuthority::NativeBlockchainAuthority,
            source_snapshot_id: "fixture.application.sunrey_coin.snapshot.v1".to_string(),
            asset_id: NativeAssetId::SunReyCoin,
            account_mappings: vec![AccountMapping {
                source_account_id: "SUNREY.CUSTODY.alice".to_string(),
                destination_actor_id: "actor.alice".to_string(),
            }],
            source_supply_scaled: "0".to_string(),
            destination_supply_scaled: "0".to_string(),
            merkle_commitment: "00".repeat(32),
            migration_height: 0,
            signatures: vec![MigrationSignature {
                suite_id: "SUNREY_DEV_ED25519_SHA256".to_string(),
                public_key_hex: "00".repeat(32),
                signature_hex: "00".repeat(64),
            }],
            audit_evidence_id: "ev.migration.fixture.not_executed".to_string(),
            production_migration_performed: false,
            ticker_status: TICKER_STATUS_NOT_ASSIGNED.to_string(),
        }
    }
}
