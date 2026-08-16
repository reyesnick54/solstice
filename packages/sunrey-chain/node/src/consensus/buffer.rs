//! Bounded future-height / future-round buffering. Unreasonable spam is rejected.

use std::collections::VecDeque;

use super::messages::ConsensusMessage;
use super::types::{ConsensusParams, Height, RejectReason, Round};

#[derive(Debug, Default)]
pub struct FutureBuffer {
    messages: VecDeque<ConsensusMessage>,
}

impl FutureBuffer {
    pub fn push(
        &mut self,
        local_height: Height,
        local_round: Round,
        params: &ConsensusParams,
        message: ConsensusMessage,
    ) -> Result<Option<ConsensusMessage>, RejectReason> {
        let Some(height) = message.height() else {
            return Ok(Some(message));
        };
        if height < local_height {
            return Ok(None);
        }
        if height > local_height.saturating_add(params.max_future_height) {
            return Err(RejectReason::FutureHeightSpam);
        }
        if let Some(round) = message.round() {
            if height == local_height && round + 1 < local_round {
                return Ok(None);
            }
            if height == local_height && round > local_round.saturating_add(params.max_future_round)
            {
                return Err(RejectReason::FutureRoundSpam);
            }
        }
        if height == local_height {
            if let Some(round) = message.round() {
                if round <= local_round {
                    return Ok(Some(message));
                }
            } else {
                return Ok(Some(message));
            }
        }
        if self.messages.len() >= params.max_buffered_messages {
            return Err(RejectReason::UnreasonableFuture);
        }
        self.messages.push_back(message);
        Ok(None)
    }

    pub fn drain_ready(
        &mut self,
        local_height: Height,
        local_round: Round,
    ) -> Vec<ConsensusMessage> {
        let mut ready = Vec::new();
        let mut kept = VecDeque::new();
        while let Some(message) = self.messages.pop_front() {
            let height = message.height().unwrap_or(local_height);
            let round = message.round().unwrap_or(0);
            if height < local_height {
                continue;
            }
            if height == local_height && round <= local_round {
                ready.push(message);
            } else {
                kept.push_back(message);
            }
        }
        self.messages = kept;
        ready
    }

    pub fn len(&self) -> usize {
        self.messages.len()
    }

    pub fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }
}
