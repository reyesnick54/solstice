use std::collections::{HashMap, VecDeque};

use crate::identity::{unix_ms, NodeId};

use super::types::RejectReason;

#[derive(Debug, Default)]
pub struct ConsensusRateLimiter {
    windows: HashMap<String, VecDeque<u64>>,
}

impl ConsensusRateLimiter {
    pub fn allow(&mut self, key: &str, limit: usize, window_ms: u64) -> bool {
        let now = unix_ms();
        let stamps = self.windows.entry(key.to_string()).or_default();
        while stamps
            .front()
            .is_some_and(|t| now.saturating_sub(*t) > window_ms)
        {
            stamps.pop_front();
        }
        if stamps.len() >= limit {
            return false;
        }
        stamps.push_back(now);
        true
    }

    pub fn check_peer(&mut self, peer: NodeId, reason: RejectReason) -> Result<(), RejectReason> {
        let key = format!("{}:{}", peer.hex(), reason.as_str());
        let (limit, window) = match reason {
            RejectReason::InvalidSignature
            | RejectReason::IncorrectProposer
            | RejectReason::MalformedCertificate
            | RejectReason::UnknownCryptoSuite => (8, 1_000),
            RejectReason::DuplicateProposal | RejectReason::ConflictingVote => (16, 1_000),
            RejectReason::FutureHeightSpam | RejectReason::FutureRoundSpam => (4, 1_000),
            RejectReason::OversizedBlock => (2, 5_000),
            _ => (32, 1_000),
        };
        if self.allow(&key, limit, window) {
            Ok(())
        } else {
            Err(reason)
        }
    }
}
