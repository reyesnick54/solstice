//! CryptoSuite provider ports for the SunRey Blockchain.
//!
//! Algorithm choice lives only in this crate. State and execution modules
//! receive a [`CryptoSuite`] and must not name a concrete algorithm.

#![forbid(unsafe_code)]

mod algorithm_ids;
mod envelope;
mod migration;
mod registry;
mod signature_version;
mod suite;
mod verify;

pub use algorithm_ids::{AlgorithmWireId, KeyId};
pub use envelope::{
    HybridCombiner, HybridSignatureEnvelope, HybridVerificationPolicy, PublicKeyEnvelope,
    SignatureEnvelope,
};
pub use migration::{
    historical_verify_allowed, migration_state_at_height, recommended_verification_model,
    role_accepts_suite_for_sign, CryptoMigrationState, CryptoOperationCategory,
    HeightActivatedCryptoSchedule, MigrationVerificationModel, HYBRID_REQUIRED_ROLES,
};
pub use registry::{algorithm_wire_id_for_suite, dev_suite, resolve_suite, RegisteredSuite};
pub use signature_version::SignatureVersion;
pub use suite::{
    development_fixture_secret, verify_ed25519, CryptoSuite, DevEd25519Sha256Suite,
    ProtocolEd25519Sha256Suite, SigningSecret,
};
pub use verify::{
    dispatch_verify, reject_algorithm_downgrade, sign, verify_envelope, verify_hybrid_envelope,
};

use sunrey_protocol::{
    encode_string, DomainHasher, Hash32, RejectReason, DOMAIN_CRYPTO_POLICY, DOMAIN_SCHEMA,
};

pub const DEV_SUITE_ID: &str = "SUNREY_DEV_ED25519_SHA256";
pub const DEV_ALGORITHM_ID: &str = "ED25519";
pub const PROTOCOL_SUITE_ID: &str = "sunrey-ed25519-v1";
pub const PROTOCOL_ALGORITHM_ID: &str = "Ed25519";
pub const HYBRID_ED25519_MLDSA_SUITE_ID: &str = "sunrey-hybrid-ed25519-mldsa-v1";
pub const ML_DSA_65_SUITE_ID: &str = "sunrey-mldsa-65-v1";
pub const ML_DSA_65_V1: &str = "ML_DSA_65_V1";
pub const MAX_PQ_SIGNATURE_BYTES: usize = 8192;
pub const MAX_HYBRID_ENVELOPE_BYTES: usize = 16384;
pub const MAX_REMOTE_SIGNER_SIGNATURE_BYTES: usize = 16384;
pub const MAX_P2P_PQ_MESSAGE_BYTES: usize = 1_048_576;
pub const DEV_SUITE_LIFECYCLE: &str = "APPROVED_FOR_SIMULATION";
pub const DEV_KEY_ID: &str = "dev_fixture_key_v1";

#[derive(Debug, thiserror::Error, Clone, PartialEq, Eq)]
pub enum CryptoError {
    #[error("unknown crypto suite")]
    UnknownSuite,
    #[error("unknown algorithm")]
    UnknownAlgorithm,
    #[error("unknown signature version")]
    UnknownSignatureVersion,
    #[error("invalid signature descriptor")]
    InvalidDescriptor,
    #[error("invalid signature")]
    InvalidSignature,
    #[error("post-quantum cryptography is not enabled")]
    PqNotEnabled,
}

impl From<CryptoError> for RejectReason {
    fn from(value: CryptoError) -> Self {
        match value {
            CryptoError::UnknownSuite
            | CryptoError::UnknownAlgorithm
            | CryptoError::PqNotEnabled => RejectReason::InvalidCryptoSuite,
            CryptoError::UnknownSignatureVersion | CryptoError::InvalidDescriptor => {
                RejectReason::InvalidSignatureDescriptor
            }
            CryptoError::InvalidSignature => RejectReason::InvalidSignature,
        }
    }
}

/// Backwards-compatible suite resolver used by the node and validators.
///
/// Both development and protocol classical suites map to the same
/// [`DevEd25519Sha256Suite`] implementation. PQ and hybrid suites fail closed.
pub fn suite_by_id(suite_id: &str) -> Result<DevEd25519Sha256Suite, CryptoError> {
    match suite_id {
        DEV_SUITE_ID | PROTOCOL_SUITE_ID => Ok(DevEd25519Sha256Suite),
        HYBRID_ED25519_MLDSA_SUITE_ID | ML_DSA_65_SUITE_ID => {
            #[cfg(feature = "experimental-pqc")]
            {
                Err(CryptoError::PqNotEnabled)
            }
            #[cfg(not(feature = "experimental-pqc"))]
            {
                Err(CryptoError::UnknownSuite)
            }
        }
        _ => Err(CryptoError::UnknownSuite),
    }
}

pub fn algorithm_id_for_suite(suite_id: &str) -> Result<&'static str, CryptoError> {
    registry::algorithm_id_for_suite(suite_id)
}

