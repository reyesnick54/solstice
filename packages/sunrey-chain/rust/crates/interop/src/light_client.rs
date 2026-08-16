use crate::crypto::ExternalCryptoVerifier;
use crate::encoding::{verify_membership_proof, MembershipProof};
use crate::error::InteropError;
use crate::header::{FinalityProof, ForeignHeader, VerifiedForeignHeader};
use crate::types::{ClientType, FinalityModel};

/// Light-client operations. Relayers are untrusted; the node verifies.
pub trait LightClient {
    fn initialize_client(
        &mut self,
        genesis: &ForeignHeader,
        proof: &FinalityProof,
        verifier: &dyn ExternalCryptoVerifier,
    ) -> Result<(), InteropError>;

    fn verify_header(
        &self,
        header: &ForeignHeader,
        proof: &FinalityProof,
        verifier: &dyn ExternalCryptoVerifier,
    ) -> Result<(), InteropError>;

    fn verify_update(
        &mut self,
        header: ForeignHeader,
        proof: FinalityProof,
        verifier: &dyn ExternalCryptoVerifier,
        now_unix: u64,
        sunrey_height: u64,
    ) -> Result<VerifiedForeignHeader, InteropError>;

    fn verify_membership(
        &self,
        height: u64,
        proof: &MembershipProof,
    ) -> Result<Vec<u8>, InteropError>;

    fn verify_non_membership(
        &self,
        height: u64,
        key: &str,
        left: Option<&MembershipProof>,
        right: Option<&MembershipProof>,
    ) -> Result<(), InteropError>;

    fn latest_verified_height(&self) -> u64;

    fn verify_finality(
        &self,
        header: &ForeignHeader,
        proof: &FinalityProof,
        verifier: &dyn ExternalCryptoVerifier,
    ) -> Result<(), InteropError>;

    fn detect_misbehavior(
        &self,
        a: &ForeignHeader,
        a_proof: &FinalityProof,
        b: &ForeignHeader,
        b_proof: &FinalityProof,
        verifier: &dyn ExternalCryptoVerifier,
    ) -> Result<(), InteropError>;
}

pub fn adapter_for(model: FinalityModel, client: ClientType) -> Result<(), InteropError> {
    match (model, client) {
        (
            FinalityModel::SimulatedDeterministicBftExternalChain,
            ClientType::SimulatedDeterministicBft,
        ) => Ok(()),
        (FinalityModel::DeterministicBft, ClientType::DeterministicBft)
        | (FinalityModel::ProbabilisticLongestChain, ClientType::ProbabilisticLongestChain)
        | (FinalityModel::ExternalCheckpointFinality, ClientType::ExternalCheckpoint) => {
            Err(InteropError::VerificationNotImplemented)
        }
        _ => Err(InteropError::ProofSystemMismatch),
    }
}

pub fn verify_membership_against_root(
    root: &[u8; 32],
    proof: &MembershipProof,
) -> Result<Vec<u8>, InteropError> {
    verify_membership_proof(root, proof)?;
    Ok(proof.value.clone())
}

pub fn verify_non_membership_against_root(
    root: &[u8; 32],
    key: &str,
    left: Option<&MembershipProof>,
    right: Option<&MembershipProof>,
) -> Result<(), InteropError> {
    if let Some(left) = left {
        verify_membership_proof(root, left)?;
        if left.key.as_str() >= key {
            return Err(InteropError::InvalidNonMembershipProof);
        }
    }
    if let Some(right) = right {
        verify_membership_proof(root, right)?;
        if right.key.as_str() <= key {
            return Err(InteropError::InvalidNonMembershipProof);
        }
    }
    if left.is_none() && right.is_none() {
        return Err(InteropError::InvalidNonMembershipProof);
    }
    Ok(())
}
