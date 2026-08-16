use std::collections::BTreeMap;
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Debug, Default)]
pub struct Metrics {
    pub peer_count: AtomicU64,
    pub inbound_peers: AtomicU64,
    pub outbound_peers: AtomicU64,
    pub handshake_success: AtomicU64,
    pub bytes_sent: AtomicU64,
    pub bytes_received: AtomicU64,
    pub mempool_count: AtomicU64,
    pub mempool_bytes: AtomicU64,
    pub tx_gossip_received: AtomicU64,
    pub tx_gossip_rejected: AtomicU64,
    pub block_gossip_received: AtomicU64,
    pub sync_height: AtomicU64,
    pub sync_lag: AtomicU64,
    pub peer_bans: AtomicU64,
    pub rate_limit_events: AtomicU64,
    pub fork_detected: AtomicU64,
    pub evidence_received: AtomicU64,
    pub evidence_valid: AtomicU64,
    pub evidence_invalid: AtomicU64,
    pub evidence_duplicate: AtomicU64,
    pub evidence_included: AtomicU64,
    pub validator_jailed: AtomicU64,
    pub validator_tombstoned: AtomicU64,
    pub simulation_bond_penalized: AtomicU64,
    pub evidence_processing_latency_ms: AtomicU64,
    pub evidence_pool_size: AtomicU64,
    handshake_reject: parking_lot::Mutex<BTreeMap<String, u64>>,
}

impl Metrics {
    pub fn inc_handshake_reject(&self, reason: &str) {
        *self
            .handshake_reject
            .lock()
            .entry(reason.to_string())
            .or_default() += 1;
    }

    pub fn handshake_reject_by_reason(&self) -> BTreeMap<String, u64> {
        self.handshake_reject.lock().clone()
    }

    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            peer_count: self.peer_count.load(Ordering::Relaxed),
            inbound_peers: self.inbound_peers.load(Ordering::Relaxed),
            outbound_peers: self.outbound_peers.load(Ordering::Relaxed),
            handshake_success: self.handshake_success.load(Ordering::Relaxed),
            handshake_reject_by_reason: self.handshake_reject_by_reason(),
            bytes_sent: self.bytes_sent.load(Ordering::Relaxed),
            bytes_received: self.bytes_received.load(Ordering::Relaxed),
            mempool_count: self.mempool_count.load(Ordering::Relaxed),
            mempool_bytes: self.mempool_bytes.load(Ordering::Relaxed),
            tx_gossip_received: self.tx_gossip_received.load(Ordering::Relaxed),
            tx_gossip_rejected: self.tx_gossip_rejected.load(Ordering::Relaxed),
            block_gossip_received: self.block_gossip_received.load(Ordering::Relaxed),
            sync_height: self.sync_height.load(Ordering::Relaxed),
            sync_lag: self.sync_lag.load(Ordering::Relaxed),
            peer_bans: self.peer_bans.load(Ordering::Relaxed),
            rate_limit_events: self.rate_limit_events.load(Ordering::Relaxed),
            fork_detected: self.fork_detected.load(Ordering::Relaxed),
            evidence_received: self.evidence_received.load(Ordering::Relaxed),
            evidence_valid: self.evidence_valid.load(Ordering::Relaxed),
            evidence_invalid: self.evidence_invalid.load(Ordering::Relaxed),
            evidence_duplicate: self.evidence_duplicate.load(Ordering::Relaxed),
            evidence_included: self.evidence_included.load(Ordering::Relaxed),
            validator_jailed: self.validator_jailed.load(Ordering::Relaxed),
            validator_tombstoned: self.validator_tombstoned.load(Ordering::Relaxed),
            simulation_bond_penalized: self.simulation_bond_penalized.load(Ordering::Relaxed),
            evidence_processing_latency_ms: self
                .evidence_processing_latency_ms
                .load(Ordering::Relaxed),
            evidence_pool_size: self.evidence_pool_size.load(Ordering::Relaxed),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MetricsSnapshot {
    pub peer_count: u64,
    pub inbound_peers: u64,
    pub outbound_peers: u64,
    pub handshake_success: u64,
    pub handshake_reject_by_reason: BTreeMap<String, u64>,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub mempool_count: u64,
    pub mempool_bytes: u64,
    pub tx_gossip_received: u64,
    pub tx_gossip_rejected: u64,
    pub block_gossip_received: u64,
    pub sync_height: u64,
    pub sync_lag: u64,
    pub peer_bans: u64,
    pub rate_limit_events: u64,
    pub fork_detected: u64,
    pub evidence_received: u64,
    pub evidence_valid: u64,
    pub evidence_invalid: u64,
    pub evidence_duplicate: u64,
    pub evidence_included: u64,
    pub validator_jailed: u64,
    pub validator_tombstoned: u64,
    pub simulation_bond_penalized: u64,
    pub evidence_processing_latency_ms: u64,
    pub evidence_pool_size: u64,
}