pub fn schema_registry_hash(hasher: &dyn DomainHasher) -> Hash32 {
    hasher.hash(DOMAIN_SCHEMA, sunrey_protocol::SCHEMA_REGISTRY_DOCUMENT.as_bytes())
}

pub fn crypto_policy_hash(hasher: &dyn DomainHasher) -> Hash32 {
    let mut payload = Vec::new();
    encode_string(&mut payload, DEV_SUITE_ID);
    encode_string(&mut payload, DEV_ALGORITHM_ID);
    encode_string(&mut payload, DEV_SUITE_LIFECYCLE);
    hasher.hash(DOMAIN_CRYPTO_POLICY, &payload)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sunrey_protocol::unsigned_signature_payload;

    #[test]
    fn fixture_key_signs_and_verifies() {
        let suite = DevEd25519Sha256Suite;
        let secret = development_fixture_secret();
        let unsigned = sunrey_protocol::UnsignedTransaction {
            network_id: sunrey_protocol::LOCAL_DEV_NETWORK_ID.to_string(),
            chain_id: sunrey_protocol::LOCAL_DEV_CHAIN_ID.to_string(),
            codec_id: sunrey_protocol::SRCB_CODEC_ID.to_string(),
            schema_version: 1,
            family: sunrey_protocol::TransactionFamily::System,
            nonce: 0,
            idempotency_key: "k1".to_string(),
            payload: vec![1],
        };
        let message = unsigned_signature_payload(&suite, &unsigned);
        let signature = suite.sign(&secret, &message).unwrap();
        suite.verify(&secret.public_key(), &message, &signature).unwrap();
    }

    #[test]
    fn standardized_pq_suites_fail_closed_without_ed25519_fallback() {
        assert!(matches!(
            suite_by_id(HYBRID_ED25519_MLDSA_SUITE_ID),
            Err(CryptoError::UnknownSuite) | Err(CryptoError::PqNotEnabled)
        ));
        assert!(matches!(
            suite_by_id(ML_DSA_65_SUITE_ID),
            Err(CryptoError::UnknownSuite) | Err(CryptoError::PqNotEnabled)
        ));
        const _: () = assert!(MAX_REMOTE_SIGNER_SIGNATURE_BYTES >= 3309);
        assert_eq!(MAX_P2P_PQ_MESSAGE_BYTES, 1_048_576);
    }

    #[test]
    fn resolve_suite_dispatches_protocol_and_dev() {
        assert!(resolve_suite(DEV_SUITE_ID).is_ok());
        assert!(resolve_suite(PROTOCOL_SUITE_ID).is_ok());
    }

    #[test]
    fn versioned_sign_compat_with_existing_classical() {
        let secret = development_fixture_secret();
        let suite = DevEd25519Sha256Suite;
        let message = b"classical-fixture";
        let legacy = suite.sign(&secret, message).unwrap();
        let envelope = sign(DEV_SUITE_ID, &secret, message).unwrap();
        assert_eq!(legacy, envelope.signature);
    }

    #[test]
    fn malformed_public_key_rejects() {
        let suite = DevEd25519Sha256Suite;
        assert_eq!(
            suite.verify(&[0u8; 16], b"msg", &[0u8; 64]),
            Err(CryptoError::InvalidDescriptor)
        );
    }

    #[test]
    fn malformed_signature_rejects() {
        let secret = development_fixture_secret();
        let suite = DevEd25519Sha256Suite;
        assert_eq!(
            suite.verify(&secret.public_key(), b"msg", &[0u8; 32]),
            Err(CryptoError::InvalidDescriptor)
        );
    }

    #[test]
    fn unknown_algorithm_wire_id_fails_closed() {
        assert_eq!(AlgorithmWireId::from_u16(0), Err(CryptoError::UnknownAlgorithm));
    }

    #[test]
    fn compatibility_with_protocol_vectors() {
        use sunrey_protocol::{
            encode_system_payload, hash_to_hex, transaction_id, SystemPayload, TransactionFamily,
            UnsignedTransaction, LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, SCHEMA_VERSION,
            SRCB_CODEC_ID,
        };
        let payload = encode_system_payload(&SystemPayload {
            op: "SET_OBJECT".to_string(),
            object_key: "alpha".to_string(),
            object_value: b"one".to_vec(),
        });
        let unsigned = UnsignedTransaction {
            network_id: LOCAL_DEV_NETWORK_ID.to_string(),
            chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
            codec_id: SRCB_CODEC_ID.to_string(),
            schema_version: SCHEMA_VERSION,
            family: TransactionFamily::System,
            nonce: 0,
            idempotency_key: "vector-1".to_string(),
            payload,
        };
        assert_eq!(
            hash_to_hex(&transaction_id(&DevEd25519Sha256Suite, &unsigned)),
            "66a121afafb7f545ae5dddfedd43bc0e17bdc758e919f4e16ac5943811f5b993"
        );
    }
}
