use serde::{Deserialize, Serialize};

/// Explicit authority boundary. Application SunRey Coin supply on the
/// canonical Ledger is not the same store as development native-chain units.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AssetAuthority {
    CurrentApplicationAuthority,
    NativeBlockchainAuthority,
}

impl AssetAuthority {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::CurrentApplicationAuthority => "CURRENT_APPLICATION_AUTHORITY",
            Self::NativeBlockchainAuthority => "NATIVE_BLOCKCHAIN_AUTHORITY",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthorityBoundary {
    pub application: AssetAuthority,
    pub native_chain: AssetAuthority,
    pub application_supply_imported: bool,
    pub production_migration_performed: bool,
    pub development_network_distinct: bool,
}

impl AuthorityBoundary {
    pub fn development() -> Self {
        Self {
            application: AssetAuthority::CurrentApplicationAuthority,
            native_chain: AssetAuthority::NativeBlockchainAuthority,
            application_supply_imported: false,
            production_migration_performed: false,
            development_network_distinct: true,
        }
    }

    pub fn public_view(&self) -> serde_json::Value {
        serde_json::json!({
            "application": self.application.as_str(),
            "native_chain": self.native_chain.as_str(),
            "application_supply_imported": self.application_supply_imported,
            "production_migration_performed": self.production_migration_performed,
            "development_network_distinct": self.development_network_distinct,
            "note": "Application SunRey Coin balances have not migrated on-chain.",
        })
    }
}

pub const ECONOMIC_UNIT_LABEL_DEVELOPMENT: &str = "DEVELOPMENT_ECONOMIC_UNIT";
pub const ECONOMIC_UNIT_LABEL_TEST: &str = "TEST";
