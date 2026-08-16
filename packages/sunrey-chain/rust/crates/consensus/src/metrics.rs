use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;

#[derive(Debug, Default)]
pub struct ConsensusMetrics {
    pub consensus_height: AtomicU64,
    pub consensus_round: AtomicU64,
    pub consensus_step: AtomicU64,
    pub proposal_received: AtomicU64,
    pub proposal_rejected: AtomicU64,
    pub prevotes_received: AtomicU64,
    pub precommits_received: AtomicU64,
    pub voting_power_prevote: AtomicU64,
    pub voting_power_precommit: AtomicU64,
    pub locked_round: AtomicU64,
    pub timeout_count: AtomicU64,
    pub round_changes: AtomicU64,
    pub commit_latency_ms: AtomicU64,
    pub commit_height: AtomicU64,
    pub consensus_wal_recovery: AtomicU64,
}

impl ConsensusMetrics {
    pub fn set_step(&self, height: u64, round: u64, step: u8) {
        self.consensus_height.store(height, Ordering::Relaxed);
        self.consensus_round.store(round, Ordering::Relaxed);
        self.consensus_step.store(u64::from(step), Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> ConsensusMetricsSnapshot {
        ConsensusMetricsSnapshot {
            consensus_height: self.consensus_height.load(Ordering::Relaxed),
            consensus_round: self.consensus_round.load(Ordering::Relaxed),
            consensus_step: self.consensus_step.load(Ordering::Relaxed),
            proposal_received: self.proposal_received.load(Ordering::Relaxed),
            proposal_rejected: self.proposal_rejected.load(Ordering::Relaxed),
            prevotes_received: self.prevotes_received.load(Ordering::Relaxed),
            precommits_received: self.precommits_received.load(Ordering::Relaxed),
            voting_power_prevote: self.voting_power_prevote.load(Ordering::Relaxed),
            voting_power_precommit: self.voting_power_precommit.load(Ordering::Relaxed),
            locked_round: self.locked_round.load(Ordering::Relaxed),
            timeout_count: self.timeout_count.load(Ordering::Relaxed),
            round_changes: self.round_changes.load(Ordering::Relaxed),
            commit_latency_ms: self.commit_latency_ms.load(Ordering::Relaxed),
            commit_height: self.commit_height.load(Ordering::Relaxed),
            consensus_wal_recovery: self.consensus_wal_recovery.load(Ordering::Relaxed),
        }
    }
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct ConsensusMetricsSnapshot {
    pub consensus_height: u64,
    pub consensus_round: u64,
    pub consensus_step: u64,
    pub proposal_received: u64,
    pub proposal_rejected: u64,
    pub prevotes_received: u64,
    pub precommits_received: u64,
    pub voting_power_prevote: u64,
    pub voting_power_precommit: u64,
    pub locked_round: u64,
    pub timeout_count: u64,
    pub round_changes: u64,
    pub commit_latency_ms: u64,
    pub commit_height: u64,
    pub consensus_wal_recovery: u64,
}
