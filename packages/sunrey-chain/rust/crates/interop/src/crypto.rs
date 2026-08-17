use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sunrey_crypto::{CryptoSuite, DevEd25519Sha256Suite, SigningSecret};
use sunrey_protocol::encode_string;

use crate::encoding::domain_hash;
use crate::error::InteropError;
use crate::types::CryptoClassification;

pub const EXTERNAL_ALG_ED25519: &str = "ED25519";
pub const EXTERNAL_SUITE_SIMULATED: &str = "EXTERNAL_DEV_ED25519_V1";
pub const SUNREY_CONTROL_SUITE: &str = sunrey_crypto::DEV_SUITE_ID;

/// Foreign-chain verifier. Do not assume SunRey CryptoSuite.
pub trait ExternalCryptoVerifier: Send + Sync {
    fn algorithm_id(&self) -> &'static str;
    fn suite_id(&self) -> &'static str;
    fn classification(&self) -> CryptoClassification;
    fn verify(
        &self,
        public_key: &[u8],
        message: &[u8],
        signature: &[u8],
    ) -> Result<(), InteropError>;
}

#[derive(Debug, Default, Clone)]
pub struct SimulatedEd25519Verifier;

impl ExternalCryptoVerifier for SimulatedEd25519Verifier {
    fn algorithm_id(&self) -> &'static str {
        EXTERNAL_ALG_ED25519
    }

    fn suite_id(&self) -> &'static str {
        EXTERNAL_SUITE_SIMULATED
    }

    fn classification(&self) -> CryptoClassification {
        CryptoClassification::Classical
    }

    fn verify(
        &self,
        public_key: &[u8],
        message: &[u8],
        signature: &[u8],
    ) -> Result<(), InteropError> {
        let pk: [u8; 32] = public_key.try_into().map_err(|_| InteropError::InvalidFinalityProof)?;
        let sig: [u8; 64] = signature.try_into().map_err(|_| InteropError::InvalidFinalityProof)?;
        let verifying =
            VerifyingKey::from_bytes(&pk).map_err(|_| InteropError::InvalidFinalityProof)?;
        verifying
            .verify(message, &Signature::from_bytes(&sig))
            .map_err(|_| InteropError::InvalidFinalityProof)
    }
}

#[derive(Debug, Clone)]
pub struct ExternalSigningKey {
    bytes: [u8; 32],
}

impl ExternalSigningKey {
    pub fn from_label(label: &str) -> Self {
        let digest = Sha256::digest(format!("EXTERNAL_DEV_KEY:{label}").as_bytes());
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&digest);
        Self { bytes }
    }

    pub fn public_key(&self) -> Vec<u8> {
        SigningKey::from_bytes(&self.bytes).verifying_key().to_bytes().to_vec()
    }

    pub fn sign(&self, message: &[u8]) -> Vec<u8> {
        SigningKey::from_bytes(&self.bytes).sign(message).to_bytes().to_vec()
    }
}

/// SunRey-side control messages still use the canonical CryptoSuite.
pub fn sign_sunrey_control(
    secret: &SigningSecret,
    message: &[u8],
) -> Result<Vec<u8>, InteropError> {
    DevEd25519Sha256Suite.sign(secret, message).map_err(|_| InteropError::SchemaInvalid)
}

pub fn verify_sunrey_control(
    public_key: &[u8],
    message: &[u8],
    signature: &[u8],
) -> Result<(), InteropError> {
    DevEd25519Sha256Suite
        .verify(public_key, message, signature)
        .map_err(|_| InteropError::InvalidFinalityProof)
}

pub fn sunrey_classification() -> CryptoClassification {
    CryptoClassification::HybridCapable
}

pub fn weakest_domain(
    sunrey: CryptoClassification,
    foreign: CryptoClassification,
) -> CryptoClassification {
    match (sunrey, foreign) {
        (CryptoClassification::Classical, _) | (_, CryptoClassification::Classical) => {
            CryptoClassification::Classical
        }
        (CryptoClassification::HybridCapable, _) | (_, CryptoClassification::HybridCapable) => {
            CryptoClassification::HybridCapable
        }
        _ => CryptoClassification::PqCapable,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlgorithmId {
    pub suite_id: String,
    pub algorithm_id: String,
    pub classification: CryptoClassification,
}

impl AlgorithmId {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, &self.suite_id);
        encode_string(&mut out, &self.algorithm_id);
        encode_string(&mut out, self.classification.as_str());
        out
    }

    pub fn digest(&self) -> [u8; 32] {
        domain_hash(crate::DOMAIN_CRYPTO, &self.encode())
    }
}
