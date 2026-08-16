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
        // Same-height later-round votes, proposals, and hints must be
        // processed immediately so a joiner can jump forward. Only future
        // *heights* are buffered.
        if height == local_height {
            return Ok(Some(message));
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::consensus::types::Step;

    #[test]
    fn same_height_later_round_is_not_buffered() {
        let mut buffer = FutureBuffer::default();
        let params = ConsensusParams::default();
        let hint = ConsensusMessage::RoundStateHint {
            height: 1,
            round: 5,
            step: Step::Prevote,
        };
        let ready = buffer
            .push(1, 0, &params, hint.clone())
            .expect("push")
            .expect("same-height later round must be live");
        assert_eq!(ready, hint);
        assert!(buffer.is_empty());
    }

    #[test]
    fn future_height_is_buffered_and_unreasonable_height_is_rejected() {
        let mut buffer = FutureBuffer::default();
        let params = ConsensusParams::default();
        let next = ConsensusMessage::RoundStateHint {
            height: 2,
            round: 0,
            step: Step::Propose,
        };
        assert!(buffer
            .push(1, 0, &params, next)
            .expect("future height")
            .is_none());
        assert_eq!(buffer.len(), 1);
        let spam = ConsensusMessage::RoundStateHint {
            height: 1 + params.max_future_height + 1,
            round: 0,
            step: Step::Propose,
        };
        assert_eq!(
            buffer.push(1, 0, &params, spam).unwrap_err(),
            RejectReason::FutureHeightSpam
        );
    }
}
