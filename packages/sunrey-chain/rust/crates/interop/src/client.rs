use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sunrey_protocol::Hash32;

use crate::crypto::ExternalCryptoVerifier;
use crate::encoding::MembershipProof;
use crate::error::InteropError;
use crate::header::{FinalityProof, ForeignHeader, VerifiedForeignHeader};
use crate::ids::InterchainClientId;
use crate::light_client::{
    adapter_for, verify_membership_against_root, verify_non_membership_against_root, LightClient,
};
use crate::types::{ClientStatus, ClientType, FinalityModel};

pub const DEFAULT_TRUSTING_PERIOD: u64 = 86_400;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterchainClientState {
    pub client_id: InterchainClientId,
    pub external_chain_id: String,
    pub client_type: ClientType,
    pub finality_model: FinalityModel,
    pub status: ClientStatus,
    pub genesis_hash: Hash32,
    pub latest_height: u64,
    pub latest_state_root: Hash32,
    pub validator_keys: Vec<(String, Vec<u8>)>,
    pub quorum: usize,
    pub trusting_period_seconds: u64,
    pub last_update_unix: u64,
    pub client_version: u32,
    pub headers: BTreeMap<u64, VerifiedForeignHeader>,
    pub frozen_reason: Option<String>,
}

impl InterchainClientState {
    pub fn age_seconds(&self, now_unix: u64) -> u64 {
        now_unix.saturating_sub(self.last_update_unix)
    }

    pub fn maybe_expire(&mut self, now_unix: u64) {
        if self.status == ClientStatus::Active
            && self.age_seconds(now_unix) > self.trusting_period_seconds
        {
            self.status = ClientStatus::Expired;
        }
    }

    pub fn verified_header(&self, height: u64) -> Result<&VerifiedForeignHeader, InteropError> {
        self.headers.get(&height).ok_or(InteropError::InvalidHeader)
    }
}

impl LightClient for InterchainClientState {
    fn initialize_client(
        &mut self,
        genesis: &ForeignHeader,
        proof: &FinalityProof,
        verifier: &dyn ExternalCryptoVerifier,
    ) -> Result<(), InteropError> {
        adapter_for(self.finality_model, self.client_type)?;
        if genesis.height != 0 {
            return Err(InteropError::InvalidHeader);
        }
        if genesis.hash() != self.genesis_hash {
            return Err(InteropError::WrongGenesis);
        }
        if genesis.chain_id != self.external_chain_id {
            return Err(InteropError::WrongExternalChainId);
        }
        self.verify_finality(genesis, proof, verifier)?;
        let verified = VerifiedForeignHeader::from_verified(
            genesis.clone(),
            proof.clone(),
            genesis.timestamp_unix,
            0,
        );
        self.headers.insert(0, verified);
        self.latest_height = 0;
        self.latest_state_root = genesis.state_root;
        self.last_update_unix = genesis.timestamp_unix;
        self.status = ClientStatus::Active;
        Ok(())
    }

    fn verify_header(
        &self,
        header: &ForeignHeader,
        proof: &FinalityProof,
        verifier: &dyn ExternalCryptoVerifier,
    ) -> Result<(), InteropError> {
        self.status.can_verify()?;
        adapter_for(self.finality_model, self.client_type)?;
        if header.chain_id != self.external_chain_id {
            return Err(InteropError::WrongExternalChainId);
        }
        if header.client_version != self.client_version {
            return Err(InteropError::SilentUpgradeForbidden);
        }
        self.verify_finality(header, proof, verifier)
    }

    fn verify_update(
        &mut self,
        header: ForeignHeader,
        proof: FinalityProof,
        verifier: &dyn ExternalCryptoVerifier,
        now_unix: u64,
        sunrey_height: u64,
    ) -> Result<VerifiedForeignHeader, InteropError> {
        self.maybe_expire(now_unix);
        self.status.can_verify()?;
        if header.height == self.latest_height && self.headers.contains_key(&header.height) {
            let existing = self.headers.get(&header.height).expect("present");
            if existing.header.hash() == header.hash() {
                return Err(InteropError::DuplicateUpdate);
            }
            return Err(InteropError::MisbehaviorDetected);
        }
        if header.height > self.latest_height + 1 {
            return Err(InteropError::FutureHeightRejected);
        }
        if header.height != self.latest_height + 1 {
            return Err(InteropError::InvalidHeader);
        }
        let parent = self.headers.get(&self.latest_height).ok_or(InteropError::InvalidHeader)?;
        if header.parent_hash != parent.header.hash() {
            return Err(InteropError::InvalidHeader);
        }
        self.verify_header(&header, &proof, verifier)?;
        let verified = VerifiedForeignHeader::from_verified(header, proof, now_unix, sunrey_height);
        self.latest_height = verified.height;
        self.latest_state_root = verified.state_root;
        self.last_update_unix = now_unix;
        self.headers.insert(verified.height, verified.clone());
        Ok(verified)
    }

    fn verify_membership(
        &self,
        height: u64,
        proof: &MembershipProof,
    ) -> Result<Vec<u8>, InteropError> {
        self.status.can_verify()?;
        let header = self.verified_header(height)?;
        verify_membership_against_root(&header.state_root, proof)
    }

    fn verify_non_membership(
        &self,
        height: u64,
        key: &str,
        left: Option<&MembershipProof>,
        right: Option<&MembershipProof>,
    ) -> Result<(), InteropError> {
        self.status.can_verify()?;
        let header = self.verified_header(height)?;
        verify_non_membership_against_root(&header.state_root, key, left, right)
    }

    fn latest_verified_height(&self) -> u64 {
        self.latest_height
    }

    fn verify_finality(
        &self,
        header: &ForeignHeader,
        proof: &FinalityProof,
        verifier: &dyn ExternalCryptoVerifier,
    ) -> Result<(), InteropError> {
        proof.verify(header, &self.validator_keys, verifier, self.quorum)
    }

    fn detect_misbehavior(
        &self,
        a: &ForeignHeader,
        a_proof: &FinalityProof,
        b: &ForeignHeader,
        b_proof: &FinalityProof,
        verifier: &dyn ExternalCryptoVerifier,
    ) -> Result<(), InteropError> {
        if a.height != b.height {
            return Err(InteropError::SchemaInvalid);
        }
        if a.hash() == b.hash() {
            return Err(InteropError::SchemaInvalid);
        }
        self.verify_finality(a, a_proof, verifier)?;
        self.verify_finality(b, b_proof, verifier)?;
        Err(InteropError::MisbehaviorDetected)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientUpgrade {
    pub client_id: String,
    pub new_client_type: ClientType,
    pub new_version: u32,
    pub activation_height: u64,
    pub continuity_hash: Hash32,
    pub governance_authorized: bool,
}
