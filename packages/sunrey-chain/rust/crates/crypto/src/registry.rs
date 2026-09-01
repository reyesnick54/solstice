//! Suite registry and algorithm dispatch. Unknown suites fail closed.

use crate::algorithm_ids::AlgorithmWireId;
use crate::suite::{CryptoSuite, DevEd25519Sha256Suite, ProtocolEd25519Sha256Suite};
use crate::{
    CryptoError, DEV_ALGORITHM_ID, DEV_SUITE_ID, HYBRID_ED25519_MLDSA_SUITE_ID, ML_DSA_65_SUITE_ID,
    PROTOCOL_ALGORITHM_ID, PROTOCOL_SUITE_ID,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RegisteredSuite {
    Dev(DevEd25519Sha256Suite),
    Protocol(ProtocolEd25519Sha256Suite),
}

impl RegisteredSuite {
    pub fn as_crypto_suite(&self) -> &dyn CryptoSuite {
        match self {
            Self::Dev(suite) => suite,
            Self::Protocol(suite) => suite,
        }
    }
}

/// Resolve a suite by ID. PQ and hybrid suites are registered but not
/// implemented in Rust until an approved provider is wired. They fail closed
/// rather than silently mapping to Ed25519.
pub fn resolve_suite(suite_id: &str) -> Result<RegisteredSuite, CryptoError> {
    match suite_id {
        DEV_SUITE_ID => Ok(RegisteredSuite::Dev(DevEd25519Sha256Suite)),
        PROTOCOL_SUITE_ID => Ok(RegisteredSuite::Protocol(ProtocolEd25519Sha256Suite)),
        HYBRID_ED25519_MLDSA_SUITE_ID | ML_DSA_65_SUITE_ID => {
            #[cfg(feature = "experimental-pqc")]
            {
                let _ = suite_id;
                Err(CryptoError::PqNotEnabled)
            }
            #[cfg(not(feature = "experimental-pqc"))]
            {
                let _ = suite_id;
                Err(CryptoError::UnknownSuite)
            }
        }
        _ => Err(CryptoError::UnknownSuite),
    }
}

pub fn algorithm_id_for_suite(suite_id: &str) -> Result<&'static str, CryptoError> {
    match suite_id {
        DEV_SUITE_ID => Ok(DEV_ALGORITHM_ID),
        PROTOCOL_SUITE_ID => Ok(PROTOCOL_ALGORITHM_ID),
        HYBRID_ED25519_MLDSA_SUITE_ID => Ok("HYBRID_ED25519_MLDSA_V1"),
        ML_DSA_65_SUITE_ID => Ok("ML_DSA_65_V1"),
        _ => Err(CryptoError::UnknownSuite),
    }
}

pub fn algorithm_wire_id_for_suite(suite_id: &str) -> Result<AlgorithmWireId, CryptoError> {
    match suite_id {
        DEV_SUITE_ID => Ok(AlgorithmWireId::Ed25519Dev),
        PROTOCOL_SUITE_ID => Ok(AlgorithmWireId::Ed25519),
        HYBRID_ED25519_MLDSA_SUITE_ID => Ok(AlgorithmWireId::HybridEd25519MlDsaV1),
        ML_DSA_65_SUITE_ID => Ok(AlgorithmWireId::MlDsa65V1),
        _ => Err(CryptoError::UnknownSuite),
    }
}

/// Convenience for callers that only need the development suite.
pub fn dev_suite() -> DevEd25519Sha256Suite {
    DevEd25519Sha256Suite
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classical_suites_resolve() {
        assert!(resolve_suite(DEV_SUITE_ID).is_ok());
        assert!(resolve_suite(PROTOCOL_SUITE_ID).is_ok());
    }

    #[test]
    fn pq_suites_fail_closed_without_fallback() {
        assert!(matches!(
            resolve_suite(HYBRID_ED25519_MLDSA_SUITE_ID),
            Err(CryptoError::UnknownSuite) | Err(CryptoError::PqNotEnabled)
        ));
        assert!(matches!(
            resolve_suite(ML_DSA_65_SUITE_ID),
            Err(CryptoError::UnknownSuite) | Err(CryptoError::PqNotEnabled)
        ));
    }

    #[test]
    fn unknown_suite_fails_closed() {
        assert_eq!(resolve_suite("sunrey-secp256k1-v1"), Err(CryptoError::UnknownSuite));
    }
}
