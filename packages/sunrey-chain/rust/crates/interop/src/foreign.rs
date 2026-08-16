use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sunrey_protocol::Hash32;

use crate::crypto::ExternalSigningKey;
use crate::encoding::{
    build_membership_proof, build_non_membership_proof, merkle_root, MembershipProof,
};
use crate::error::InteropError;
use crate::header::{FinalityProof, ForeignHeader};
use crate::registry::{EXTERNAL_DEV_CHAIN_ID, EXTERNAL_DEV_NETWORK_ID};

pub const EXTERNAL_VALIDATORS: [&str; 4] = ["ext_a", "ext_b", "ext_c", "ext_d"];
pub const EXTERNAL_QUORUM: usize = 3;
pub const EXTERNAL_CLIENT_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalDevChain {
    pub chain_id: String,
    pub network_id: String,
    pub genesis_hash: Hash32,
    pub height: u64,
    pub state: BTreeMap<String, Vec<u8>>,
    pub headers: BTreeMap<u64, ForeignHeader>,
    pub proofs: BTreeMap<u64, FinalityProof>,
    pub timestamp_unix: u64,
}

impl ExternalDevChain {
    pub fn genesis() -> Self {
        let keys = validator_keys();
        let validator_commitment = validator_set_commitment(&keys);
        let state: BTreeMap<String, Vec<u8>> = BTreeMap::new();
        let state_root =
            merkle_root(&state.iter().map(|(k, v)| (k.clone(), v.clone())).collect::<Vec<_>>());
        let header = ForeignHeader {
            chain_id: EXTERNAL_DEV_CHAIN_ID.to_string(),
            height: 0,
            parent_hash: [0u8; 32],
            state_root,
            validator_commitment,
            timestamp_unix: 1_700_000_000,
            client_version: EXTERNAL_CLIENT_VERSION,
        };
        let genesis_hash = header.hash();
        let proof = FinalityProof::sign_header(&header, &keys);
        let mut headers = BTreeMap::new();
        headers.insert(0, header.clone());
        let mut proofs = BTreeMap::new();
        proofs.insert(0, proof);
        Self {
            chain_id: EXTERNAL_DEV_CHAIN_ID.to_string(),
            network_id: EXTERNAL_DEV_NETWORK_ID.to_string(),
            genesis_hash,
            height: 0,
            state,
            headers,
            proofs,
            timestamp_unix: 1_700_000_000,
        }
    }

    pub fn validator_keys() -> Vec<(String, ExternalSigningKey)> {
        validator_keys()
    }

    pub fn validator_public_keys(&self) -> Vec<(String, Vec<u8>)> {
        validator_keys().into_iter().map(|(id, key)| (id, key.public_key())).collect()
    }

    pub fn entries(&self) -> Vec<(String, Vec<u8>)> {
        self.state.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    }

    pub fn state_root(&self) -> Hash32 {
        merkle_root(&self.entries())
    }

    pub fn put(&mut self, key: impl Into<String>, value: Vec<u8>) {
        self.state.insert(key.into(), value);
    }

    pub fn finalize_next(&mut self) -> Result<(ForeignHeader, FinalityProof), InteropError> {
        let parent = self.headers.get(&self.height).ok_or(InteropError::InvalidHeader)?;
        let keys = validator_keys();
        self.timestamp_unix += 1;
        let header = ForeignHeader {
            chain_id: self.chain_id.clone(),
            height: self.height + 1,
            parent_hash: parent.hash(),
            state_root: self.state_root(),
            validator_commitment: validator_set_commitment(&keys),
            timestamp_unix: self.timestamp_unix,
            client_version: EXTERNAL_CLIENT_VERSION,
        };
        let proof = FinalityProof::sign_header(&header, &keys);
        self.height += 1;
        self.headers.insert(self.height, header.clone());
        self.proofs.insert(self.height, proof.clone());
        Ok((header, proof))
    }

    pub fn membership(&self, key: &str) -> Result<MembershipProof, InteropError> {
        build_membership_proof(&self.entries(), key)
    }

    pub fn non_membership(
        &self,
        key: &str,
    ) -> Result<(Option<MembershipProof>, Option<MembershipProof>), InteropError> {
        build_non_membership_proof(&self.entries(), key)
    }

    pub fn latest_header(&self) -> Result<&ForeignHeader, InteropError> {
        self.headers.get(&self.height).ok_or(InteropError::InvalidHeader)
    }

    pub fn latest_proof(&self) -> Result<&FinalityProof, InteropError> {
        self.proofs.get(&self.height).ok_or(InteropError::InvalidFinalityProof)
    }
}

pub fn validator_keys() -> Vec<(String, ExternalSigningKey)> {
    EXTERNAL_VALIDATORS
        .iter()
        .map(|id| (id.to_string(), ExternalSigningKey::from_label(id)))
        .collect()
}

pub fn validator_set_commitment(keys: &[(String, ExternalSigningKey)]) -> Hash32 {
    let entries: Vec<(String, Vec<u8>)> =
        keys.iter().map(|(id, key)| (id.clone(), key.public_key())).collect();
    merkle_root(&entries)
}
