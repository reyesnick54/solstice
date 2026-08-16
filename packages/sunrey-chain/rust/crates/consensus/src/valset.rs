use serde::{Deserialize, Serialize};
use sunrey_protocol::{
    decode_bytes, decode_string, decode_u64, encode_bytes, encode_string, encode_u32, encode_u64,
    DomainHasher, Hash32, DOMAIN_VALSET,
};

use crate::error::ConsensusError;
use crate::types::{Height, Round, ValidatorId};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Validator {
    pub validator_id: ValidatorId,
    pub public_key: Vec<u8>,
    pub voting_power: u64,
    pub proposer_priority: i64,
}

impl Validator {
    pub fn new(
        validator_id: impl Into<ValidatorId>,
        public_key: Vec<u8>,
        voting_power: u64,
    ) -> Self {
        Self { validator_id: validator_id.into(), public_key, voting_power, proposer_priority: 0 }
    }

    pub fn is_active(&self) -> bool {
        self.voting_power > 0
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ValidatorSet {
    pub version: u64,
    pub validators: Vec<Validator>,
}

impl ValidatorSet {
    pub fn new(version: u64, mut validators: Vec<Validator>) -> Result<Self, ConsensusError> {
        if validators.is_empty() {
            return Err(ConsensusError::EmptyValidatorSet);
        }
        validators.sort_by(|a, b| a.validator_id.cmp(&b.validator_id));
        let mut seen = std::collections::BTreeSet::new();
        for validator in &validators {
            if !seen.insert(&validator.validator_id) {
                return Err(ConsensusError::DuplicateValidator);
            }
            if validator.public_key.len() != 32 {
                return Err(ConsensusError::ProposalRejected(
                    "validator public key must be 32 bytes",
                ));
            }
        }
        if validators.iter().all(|v| !v.is_active()) {
            return Err(ConsensusError::EmptyValidatorSet);
        }
        Ok(Self { version, validators })
    }

    pub fn get(&self, id: &ValidatorId) -> Option<&Validator> {
        self.validators.iter().find(|v| &v.validator_id == id)
    }

    pub fn total_active_power(&self) -> Result<u64, ConsensusError> {
        let mut total = 0u64;
        for validator in &self.validators {
            if validator.is_active() {
                total =
                    total.checked_add(validator.voting_power).ok_or(ConsensusError::Overflow)?;
            }
        }
        if total == 0 {
            return Err(ConsensusError::EmptyValidatorSet);
        }
        Ok(total)
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, "ValidatorSetV1");
        encode_u64(&mut out, self.version);
        encode_u32(&mut out, self.validators.len() as u32);
        for validator in &self.validators {
            encode_string(&mut out, validator.validator_id.as_str());
            encode_bytes(&mut out, &validator.public_key);
            encode_u64(&mut out, validator.voting_power);
            encode_i64(&mut out, validator.proposer_priority);
        }
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, ConsensusError> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| ConsensusError::Decode)?;
        if tag != "ValidatorSetV1" {
            return Err(ConsensusError::Decode);
        }
        let version = decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?;
        let count =
            sunrey_protocol::decode_u32(&mut input).map_err(|_| ConsensusError::Decode)? as usize;
        let mut validators = Vec::with_capacity(count);
        for _ in 0..count {
            let validator_id =
                ValidatorId(decode_string(&mut input).map_err(|_| ConsensusError::Decode)?);
            let public_key = decode_bytes(&mut input).map_err(|_| ConsensusError::Decode)?;
            let voting_power = decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?;
            let proposer_priority = decode_i64(&mut input)?;
            validators.push(Validator {
                validator_id,
                public_key,
                voting_power,
                proposer_priority,
            });
        }
        if !input.is_empty() {
            return Err(ConsensusError::Decode);
        }
        Self::new(version, validators)
    }

    pub fn hash(&self, hasher: &dyn DomainHasher) -> Hash32 {
        hasher.hash(DOMAIN_VALSET, &self.encode())
    }

    /// One Tendermint/CometBFT `IncrementProposerPriority` step.
    pub fn increment_proposer_priority(&mut self) -> Result<ValidatorId, ConsensusError> {
        let total = self.total_active_power()?;
        let total_i64 = i64::try_from(total).map_err(|_| ConsensusError::Overflow)?;
        for validator in &mut self.validators {
            if !validator.is_active() {
                continue;
            }
            let power =
                i64::try_from(validator.voting_power).map_err(|_| ConsensusError::Overflow)?;
            validator.proposer_priority =
                validator.proposer_priority.checked_add(power).ok_or(ConsensusError::Overflow)?;
        }
        let idx = self
            .validators
            .iter()
            .enumerate()
            .filter(|(_, v)| v.is_active())
            .max_by(|(_, a), (_, b)| {
                a.proposer_priority
                    .cmp(&b.proposer_priority)
                    .then_with(|| b.validator_id.cmp(&a.validator_id))
            })
            .map(|(i, _)| i)
            .ok_or(ConsensusError::EmptyValidatorSet)?;
        self.validators[idx].proposer_priority = self.validators[idx]
            .proposer_priority
            .checked_sub(total_i64)
            .ok_or(ConsensusError::Overflow)?;
        clip_priorities(&mut self.validators, total_i64);
        Ok(self.validators[idx].validator_id.clone())
    }

