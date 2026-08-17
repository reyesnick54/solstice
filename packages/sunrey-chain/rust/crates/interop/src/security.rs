use serde::{Deserialize, Serialize};

use crate::client::InterchainClientState;
use crate::crypto::{sunrey_classification, weakest_domain};
use crate::types::{ClientStatus, CryptoClassification, RiskClassification};

/// Derived profile. Not a claim of absolute security.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteropSecurityProfile {
    pub foreign_finality_model: String,
    pub verified_client_type: String,
    pub proof_system: String,
    pub sunrey_crypto_classification: String,
    pub foreign_crypto_classification: String,
    pub weakest_trust_domain: String,
    pub interop_cannot_exceed_weakest_domain: bool,
    pub validator_trust_assumptions: String,
    pub client_age_seconds: u64,
    pub status: String,
    pub risk_classification: String,
    pub absolute_security_claim: bool,
    pub trusted_multisig_bridge: bool,
    pub production_ready: bool,
}

impl InteropSecurityProfile {
    pub fn derive(
        client: &InterchainClientState,
        proof_system: &str,
        foreign_crypto: CryptoClassification,
        now_unix: u64,
    ) -> Self {
        let sunrey = sunrey_classification();
        let weakest = weakest_domain(sunrey, foreign_crypto);
        let risk = match client.status {
            ClientStatus::Frozen => RiskClassification::FrozenUntrusted,
            ClientStatus::Expired => RiskClassification::ExpiredUntrusted,
            _ => RiskClassification::ForeignClassicalWeakestDomain,
        };
        Self {
            foreign_finality_model: client.finality_model.as_str().to_string(),
            verified_client_type: client.client_type.as_str().to_string(),
            proof_system: proof_system.to_string(),
            sunrey_crypto_classification: sunrey.as_str().to_string(),
            foreign_crypto_classification: foreign_crypto.as_str().to_string(),
            weakest_trust_domain: weakest.as_str().to_string(),
            interop_cannot_exceed_weakest_domain: true,
            validator_trust_assumptions: format!(
                "foreign quorum {} of {} independently verified; relayer untrusted",
                client.quorum,
                client.validator_keys.len()
            ),
            client_age_seconds: client.age_seconds(now_unix),
            status: client.status.as_str().to_string(),
            risk_classification: risk.as_str().to_string(),
            absolute_security_claim: false,
            trusted_multisig_bridge: false,
            production_ready: false,
        }
    }
}
