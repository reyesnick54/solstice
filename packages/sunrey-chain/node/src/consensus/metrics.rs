use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Debug, Default)]
pub struct ConsensusMetrics {
    pub consensus_peer_count: AtomicU64,
    pub proposal_gossip_latency_ms: AtomicU64,
    pub prevote_gossip_latency_ms: AtomicU64,
    pub precommit_gossip_latency_ms: AtomicU64,
    pub commit_gossip_latency_ms: AtomicU64,
    pub finality_latency_ms: AtomicU64,
    pub round_changes: AtomicU64,
    pub validator_missed_votes: AtomicU64,
    pub validator_sync_lag: AtomicU64,
    pub consensus_message_rejects: AtomicU64,
    pub partition_recovery_time_ms: AtomicU64,
}

impl ConsensusMetrics {
    pub fn snapshot(&self) -> ConsensusMetricsSnapshot {
        ConsensusMetricsSnapshot {
            consensus_peer_count: self.consensus_peer_count.load(Ordering::Relaxed),
            proposal_gossip_latency_ms: self.proposal_gossip_latency_ms.load(Ordering::Relaxed),
            prevote_gossip_latency_ms: self.prevote_gossip_latency_ms.load(Ordering::Relaxed),
            precommit_gossip_latency_ms: self.precommit_gossip_latency_ms.load(Ordering::Relaxed),
            commit_gossip_latency_ms: self.commit_gossip_latency_ms.load(Ordering::Relaxed),
            finality_latency_ms: self.finality_latency_ms.load(Ordering::Relaxed),
            round_changes: self.round_changes.load(Ordering::Relaxed),
            validator_missed_votes: self.validator_missed_votes.load(Ordering::Relaxed),
            validator_sync_lag: self.validator_sync_lag.load(Ordering::Relaxed),
            consensus_message_rejects: self.consensus_message_rejects.load(Ordering::Relaxed),
            partition_recovery_time_ms: self.partition_recovery_time_ms.load(Ordering::Relaxed),
        }
    }

    pub fn observe_latency(&self, kind: &str, started_ms: u64, now_ms: u64) {
        let delta = now_ms.saturating_sub(started_ms);
        let target = match kind {
            "proposal" => &self.proposal_gossip_latency_ms,
            "prevote" => &self.prevote_gossip_latency_ms,
            "precommit" => &self.precommit_gossip_latency_ms,
            "commit" => &self.commit_gossip_latency_ms,
            "finality" => &self.finality_latency_ms,
            _ => return,
        };
        target.store(delta, Ordering::Relaxed);
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ConsensusMetricsSnapshot {
    pub consensus_peer_count: u64,
    pub proposal_gossip_latency_ms: u64,
    pub prevote_gossip_latency_ms: u64,
    pub precommit_gossip_latency_ms: u64,
    pub commit_gossip_latency_ms: u64,
    pub finality_latency_ms: u64,
    pub round_changes: u64,
    pub validator_missed_votes: u64,
    pub validator_sync_lag: u64,
    pub consensus_message_rejects: u64,
    pub partition_recovery_time_ms: u64,
}
