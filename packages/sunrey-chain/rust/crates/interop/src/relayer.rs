use serde::{Deserialize, Serialize};

use crate::error::InteropError;
use crate::header::{FinalityProof, ForeignHeader};
use crate::packet::InterchainPacket;
use crate::types::ActorKind;

/// Isolated relayer. Holds no SunRey validator or governance key.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsolatedRelayer {
    pub relayer_id: String,
    pub kind: ActorKind,
}

impl IsolatedRelayer {
    pub fn new(relayer_id: impl Into<String>) -> Self {
        Self { relayer_id: relayer_id.into(), kind: ActorKind::Relayer }
    }

    pub fn cannot_vote(&self) -> Result<(), InteropError> {
        Err(InteropError::RelayerForbidden)
    }

    pub fn cannot_govern(&self) -> Result<(), InteropError> {
        Err(InteropError::RelayerForbidden)
    }

    pub fn cannot_forge_verification(&self) -> Result<(), InteropError> {
        Err(InteropError::RelayerForbidden)
    }
}

pub trait RelayerPort {
    fn relayer_id(&self) -> &str;
    fn observe_header(&self, header: &ForeignHeader, proof: &FinalityProof);
    fn observe_packet(&self, packet: &InterchainPacket);
}

impl RelayerPort for IsolatedRelayer {
    fn relayer_id(&self) -> &str {
        &self.relayer_id
    }

    fn observe_header(&self, _header: &ForeignHeader, _proof: &FinalityProof) {}

    fn observe_packet(&self, _packet: &InterchainPacket) {}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayerSubmission {
    pub relayer_id: String,
    pub kind: String,
    pub digest: String,
}
