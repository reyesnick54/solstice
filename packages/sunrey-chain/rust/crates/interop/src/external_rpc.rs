//! External RPC failure model. First response is never irreversible truth.

use serde::{Deserialize, Serialize};

use crate::error::InteropError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RpcFailureKind {
    Timeout,
    StaleBlock,
    Reorg,
    Conflict,
    Malformed,
    RateLimited,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalRpcObservation {
    pub endpoint_id: String,
    pub chain_id: String,
    pub block_height: u64,
    pub block_hash: String,
    pub tx_hash: Option<String>,
    pub event_index: Option<u64>,
    pub finality_confirmations: u64,
    pub required_confirmations: u64,
    pub observed_at_unix: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinalityRequirement {
    pub chain_id: String,
    pub model: String,
    pub required_confirmations: u64,
    pub max_staleness_seconds: u64,
}

impl FinalityRequirement {
    pub fn development(chain_id: &str) -> Self {
        Self {
            chain_id: chain_id.to_string(),
            model: "SIMULATED_DETERMINISTIC_BFT".into(),
            required_confirmations: 1,
            max_staleness_seconds: 300,
        }
    }

    pub fn satisfies(
        &self,
        observation: &ExternalRpcObservation,
        now_unix: u64,
    ) -> Result<(), InteropError> {
        if observation.chain_id != self.chain_id {
            return Err(InteropError::WrongExternalChainId);
        }
        if observation.finality_confirmations < self.required_confirmations {
            return Err(InteropError::ExternalRpcStale);
        }
        if now_unix.saturating_sub(observation.observed_at_unix) > self.max_staleness_seconds {
            return Err(InteropError::ExternalRpcStale);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Default)]
pub struct ExternalRpcEvaluator {
    pub observations: Vec<ExternalRpcObservation>,
}

impl ExternalRpcEvaluator {
    pub fn record(&mut self, observation: ExternalRpcObservation) {
        self.observations.push(observation);
    }

    pub fn reconcile(
        &self,
        requirement: &FinalityRequirement,
        now_unix: u64,
    ) -> Result<&ExternalRpcObservation, InteropError> {
        if self.observations.is_empty() {
            return Err(InteropError::ExternalRpcTimeout);
        }
        let mut candidates: Vec<&ExternalRpcObservation> = self
            .observations
            .iter()
            .filter(|o| requirement.satisfies(o, now_unix).is_ok())
            .collect();
        if candidates.is_empty() {
            return Err(InteropError::ExternalRpcStale);
        }
        candidates.sort_by_key(|o| o.block_height);
        let tallest = candidates.last().unwrap();
        let conflicting = candidates
            .iter()
            .any(|o| o.block_height == tallest.block_height && o.block_hash != tallest.block_hash);
        if conflicting {
            return Err(InteropError::ExternalRpcConflict);
        }
        let reorg = self.observations.windows(2).any(|w| {
            w[0].block_height > w[1].block_height
                || (w[0].block_height == w[1].block_height && w[0].block_hash != w[1].block_hash)
        });
        if reorg {
            return Err(InteropError::ExternalRpcReorg);
        }
        Ok(tallest)
    }
}

pub fn reject_malformed_response(bytes: &[u8]) -> Result<(), InteropError> {
    if bytes.is_empty() || bytes.len() > 1_048_576 {
        return Err(InteropError::ExternalRpcMalformed);
    }
    if bytes.iter().filter(|&&b| b == 0).count() > bytes.len() / 2 {
        return Err(InteropError::ExternalRpcMalformed);
    }
    Ok(())
}
