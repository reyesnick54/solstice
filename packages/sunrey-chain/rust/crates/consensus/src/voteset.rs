use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::error::ConsensusError;
use crate::message::Vote;
use crate::quorum::exceeds_two_thirds;
use crate::types::{BlockId, Height, Round, ValidatorId, VoteType};
use crate::valset::ValidatorSet;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct VoteSet {
    pub vote_type: VoteType,
    pub height: Height,
    pub round: Round,
    votes: BTreeMap<String, Vote>,
}

impl VoteSet {
    pub fn new(vote_type: VoteType, height: Height, round: Round) -> Self {
        Self { vote_type, height, round, votes: BTreeMap::new() }
    }

    pub fn add(
        &mut self,
        vote: Vote,
        set: &ValidatorSet,
    ) -> Result<Option<(Vote, Vote)>, ConsensusError> {
        if vote.vote_type != self.vote_type
            || vote.height != self.height
            || vote.round != self.round
        {
            return Err(ConsensusError::VoteRejected("vote does not match this set"));
        }
        if set.get(&vote.validator_id).is_none() {
            return Err(ConsensusError::UnknownValidator);
        }
        if let Some(existing) = self.votes.get(&vote.validator_id.0) {
            if existing.block_id != vote.block_id {
                return Ok(Some((existing.clone(), vote)));
            }
            return Ok(None);
        }
        self.votes.insert(vote.validator_id.0.clone(), vote);
        Ok(None)
    }

    pub fn get(&self, id: &ValidatorId) -> Option<&Vote> {
        self.votes.get(&id.0)
    }

    pub fn votes(&self) -> impl Iterator<Item = &Vote> {
        self.votes.values()
    }

    pub fn power_for(&self, block_id: BlockId, set: &ValidatorSet) -> Result<u64, ConsensusError> {
        let mut power = 0u64;
        for vote in self.votes.values() {
            if vote.block_id == block_id {
                if let Some(validator) = set.get(&vote.validator_id) {
                    power = power
                        .checked_add(validator.voting_power)
                        .ok_or(ConsensusError::Overflow)?;
                }
            }
        }
        Ok(power)
    }

    pub fn total_power(&self, set: &ValidatorSet) -> Result<u64, ConsensusError> {
        let mut power = 0u64;
        for vote in self.votes.values() {
            if let Some(validator) = set.get(&vote.validator_id) {
                power =
                    power.checked_add(validator.voting_power).ok_or(ConsensusError::Overflow)?;
            }
        }
        Ok(power)
    }

    pub fn has_two_thirds_for(
        &self,
        block_id: BlockId,
        set: &ValidatorSet,
    ) -> Result<bool, ConsensusError> {
        if block_id.is_nil() {
            return Ok(false);
        }
        exceeds_two_thirds(self.power_for(block_id, set)?, set.total_active_power()?)
    }

    pub fn has_two_thirds_nil(&self, set: &ValidatorSet) -> Result<bool, ConsensusError> {
        exceeds_two_thirds(self.power_for(BlockId::NIL, set)?, set.total_active_power()?)
    }

    pub fn has_two_thirds_any(&self, set: &ValidatorSet) -> Result<bool, ConsensusError> {
        exceeds_two_thirds(self.total_power(set)?, set.total_active_power()?)
    }

    pub fn quorum_block(&self, set: &ValidatorSet) -> Result<Option<BlockId>, ConsensusError> {
        let mut powers: BTreeMap<[u8; 32], u64> = BTreeMap::new();
        for vote in self.votes.values() {
            if vote.block_id.is_nil() {
                continue;
            }
            if let Some(validator) = set.get(&vote.validator_id) {
                let entry = powers.entry(vote.block_id.0).or_insert(0);
                *entry =
                    entry.checked_add(validator.voting_power).ok_or(ConsensusError::Overflow)?;
            }
        }
        let total = set.total_active_power()?;
        for (id, power) in powers {
            if exceeds_two_thirds(power, total)? {
                return Ok(Some(BlockId(id)));
            }
        }
        Ok(None)
    }

    pub fn matching(&self, block_id: BlockId) -> Vec<Vote> {
        self.votes.values().filter(|vote| vote.block_id == block_id).cloned().collect()
    }
}
