//! CryptoSuite provider ports for the local SunRey node.
//!
//! Algorithm choice lives only in this crate. State and execution modules
//! receive a [`CryptoSuite`] and must not name a concrete algorithm.

#![forbid(unsafe_code)]

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};
use sunrey_protocol::{
    domain_payload, encode_string, DomainHasher, Hash32, RejectReason, DOMAIN_CRYPTO_POLICY,
    DOMAIN_SCHEMA,
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
const DEV_KEY_LABEL: &[u8] = b"SUNREY_LOCAL_DEV_FIXTURE_KEY_NOT_FOR_PRODUCTION_v1";

#[derive(Debug, thiserror::Error, Clone, PartialEq, Eq)]
pub enum CryptoError {
    #[error("unknown crypto suite")]
    UnknownSuite,
    #[error("invalid signature descriptor")]
    InvalidDescriptor,
    #[error("invalid signature")]
    InvalidSignature,
}

impl From<CryptoError> for RejectReason {
    fn from(value: CryptoError) -> Self {
        match value {
            CryptoError::UnknownSuite => RejectReason::InvalidCryptoSuite,
            CryptoError::InvalidDescriptor => RejectReason::InvalidSignatureDescriptor,
            CryptoError::InvalidSignature => RejectReason::InvalidSignature,
        }
    }
}

pub trait CryptoSuite: DomainHasher + Send + Sync {
    fn suite_id(&self) -> &'static str;
    fn algorithm_id(&self) -> &'static str;
    fn sign(&self, secret: &SigningSecret, message: &[u8]) -> Result<Vec<u8>, CryptoError>;
    fn verify(
        &self,
        public_key: &[u8],
        message: &[u8],
        signature: &[u8],
    ) -> Result<(), CryptoError>;
}

#[derive(Clone)]
pub struct SigningSecret {
    bytes: [u8; 32],
}

impl SigningSecret {
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self { bytes }
    }

    pub fn public_key(&self) -> Vec<u8> {
        SigningKey::from_bytes(&self.bytes).verifying_key().to_bytes().to_vec()
    }
}

/// Development-only fixture key. Not production key infrastructure.
pub fn development_fixture_secret() -> SigningSecret {
    let digest = Sha256::digest(DEV_KEY_LABEL);
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(&digest);
    SigningSecret { bytes }
}

#[derive(Debug, Default, Clone)]
pub struct DevEd25519Sha256Suite;

impl DomainHasher for DevEd25519Sha256Suite {
    fn hash(&self, domain: &str, payload: &[u8]) -> Hash32 {
        let framed = domain_payload(domain, payload);
        Sha256::digest(&framed).into()
    }
}

impl CryptoSuite for DevEd25519Sha256Suite {
    fn suite_id(&self) -> &'static str {
        DEV_SUITE_ID
    }

    fn algorithm_id(&self) -> &'static str {
        DEV_ALGORITHM_ID
    }

    fn sign(&self, secret: &SigningSecret, message: &[u8]) -> Result<Vec<u8>, CryptoError> {
        let key = SigningKey::from_bytes(&secret.bytes);
        Ok(key.sign(message).to_bytes().to_vec())
    }

    fn verify(
        &self,
        public_key: &[u8],
        message: &[u8],
        signature: &[u8],
    ) -> Result<(), CryptoError> {
        let pk_bytes: [u8; 32] =
            public_key.try_into().map_err(|_| CryptoError::InvalidDescriptor)?;
        let sig_bytes: [u8; 64] =
            signature.try_into().map_err(|_| CryptoError::InvalidDescriptor)?;
        let verifying =
            VerifyingKey::from_bytes(&pk_bytes).map_err(|_| CryptoError::InvalidDescriptor)?;
        let signature = Signature::from_bytes(&sig_bytes);
        verifying.verify(message, &signature).map_err(|_| CryptoError::InvalidSignature)
    }
}

pub fn suite_by_id(suite_id: &str) -> Result<DevEd25519Sha256Suite, CryptoError> {
    match suite_id {
        DEV_SUITE_ID | PROTOCOL_SUITE_ID => Ok(DevEd25519Sha256Suite),
        // Standardized PQ/hybrid suites are registered in the TypeScript
        // CryptoSuite catalog. The Rust node fail-closes rather than
        // silently mapping them to Ed25519.
        HYBRID_ED25519_MLDSA_SUITE_ID | ML_DSA_65_SUITE_ID => Err(CryptoError::UnknownSuite),
        _ => Err(CryptoError::UnknownSuite),
    }
}

pub fn algorithm_id_for_suite(suite_id: &str) -> Result<&'static str, CryptoError> {
    match suite_id {
        DEV_SUITE_ID => Ok(DEV_ALGORITHM_ID),
        PROTOCOL_SUITE_ID => Ok(PROTOCOL_ALGORITHM_ID),
        _ => Err(CryptoError::UnknownSuite),
    }
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
        assert_eq!(
            suite_by_id(HYBRID_ED25519_MLDSA_SUITE_ID).unwrap_err(),
            CryptoError::UnknownSuite
        );
        assert_eq!(suite_by_id(ML_DSA_65_SUITE_ID).unwrap_err(), CryptoError::UnknownSuite);
        const _: () = assert!(MAX_REMOTE_SIGNER_SIGNATURE_BYTES >= 3309);
        assert_eq!(MAX_P2P_PQ_MESSAGE_BYTES, 1_048_576);
    }
}
