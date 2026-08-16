use std::collections::HashSet;
use std::sync::atomic::Ordering;

use crate::chain::Block;
use crate::identity::NodeId;

use super::auth::{authenticate, ConsensusAuthContext};
use super::buffer::FutureBuffer;
use super::dos::ConsensusRateLimiter;
use super::engine::{Action, ConsensusEngine};
use super::messages::ConsensusMessage;
use super::metrics::ConsensusMetrics;
use super::types::RejectReason;
use super::vote::SignedVote;

pub struct ConsensusReactor {
    pub engine: ConsensusEngine,
    pub buffer: FutureBuffer,
    pub limiter: ConsensusRateLimiter,
    pub metrics: ConsensusMetrics,
    seen: HashSet<[u8; 32]>,
}

impl ConsensusReactor {
    pub fn new(engine: ConsensusEngine) -> Self {
        Self {
            engine,
            buffer: FutureBuffer::default(),
            limiter: ConsensusRateLimiter::default(),
            metrics: ConsensusMetrics::default(),
            seen: HashSet::new(),
        }
    }

    pub fn start(&mut self) -> Vec<Action> {
        let before = (self.engine.height, self.engine.round);
        let actions = self.engine.start();
        self.note_round(before);
        actions
    }

    pub fn ingest(
        &mut self,
        ctx: &ConsensusAuthContext<'_>,
        message: ConsensusMessage,
    ) -> (Vec<Action>, bool) {
        if let Err(reason) = authenticate(ctx, &message) {
            return (self.reject(ctx.peer_id, reason), false);
        }
        let hash = message
            .encode()
            .ok()
            .map(|bytes| crate::crypto::sha256(&bytes))
            .unwrap_or_else(|| {
                vote_of(&message)
                    .map(|v| v.signed_hash())
                    .unwrap_or([0u8; 32])
            });
        if !self.seen.insert(hash) {
            return (Vec::new(), false);
        }
        match self.buffer.push(
            self.engine.height,
            self.engine.round,
            &self.engine.params,
            message,
        ) {
            Ok(Some(message)) => {
                let before = (self.engine.height, self.engine.round);
                let actions = self.engine.on_message(message);
                self.note_round(before);
                (actions, true)
            }
            Ok(None) => (Vec::new(), true),
            Err(reason) => (self.reject(ctx.peer_id, reason), false),
        }
    }

    pub fn drain_buffer(&mut self) -> Vec<Action> {
        let ready = self
            .buffer
            .drain_ready(self.engine.height, self.engine.round);
        let mut actions = Vec::new();
        for message in ready {
            let before = (self.engine.height, self.engine.round);
            actions.extend(self.engine.on_message(message));
            self.note_round(before);
        }
        actions
    }

    pub fn on_timeout(
        &mut self,
        kind: super::types::TimeoutKind,
        height: u64,
        round: u32,
    ) -> Vec<Action> {
        let before = (self.engine.height, self.engine.round);
        let actions = self.engine.on_timeout(kind, height, round);
        self.note_round(before);
        actions
    }

    pub fn on_local_block(&mut self, block: Block) -> Vec<Action> {
        let before = (self.engine.height, self.engine.round);
        let actions = self.engine.on_local_block(block);
        self.note_round(before);
        actions
    }

    fn note_round(&self, before: (u64, u32)) {
        if (self.engine.height, self.engine.round) != before {
            self.metrics.round_changes.fetch_add(1, Ordering::Relaxed);
        }
    }

    fn reject(&mut self, peer: Option<NodeId>, reason: RejectReason) -> Vec<Action> {
        self.metrics
            .consensus_message_rejects
            .fetch_add(1, Ordering::Relaxed);
        if let Some(peer) = peer {
            let _ = self.limiter.check_peer(peer, reason);
        }
        vec![Action::Reject { reason }]
    }
}

fn vote_of(message: &ConsensusMessage) -> Option<&SignedVote> {
    match message {
        ConsensusMessage::Prevote(vote) | ConsensusMessage::Precommit(vote) => Some(vote),
        _ => None,
    }
}
