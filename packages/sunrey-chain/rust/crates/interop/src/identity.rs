use serde::{Deserialize, Serialize};

use crate::error::InteropError;

/// Future-ready external credential port. Never auto-trusted.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalIdentityAttestation {
    pub issuer: String,
    pub proof: Vec<u8>,
    pub external_chain: String,
    pub verification_policy: String,
    pub sunrey_attestation_policy: String,
    pub status: String,
}

impl ExternalIdentityAttestation {
    pub fn draft(
        issuer: impl Into<String>,
        proof: Vec<u8>,
        external_chain: impl Into<String>,
    ) -> Self {
        Self {
            issuer: issuer.into(),
            proof,
            external_chain: external_chain.into(),
            verification_policy: "LIGHT_CLIENT_MEMBERSHIP".to_string(),
            sunrey_attestation_policy: "UNTRUSTED_UNTIL_POLICY".to_string(),
            status: "UNTRUSTED_UNTIL_POLICY".to_string(),
        }
    }

    pub fn refuse_automatic_trust(&self) -> Result<(), InteropError> {
        Err(InteropError::IdentityNotAutomaticallyTrusted)
    }
}