    /// Path-independent proposer: same set + same height/round → same proposer.
    ///
    /// Starts from zero priorities and applies `(height−1) + round + 1`
    /// increments so height 1 / round 0 selects after one increment.
    pub fn select_proposer(
        &self,
        height: Height,
        round: Round,
    ) -> Result<ValidatorId, ConsensusError> {
        if height.get() == 0 {
            return Err(ConsensusError::InvalidHeight);
        }
        let times = height
            .saturating_minus_one()
            .checked_add(u64::from(round.get()))
            .and_then(|v| v.checked_add(1))
            .ok_or(ConsensusError::Overflow)?;
        let mut working = self.clone();
        for validator in &mut working.validators {
            validator.proposer_priority = 0;
        }
        let mut selected = None;
        for _ in 0..times {
            selected = Some(working.increment_proposer_priority()?);
        }
        selected.ok_or(ConsensusError::EmptyValidatorSet)
    }

    /// Persist proposer-priority state so it matches `select_proposer`.
    pub fn sync_priorities(
        &mut self,
        height: Height,
        round: Round,
    ) -> Result<ValidatorId, ConsensusError> {
        let selected = self.select_proposer(height, round)?;
        for validator in &mut self.validators {
            validator.proposer_priority = 0;
        }
        let times = height
            .saturating_minus_one()
            .checked_add(u64::from(round.get()))
            .and_then(|v| v.checked_add(1))
            .ok_or(ConsensusError::Overflow)?;
        let mut last = None;
        for _ in 0..times {
            last = Some(self.increment_proposer_priority()?);
        }
        debug_assert_eq!(last.as_ref(), Some(&selected));
        Ok(selected)
    }
}

fn clip_priorities(validators: &mut [Validator], total: i64) {
    let bound = total.saturating_mul(2);
    for validator in validators {
        if validator.proposer_priority > bound {
            validator.proposer_priority = bound;
        } else if validator.proposer_priority < -bound {
            validator.proposer_priority = -bound;
        }
    }
}

fn encode_i64(out: &mut Vec<u8>, value: i64) {
    out.extend_from_slice(&value.to_be_bytes());
}

fn decode_i64(input: &mut &[u8]) -> Result<i64, ConsensusError> {
    if input.len() < 8 {
        return Err(ConsensusError::Decode);
    }
    let (head, rest) = input.split_at(8);
    *input = rest;
    Ok(i64::from_be_bytes(head.try_into().map_err(|_| ConsensusError::Decode)?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use sunrey_crypto::DevEd25519Sha256Suite;

    fn set_equal() -> ValidatorSet {
        ValidatorSet::new(
            1,
            vec![
                Validator::new("val_a", vec![1; 32], 10),
                Validator::new("val_b", vec![2; 32], 10),
                Validator::new("val_c", vec![3; 32], 10),
                Validator::new("val_d", vec![4; 32], 10),
            ],
        )
        .unwrap()
    }

    #[test]
    fn equal_power_rotates_deterministically() {
        let set = set_equal();
        let first = set.select_proposer(Height::FIRST, Round::ZERO).unwrap();
        let second = set.select_proposer(Height::FIRST, Round::new(1)).unwrap();
        let again = set.select_proposer(Height::FIRST, Round::ZERO).unwrap();
        assert_eq!(first, ValidatorId::from("val_a"));
        assert_eq!(second, ValidatorId::from("val_b"));
        assert_eq!(first, again);
    }

    #[test]
    fn weighted_power_prefers_heavier_validator() {
        let set = ValidatorSet::new(
            1,
            vec![
                Validator::new("val_a", vec![1; 32], 1),
                Validator::new("val_b", vec![2; 32], 1),
                Validator::new("val_c", vec![3; 32], 8),
            ],
        )
        .unwrap();
        let mut counts = std::collections::BTreeMap::new();
        for height in 1u64..=12 {
            let id = set.select_proposer(Height::new(height), Round::ZERO).unwrap();
            *counts.entry(id.0).or_insert(0u32) += 1;
        }
        assert!(counts["val_c"] > counts["val_a"]);
        assert!(counts["val_c"] > counts["val_b"]);
    }

    #[test]
    fn hash_is_stable() {
        let suite = DevEd25519Sha256Suite;
        let a = set_equal().hash(&suite);
        let b = set_equal().hash(&suite);
        assert_eq!(a, b);
    }
}
