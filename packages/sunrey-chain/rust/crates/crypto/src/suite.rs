//! CryptoSuite trait and classical development implementation.

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};
use sunrey_protocol::{DomainHasher, Hash32};

use crate::algorithm_ids::AlgorithmWireId;
use crate::{
    CryptoError, DEV_ALGORITHM_ID, DEV_SUITE_ID, PROTOCOL_ALGORITHM_ID, PROTOCOL_SUITE_ID,
};

pub trait CryptoSuite: DomainHasher + Send + Sync {
    fn suite_id(&self) -> &'static str;
    fn algorithm_id(&self) -> &'static str;
    fn algorithm_wire_id(&self) -> AlgorithmWireId;
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

    pub fn public_key_bytes(&self) -> [u8; 32] {
        SigningKey::from_bytes(&self.bytes).verifying_key().to_bytes()
    }
}

const DEV_KEY_LABEL: &[u8] = b"SUNREY_LOCAL_DEV_FIXTURE_KEY_NOT_FOR_PRODUCTION_v1";

/// Development-only fixture key. Not production key infrastructure.
pub fn development_fixture_secret() -> SigningSecret {
    let digest = Sha256::digest(DEV_KEY_LABEL);
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(&digest);
    SigningSecret { bytes }
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct DevEd25519Sha256Suite;

impl DomainHasher for DevEd25519Sha256Suite {
    fn hash(&self, domain: &str, payload: &[u8]) -> Hash32 {
        let framed = sunrey_protocol::domain_payload(domain, payload);
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

    fn algorithm_wire_id(&self) -> AlgorithmWireId {
        AlgorithmWireId::Ed25519Dev
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
        verify_ed25519(public_key, message, signature)
    }
}

/// Protocol-facing Ed25519 suite (`sunrey-ed25519-v1`).
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct ProtocolEd25519Sha256Suite;

impl DomainHasher for ProtocolEd25519Sha256Suite {
    fn hash(&self, domain: &str, payload: &[u8]) -> Hash32 {
        let framed = sunrey_protocol::domain_payload(domain, payload);
        Sha256::digest(&framed).into()
    }
}

impl CryptoSuite for ProtocolEd25519Sha256Suite {
    fn suite_id(&self) -> &'static str {
        PROTOCOL_SUITE_ID
    }

    fn algorithm_id(&self) -> &'static str {
        PROTOCOL_ALGORITHM_ID
    }

    fn algorithm_wire_id(&self) -> AlgorithmWireId {
        AlgorithmWireId::Ed25519
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
        verify_ed25519(public_key, message, signature)
    }
}

pub fn verify_ed25519(
    public_key: &[u8],
    message: &[u8],
    signature: &[u8],
) -> Result<(), CryptoError> {
    let pk_bytes: [u8; 32] = public_key.try_into().map_err(|_| CryptoError::InvalidDescriptor)?;
    let sig_bytes: [u8; 64] = signature.try_into().map_err(|_| CryptoError::InvalidDescriptor)?;
    let verifying =
        VerifyingKey::from_bytes(&pk_bytes).map_err(|_| CryptoError::InvalidDescriptor)?;
    let signature = Signature::from_bytes(&sig_bytes);
    verifying.verify(message, &signature).map_err(|_| CryptoError::InvalidSignature)
}
