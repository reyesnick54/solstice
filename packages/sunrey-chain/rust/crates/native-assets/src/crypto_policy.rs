use serde::{Deserialize, Serialize};

use crate::error::AssetError;

/// Crypto agility for native asset signatures. Asset code must not name
/// Ed25519. Verification is routed through [`AssetCrypto`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CryptoClass {
    Classical,
    Hybrid,
    Pq,
}

impl CryptoClass {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Classical => "CLASSICAL",
            Self::Hybrid => "HYBRID",
            Self::Pq => "PQ",
        }
    }

    pub fn parse(value: &str) -> Result<Self, AssetError> {
        match value {
            "CLASSICAL" => Ok(Self::Classical),
            "HYBRID" => Ok(Self::Hybrid),
            "PQ" => Ok(Self::Pq),
            _ => Err(AssetError::InvalidCryptoSuite),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CryptoPolicy {
    pub class: CryptoClass,
    pub suite_id: String,
    pub algorithm_id: String,
}

impl CryptoPolicy {
    pub fn development_classical(suite_id: &str, algorithm_id: &str) -> Self {
        Self {
            class: CryptoClass::Classical,
            suite_id: suite_id.to_string(),
            algorithm_id: algorithm_id.to_string(),
        }
    }

    pub fn matches(&self, suite_id: &str, algorithm_id: &str) -> Result<(), AssetError> {
        if self.suite_id != suite_id || self.algorithm_id != algorithm_id {
            return Err(AssetError::InvalidCryptoSuite);
        }
        Ok(())
    }
}

/// Signature verification port. Implementations live in crypto / node crates.
pub trait AssetCrypto: Send + Sync {
    fn suite_id(&self) -> &str;
    fn algorithm_id(&self) -> &str;
    fn crypto_class(&self) -> CryptoClass {
        CryptoClass::Classical
    }
    fn verify(&self, public_key: &[u8], message: &[u8], signature: &[u8])
        -> Result<(), AssetError>;
}
