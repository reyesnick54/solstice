use crate::identity::{unix_ms, NodeId};

#[derive(Debug, Clone, serde::Serialize)]
pub struct ForkEvidence {
    pub event: &'static str,
    pub height: u64,
    pub local_block_id: String,
    pub remote_block_id: String,
    pub remote_node_id: String,
    pub local_state_root: String,
    pub remote_state_root: String,
    pub observed_at_ms: u64,
    pub note: &'static str,
}

impl ForkEvidence {
    pub fn new(
        height: u64,
        local_block_id: [u8; 32],
        remote_block_id: [u8; 32],
        remote_node_id: NodeId,
        local_state_root: [u8; 32],
        remote_state_root: [u8; 32],
    ) -> Self {
        Self {
            event: "FORK_DETECTED",
            height,
            local_block_id: hex::encode(local_block_id),
            remote_block_id: hex::encode(remote_block_id),
            remote_node_id: remote_node_id.hex(),
            local_state_root: hex::encode(local_state_root),
            remote_state_root: hex::encode(remote_state_root),
            observed_at_ms: unix_ms(),
            note: "Conflicting valid-looking histories under development assumptions. No longest-chain rule is applied. Production BFT is not implemented.",
        }
    }
}
