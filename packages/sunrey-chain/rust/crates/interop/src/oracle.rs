use serde::{Deserialize, Serialize};

use crate::error::InteropError;

/// A verified external-chain fact is a reference, not economic truth.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedExternalChainFact {
    pub fact_id: String,
    pub external_chain_id: String,
    pub path: String,
    pub value: Vec<u8>,
    pub verified_height: u64,
    pub proof_hash: String,
    pub classification: String,
    pub usable_as_economic_truth: bool,
}

impl VerifiedExternalChainFact {
    pub fn from_verified(
        external_chain_id: String,
        path: String,
        value: Vec<u8>,
        verified_height: u64,
        proof_hash: String,
    ) -> Self {
        Self {
            fact_id: format!("extfact/{external_chain_id}/{path}/{verified_height}"),
            external_chain_id,
            path,
            value,
            verified_height,
            proof_hash,
            classification: "EXTERNAL_CHAIN_REFERENCE".to_string(),
            usable_as_economic_truth: false,
        }
    }

    pub fn refuse_as_economic_truth(&self) -> Result<(), InteropError> {
        Err(InteropError::ForeignValueNotEconomicTruth)
    }

    pub fn refuse_fiat_mutation(&self) -> Result<(), InteropError> {
        Err(InteropError::FiatLedgerMutationForbidden)
    }
}
