//! Development CryptoSuite for node-local keys.
//!
//! Uses established libraries only (ed25519-dalek, SHA-256). This is not
//! the application KeyProvider and is not Execution Authority HMAC.
//! P2P identity keys are a distinct domain from wallet, validator,
//! governance, and Kernel keys (ADR-0018, ADR-0024).

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use sha2::{Digest, Sha256};

use crate::error::{NodeError, NodeResult};

pub const CRYPTO_SUITE_ID: &str = "sunrey-dev-ed25519-sha256-v1";
pub const HASH_ALG_ID: &str = "SHA-256";
pub const SIG_ALG_ID: &str = "Ed25519";
pub const PROTOCOL_VERSION: u16 = 1;
pub const CODEC_VERSION: u16 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyDomain {
    P2pNode,
    TxWallet,
    ValidatorConsensus,
    Governance,
}

impl KeyDomain {
    pub fn domain_tag(self) -> &'static [u8] {
        match self {
            Self::P2pNode => b"SUNREY-KEY-P2P-NODE-V1",
            Self::TxWallet => b"SUNREY-KEY-TX-WALLET-V1",
            Self::ValidatorConsensus => b"SUNREY-KEY-VALIDATOR-CONSENSUS-V1",
            Self::Governance => b"SUNREY-KEY-GOVERNANCE-V1",
        }
    }
}

#[derive(Clone)]
pub struct DomainKey {
    pub domain: KeyDomain,
    signing: SigningKey,
}

impl DomainKey {
    pub fn generate(domain: KeyDomain) -> Self {
        Self {
            domain,
            signing: SigningKey::generate(&mut OsRng),
        }
    }

    pub fn from_seed(domain: KeyDomain, seed: [u8; 32]) -> Self {
        Self {
            domain,
            signing: SigningKey::from_bytes(&seed),
        }
    }

    pub fn seed_bytes(&self) -> [u8; 32] {
        self.signing.to_bytes()
    }

    pub fn public_key(&self) -> [u8; 32] {
        self.signing.verifying_key().to_bytes()
    }

    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        let tagged = domain_separate(self.domain, message);
        self.signing.sign(&tagged).to_bytes()
    }
}

pub fn domain_separate(domain: KeyDomain, message: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(domain.domain_tag().len() + 1 + message.len());
    out.extend_from_slice(domain.domain_tag());
    out.push(0x00);
    out.extend_from_slice(message);
    out
}

pub fn sha256(data: &[u8]) -> [u8; 32] {
    Sha256::digest(data).into()
}

pub fn verify(
    domain: KeyDomain,
    public_key: &[u8; 32],
    message: &[u8],
    signature: &[u8; 64],
) -> NodeResult<()> {
    let verifying = VerifyingKey::from_bytes(public_key)
        .map_err(|_| NodeError::Identity("invalid ed25519 public key".into()))?;
    let sig = Signature::from_bytes(signature);
    let tagged = domain_separate(domain, message);
    verifying
        .verify(&tagged, &sig)
        .map_err(|_| NodeError::Validation("signature verification failed".into()))
}

pub fn refuse_execution_authority() -> NodeError {
    NodeError::Forbidden(
        "node CryptoSuite cannot issue Execution Authority or reuse Kernel HMAC keys".into(),
    )
}

pub fn refuse_validator_vote() -> NodeError {
    NodeError::Forbidden("P2P identity cannot sign validator consensus votes".into())
}

pub fn refuse_governance() -> NodeError {
    NodeError::Forbidden("P2P identity cannot modify governance or CryptoSuite policy".into())
}
