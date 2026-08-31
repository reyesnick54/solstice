//! Isolated watcher. Observes external chains only.
//!
//! Watchers hold no validator, governance, treasury, or relayer submission keys.
//! A single watcher is not decentralized verification.

use serde::{Deserialize, Serialize};

use crate::envelope::InteropMessageEnvelope;
use crate::error::InteropError;
use crate::external_rpc::{ExternalRpcObservation, RpcFailureKind};
use crate::header::{FinalityProof, ForeignHeader};
use crate::types::ActorKind;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsolatedWatcher {
    pub watcher_id: String,
    pub kind: ActorKind,
    pub source_chain_id: String,
}

impl IsolatedWatcher {
    pub fn new(watcher_id: impl Into<String>, source_chain_id: impl Into<String>) -> Self {
        Self {
            watcher_id: watcher_id.into(),
            kind: ActorKind::Watcher,
            source_chain_id: source_chain_id.into(),
        }
    }

    pub fn cannot_submit(&self) -> Result<(), InteropError> {
        Err(InteropError::WatcherForbidden)
    }

    pub fn cannot_govern(&self) -> Result<(), InteropError> {
        Err(InteropError::WatcherForbidden)
    }

    pub fn cannot_sign_consensus(&self) -> Result<(), InteropError> {
        Err(InteropError::WatcherForbidden)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatcherObservation {
    pub watcher_id: String,
    pub source_chain_id: String,
    pub header: Option<ForeignHeader>,
    pub proof: Option<FinalityProof>,
    pub envelope: Option<InteropMessageEnvelope>,
    pub rpc_observation: Option<ExternalRpcObservation>,
    pub observed_at_unix: u64,
    pub observation_digest: String,
}

pub trait WatcherPort {
    fn watcher_id(&self) -> &str;
    fn observe_header(&self, header: &ForeignHeader, proof: &FinalityProof) -> WatcherObservation;
    fn observe_envelope(&self, envelope: &InteropMessageEnvelope) -> WatcherObservation;
}

impl WatcherPort for IsolatedWatcher {
    fn watcher_id(&self) -> &str {
        &self.watcher_id
    }

    fn observe_header(&self, header: &ForeignHeader, proof: &FinalityProof) -> WatcherObservation {
        WatcherObservation {
            watcher_id: self.watcher_id.clone(),
            source_chain_id: self.source_chain_id.clone(),
            header: Some(header.clone()),
            proof: Some(proof.clone()),
            envelope: None,
            rpc_observation: None,
            observed_at_unix: 0,
            observation_digest: crate::encoding::hex_hash(&header.hash()),
        }
    }

    fn observe_envelope(&self, envelope: &InteropMessageEnvelope) -> WatcherObservation {
        WatcherObservation {
            watcher_id: self.watcher_id.clone(),
            source_chain_id: envelope.source_chain_id.clone(),
            header: None,
            proof: None,
            envelope: Some(envelope.clone()),
            rpc_observation: None,
            observed_at_unix: 0,
            observation_digest: crate::encoding::hex_hash(&envelope.digest()),
        }
    }
}

/// Security model truth: single-watcher observations are untrusted until verified.
pub fn watcher_security_model(watcher_count: usize) -> &'static str {
    if watcher_count <= 1 {
        "SINGLE_WATCHER_UNTRUSTED_UNTIL_VERIFIED"
    } else {
        "MULTI_WATCHER_QUORUM_REQUIRED_FOR_PRODUCTION"
    }
}

pub fn classify_rpc_failure(kind: RpcFailureKind) -> InteropError {
    match kind {
        RpcFailureKind::Timeout => InteropError::ExternalRpcTimeout,
        RpcFailureKind::StaleBlock => InteropError::ExternalRpcStale,
        RpcFailureKind::Reorg => InteropError::ExternalRpcReorg,
        RpcFailureKind::Conflict => InteropError::ExternalRpcConflict,
        RpcFailureKind::Malformed => InteropError::ExternalRpcMalformed,
        RpcFailureKind::RateLimited => InteropError::ExternalRpcRateLimited,
    }
}
