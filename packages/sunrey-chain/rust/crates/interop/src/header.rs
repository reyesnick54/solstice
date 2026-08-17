use serde::{Deserialize, Serialize};
use sunrey_protocol::{encode_bytes, encode_string, encode_u64, Hash32};

use crate::crypto::{ExternalCryptoVerifier, ExternalSigningKey};
use crate::encoding::{domain_hash, hex_hash};
use crate::error::InteropError;
use crate::DOMAIN_HEADER;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForeignHeader {
    pub chain_id: String,
    pub height: u64,
    pub parent_hash: Hash32,
    pub state_root: Hash32,
    pub validator_commitment: Hash32,
    pub timestamp_unix: u64,
    pub client_version: u32,
}

impl ForeignHeader {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, &self.chain_id);
        encode_u64(&mut out, self.height);
        encode_bytes(&mut out, &self.parent_hash);
        encode_bytes(&mut out, &self.state_root);
        encode_bytes(&mut out, &self.validator_commitment);
        encode_u64(&mut out, self.timestamp_unix);
        encode_u64(&mut out, u64::from(self.client_version));
        out
    }

    pub fn hash(&self) -> Hash32 {
        domain_hash(DOMAIN_HEADER, &self.encode())
    }

    pub fn hash_hex(&self) -> String {
        hex_hash(&self.hash())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinalityProof {
    pub header_hash: Hash32,
    pub signatures: Vec<ValidatorSignature>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorSignature {
    pub validator_id: String,
    pub public_key: Vec<u8>,
    pub signature: Vec<u8>,
}

impl FinalityProof {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_bytes(&mut out, &self.header_hash);
        encode_u64(&mut out, self.signatures.len() as u64);
        for sig in &self.signatures {
            encode_string(&mut out, &sig.validator_id);
            encode_bytes(&mut out, &sig.public_key);
            encode_bytes(&mut out, &sig.signature);
        }
        out
    }

    pub fn sign_header(header: &ForeignHeader, keys: &[(String, ExternalSigningKey)]) -> Self {
        let header_hash = header.hash();
        let signatures = keys
            .iter()
            .map(|(id, key)| ValidatorSignature {
                validator_id: id.clone(),
                public_key: key.public_key(),
                signature: key.sign(&header_hash),
            })
            .collect();
        Self { header_hash, signatures }
    }

    pub fn verify(
        &self,
        header: &ForeignHeader,
        expected_keys: &[(String, Vec<u8>)],
        verifier: &dyn ExternalCryptoVerifier,
        quorum: usize,
    ) -> Result<(), InteropError> {
        if self.header_hash != header.hash() {
            return Err(InteropError::InvalidFinalityProof);
        }
        let mut counted = 0usize;
        let mut seen = std::collections::BTreeSet::new();
        for sig in &self.signatures {
            if !seen.insert(&sig.validator_id) {
                continue;
            }
            let expected = expected_keys.iter().find(|(id, _)| id == &sig.validator_id);
            let Some((_, pk)) = expected else {
                continue;
            };
            if pk != &sig.public_key {
                return Err(InteropError::InvalidFinalityProof);
            }
            verifier.verify(&sig.public_key, &self.header_hash, &sig.signature)?;
            counted += 1;
        }
        if counted < quorum {
            return Err(InteropError::InvalidFinalityProof);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedForeignHeader {
    pub header: ForeignHeader,
    pub height: u64,
    pub state_root: Hash32,
    pub validator_commitment: Hash32,
    pub finality_proof: FinalityProof,
    pub verified_at_unix: u64,
    pub verified_at_sunrey_height: u64,
    pub client_version: u32,
}

impl VerifiedForeignHeader {
    pub fn from_verified(
        header: ForeignHeader,
        proof: FinalityProof,
        verified_at_unix: u64,
        verified_at_sunrey_height: u64,
    ) -> Self {
        Self {
            height: header.height,
            state_root: header.state_root,
            validator_commitment: header.validator_commitment,
            client_version: header.client_version,
            header,
            finality_proof: proof,
            verified_at_unix,
            verified_at_sunrey_height,
        }
    }
}
