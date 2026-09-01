//! Explicit, wire-stable algorithm identifiers.
//!
//! Unknown IDs fail closed. Providers must not silently fall back to another
//! algorithm. Wire IDs are fixed `u16` values — never Rust enum ordinals.

use crate::CryptoError;

/// Stable on-the-wire algorithm identifier. Values are assigned explicitly.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u16)]
pub enum AlgorithmWireId {
    Ed25519 = 1,
    Ed25519Dev = 2,
    MlDsa65V1 = 3,
    SlhDsaSha2128sV1 = 4,
    HybridEd25519MlDsaV1 = 5,
    MlKem768V1 = 6,
}

impl AlgorithmWireId {
    pub fn from_u16(value: u16) -> Result<Self, CryptoError> {
        match value {
            1 => Ok(Self::Ed25519),
            2 => Ok(Self::Ed25519Dev),
            3 => Ok(Self::MlDsa65V1),
            4 => Ok(Self::SlhDsaSha2128sV1),
            5 => Ok(Self::HybridEd25519MlDsaV1),
            6 => Ok(Self::MlKem768V1),
            _ => Err(CryptoError::UnknownAlgorithm),
        }
    }

    pub fn to_u16(self) -> u16 {
        self as u16
    }

    pub fn canonical_name(self) -> &'static str {
        match self {
            Self::Ed25519 => "Ed25519",
            Self::Ed25519Dev => "ED25519",
            Self::MlDsa65V1 => "ML_DSA_65_V1",
            Self::SlhDsaSha2128sV1 => "SLH_DSA_SHA2_128S_V1",
            Self::HybridEd25519MlDsaV1 => "HYBRID_ED25519_MLDSA_V1",
            Self::MlKem768V1 => "ML_KEM_768_V1",
        }
    }

    pub fn is_pq_signature(self) -> bool {
        matches!(self, Self::MlDsa65V1 | Self::SlhDsaSha2128sV1)
    }

    pub fn is_hybrid(self) -> bool {
        self == Self::HybridEd25519MlDsaV1
    }

    pub fn is_classical_signature(self) -> bool {
        matches!(self, Self::Ed25519 | Self::Ed25519Dev)
    }

    pub fn from_name(name: &str) -> Result<Self, CryptoError> {
        match name {
            "Ed25519" => Ok(Self::Ed25519),
            "ED25519" => Ok(Self::Ed25519Dev),
            "ML_DSA_65_V1" | "ML-DSA-65" => Ok(Self::MlDsa65V1),
            "SLH_DSA_SHA2_128S_V1" | "SLH-DSA-SHA2-128S" => Ok(Self::SlhDsaSha2128sV1),
            "HYBRID_ED25519_MLDSA_V1" => Ok(Self::HybridEd25519MlDsaV1),
            "ML_KEM_768_V1" | "ML-KEM-768" => Ok(Self::MlKem768V1),
            _ => Err(CryptoError::UnknownAlgorithm),
        }
    }
}

/// Branded key identifier carried in descriptors and envelopes.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct KeyId(pub String);

impl KeyId {
    pub fn new(value: impl Into<String>) -> Result<Self, CryptoError> {
        let value = value.into();
        if value.is_empty() {
            return Err(CryptoError::InvalidDescriptor);
        }
        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wire_ids_are_stable() {
        assert_eq!(AlgorithmWireId::Ed25519.to_u16(), 1);
        assert_eq!(AlgorithmWireId::MlDsa65V1.to_u16(), 3);
        assert_eq!(AlgorithmWireId::HybridEd25519MlDsaV1.to_u16(), 5);
    }

    #[test]
    fn unknown_wire_id_fails_closed() {
        assert_eq!(AlgorithmWireId::from_u16(0), Err(CryptoError::UnknownAlgorithm));
        assert_eq!(AlgorithmWireId::from_u16(999), Err(CryptoError::UnknownAlgorithm));
    }

    #[test]
    fn unknown_name_fails_closed() {
        assert_eq!(AlgorithmWireId::from_name("secp256k1"), Err(CryptoError::UnknownAlgorithm));
        assert_eq!(AlgorithmWireId::from_name(""), Err(CryptoError::UnknownAlgorithm));
    }

    #[test]
    fn name_round_trip() {
        for id in [
            AlgorithmWireId::Ed25519,
            AlgorithmWireId::Ed25519Dev,
            AlgorithmWireId::MlDsa65V1,
            AlgorithmWireId::HybridEd25519MlDsaV1,
        ] {
            let name = id.canonical_name();
            assert_eq!(AlgorithmWireId::from_name(name).unwrap(), id);
        }
    }
}
