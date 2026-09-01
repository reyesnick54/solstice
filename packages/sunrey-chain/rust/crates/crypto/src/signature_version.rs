//! Versioned signature encoding identifiers.
//!
//! `SignatureVersion` selects the envelope layout for a signature blob.
//! Values are explicit `u8` wire IDs, not enum ordinals.

use crate::CryptoError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum SignatureVersion {
    /// Raw classical signature (Ed25519: 64 bytes).
    ClassicalV1 = 1,
    /// Structured hybrid envelope (`CLASSICAL_AND_PQ`).
    HybridV1 = 2,
    /// Raw PQ signature (ML-DSA-65 parameter set).
    PqNativeV1 = 3,
}

impl SignatureVersion {
    pub fn from_u8(value: u8) -> Result<Self, CryptoError> {
        match value {
            1 => Ok(Self::ClassicalV1),
            2 => Ok(Self::HybridV1),
            3 => Ok(Self::PqNativeV1),
            _ => Err(CryptoError::UnknownSignatureVersion),
        }
    }

    pub fn to_u8(self) -> u8 {
        self as u8
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::ClassicalV1 => "CLASSICAL_V1",
            Self::HybridV1 => "HYBRID_V1",
            Self::PqNativeV1 => "PQ_NATIVE_V1",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_wire_ids_are_stable() {
        assert_eq!(SignatureVersion::ClassicalV1.to_u8(), 1);
        assert_eq!(SignatureVersion::HybridV1.to_u8(), 2);
        assert_eq!(SignatureVersion::PqNativeV1.to_u8(), 3);
    }

    #[test]
    fn unknown_version_fails_closed() {
        assert_eq!(SignatureVersion::from_u8(0), Err(CryptoError::UnknownSignatureVersion));
        assert_eq!(SignatureVersion::from_u8(255), Err(CryptoError::UnknownSignatureVersion));
    }
}
