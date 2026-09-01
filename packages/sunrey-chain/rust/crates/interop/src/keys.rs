//! Interop / bridge key separation from validator, treasury, and custody keys.

use serde::{Deserialize, Serialize};

use crate::error::InteropError;

pub const INTEROP_SIGNING_PURPOSE: &str = "INTEROPERABILITY_SIGNING";
pub const WATCHER_ATTESTATION_PURPOSE: &str = "WATCHER_ATTESTATION";
pub const RELAYER_SUBMISSION_PURPOSE: &str = "RELAYER_SUBMISSION";

pub const FORBIDDEN_INTEROP_KEY_PURPOSES: &[&str] = &[
    "VALIDATOR_CONSENSUS_SIGNING",
    "BLOCK_PROPOSAL_SIGNING",
    "GOVERNANCE_SIGNING",
    "GENESIS_SIGNING",
    "WALLET_SIGNING",
    "EXECUTION_AUTHORITY_SIGNING",
    "TREASURY_MASTER",
    "CUSTODY_SIGNING",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteropKeyBinding {
    pub key_id: String,
    pub purpose: String,
    pub service_role: String,
    pub may_sign_consensus: bool,
    pub may_sign_governance: bool,
    pub may_sign_treasury: bool,
}

impl InteropKeyBinding {
    pub fn interop_signer(key_id: impl Into<String>) -> Self {
        Self {
            key_id: key_id.into(),
            purpose: INTEROP_SIGNING_PURPOSE.into(),
            service_role: "INTEROP_BOUNDARY".into(),
            may_sign_consensus: false,
            may_sign_governance: false,
            may_sign_treasury: false,
        }
    }

    pub fn watcher_attestation(key_id: impl Into<String>) -> Self {
        Self {
            key_id: key_id.into(),
            purpose: WATCHER_ATTESTATION_PURPOSE.into(),
            service_role: "WATCHER".into(),
            may_sign_consensus: false,
            may_sign_governance: false,
            may_sign_treasury: false,
        }
    }

    pub fn relayer_submission(key_id: impl Into<String>) -> Self {
        Self {
            key_id: key_id.into(),
            purpose: RELAYER_SUBMISSION_PURPOSE.into(),
            service_role: "RELAYER".into(),
            may_sign_consensus: false,
            may_sign_governance: false,
            may_sign_treasury: false,
        }
    }

    pub fn validate(&self) -> Result<(), InteropError> {
        if FORBIDDEN_INTEROP_KEY_PURPOSES.contains(&self.purpose.as_str()) {
            return Err(InteropError::KeyPurposeForbidden);
        }
        if self.may_sign_consensus || self.may_sign_governance || self.may_sign_treasury {
            return Err(InteropError::KeyPurposeForbidden);
        }
        Ok(())
    }
}

pub fn refuse_shared_validator_key(purpose: &str) -> Result<(), InteropError> {
    if purpose == "VALIDATOR_CONSENSUS_SIGNING" || purpose == "BLOCK_PROPOSAL_SIGNING" {
        return Err(InteropError::KeyPurposeForbidden);
    }
    Ok(())
}

pub fn refuse_treasury_key_reuse(purpose: &str) -> Result<(), InteropError> {
    if purpose.contains("TREASURY") || purpose == "WALLET_SIGNING" {
        return Err(InteropError::KeyPurposeForbidden);
    }
    Ok(())
}

pub fn assert_key_separation(bindings: &[InteropKeyBinding]) -> Result<(), InteropError> {
    for binding in bindings {
        binding.validate()?;
        refuse_shared_validator_key(&binding.purpose)?;
        refuse_treasury_key_reuse(&binding.purpose)?;
    }
    let purposes: Vec<&str> = bindings.iter().map(|b| b.purpose.as_str()).collect();
    if purposes.contains(&"VALIDATOR_CONSENSUS_SIGNING")
        && purposes.contains(&INTEROP_SIGNING_PURPOSE)
    {
        return Err(InteropError::KeyPurposeForbidden);
    }
    Ok(())
}
