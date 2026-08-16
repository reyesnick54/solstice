//! Development validator set. Integer voting power. Not a public staking product.

use crate::codec::{Reader, Writer};
use crate::crypto::{sha256, DomainKey, KeyDomain, CRYPTO_SUITE_ID};
use crate::error::{NodeError, NodeResult};

use super::types::Height;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ValidatorId(pub [u8; 32]);

impl ValidatorId {
    pub fn from_consensus_key(public_key: &[u8; 32]) -> Self {
        Self(sha256(public_key))
    }

    pub fn hex(self) -> String {
        hex::encode(self.0)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Validator {
    pub id: ValidatorId,
    pub name: String,
    pub consensus_public_key: [u8; 32],
    pub voting_power: u64,
    pub crypto_suite: String,
}

impl Validator {
    pub fn new(name: impl Into<String>, key: &DomainKey, voting_power: u64) -> NodeResult<Self> {
        if key.domain != KeyDomain::ValidatorConsensus {
            return Err(NodeError::Forbidden(
                "validator record requires a consensus voting key".into(),
            ));
        }
        if voting_power == 0 {
            return Err(NodeError::Validation(
                "voting power must be a positive integer".into(),
            ));
        }
        let consensus_public_key = key.public_key();
        Ok(Self {
            id: ValidatorId::from_consensus_key(&consensus_public_key),
            name: name.into(),
            consensus_public_key,
            voting_power,
            crypto_suite: CRYPTO_SUITE_ID.into(),
        })
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.bytes32(&self.id.0);
        w.string(&self.name)?;
        w.bytes32(&self.consensus_public_key);
        w.u64(self.voting_power);
        w.string(&self.crypto_suite)?;
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        let validator = Self {
            id: ValidatorId(r.bytes32()?),
            name: r.string()?,
            consensus_public_key: r.bytes32()?,
            voting_power: r.u64()?,
            crypto_suite: r.string()?,
        };
        r.finish()?;
        if validator.voting_power == 0 {
            return Err(NodeError::Validation(
                "voting power must be a positive integer".into(),
            ));
        }
        Ok(validator)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ValidatorSet {
    pub epoch: u64,
    pub validators: Vec<Validator>,
}

impl ValidatorSet {
    pub fn new(epoch: u64, mut validators: Vec<Validator>) -> NodeResult<Self> {
        validators.sort_by(|a, b| a.id.cmp(&b.id).then(a.name.cmp(&b.name)));
        let mut seen = std::collections::BTreeSet::new();
        for validator in &validators {
            if !seen.insert(validator.id) {
                return Err(NodeError::Validation("duplicate validator id".into()));
            }
            if validator.crypto_suite != CRYPTO_SUITE_ID {
                return Err(NodeError::Validation(
                    "unknown validator crypto suite".into(),
                ));
            }
        }
        Ok(Self { epoch, validators })
    }

    pub fn hash(&self) -> [u8; 32] {
        let mut w = Writer::new();
        w.u64(self.epoch);
        w.u32(self.validators.len() as u32);
        for validator in &self.validators {
            w.bytes(&validator.encode().expect("validator encode"))
                .expect("validator bytes");
        }
        sha256(&w.finish())
    }

    pub fn total_power(&self) -> u64 {
        self.validators.iter().map(|v| v.voting_power).sum()
    }

    pub fn quorum_power(&self) -> u64 {
        // Smallest integer P such that 3P > 2N, i.e. P > 2N/3.
        let total = self.total_power();
        (total.saturating_mul(2) / 3).saturating_add(1)
    }

    pub fn has_quorum(&self, power: u64) -> bool {
        power.saturating_mul(3) > self.total_power().saturating_mul(2)
    }

    pub fn has_fault_threshold(&self, power: u64) -> bool {
        // f+1: more than 1/3 of voting power.
        power.saturating_mul(3) > self.total_power()
    }

    pub fn get(&self, id: ValidatorId) -> Option<&Validator> {
        self.validators.iter().find(|v| v.id == id)
    }

    pub fn by_key(&self, public_key: &[u8; 32]) -> Option<&Validator> {
        self.validators
            .iter()
            .find(|v| v.consensus_public_key == *public_key)
    }

    pub fn proposer(&self, height: Height, round: u32) -> Option<&Validator> {
        if self.validators.is_empty() || height == 0 {
            return None;
        }
        let index =
            ((height - 1).saturating_add(u64::from(round))) as usize % self.validators.len();
        // Proposer rotation uses the genesis-declared name order A,B,C,D
        // when names are present; otherwise id order.
        let mut ordered = self.validators.clone();
        ordered.sort_by(|a, b| a.name.cmp(&b.name).then(a.id.cmp(&b.id)));
        ordered.get(index).and_then(|chosen| self.get(chosen.id))
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(1);
        w.u64(self.epoch);
        w.u32(self.validators.len() as u32);
        for validator in &self.validators {
            w.bytes(&validator.encode()?)?;
        }
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        if r.u8()? != 1 {
            return Err(NodeError::Codec("unknown validator-set schema".into()));
        }
        let epoch = r.u64()?;
        let count = r.u32()? as usize;
        if count > 64 {
            return Err(NodeError::Codec("excessive validator set".into()));
        }
        let mut validators = Vec::with_capacity(count);
        for _ in 0..count {
            validators.push(Validator::decode(&r.bytes()?)?);
        }
        r.finish()?;
        Self::new(epoch, validators)
    }

    pub fn at_height(&self, _height: Height) -> &Self {
        // Development set is static across heights. Epoch transitions are
        // not a live staking product.
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_equal_validators_need_three_for_quorum() {
        let set = four();
        assert_eq!(set.total_power(), 4);
        assert_eq!(set.quorum_power(), 3);
        assert!(!set.has_quorum(2));
        assert!(set.has_quorum(3));
        assert_eq!(set.proposer(1, 0).unwrap().name, "A");
        assert_eq!(set.proposer(2, 0).unwrap().name, "B");
        assert_eq!(set.hash(), set.hash());
    }

    fn four() -> ValidatorSet {
        let keys: Vec<_> = (1..=4)
            .map(|i| {
                let mut seed = [0u8; 32];
                seed[0] = i;
                DomainKey::from_seed(KeyDomain::ValidatorConsensus, seed)
            })
            .collect();
        ValidatorSet::new(
            1,
            vec![
                Validator::new("A", &keys[0], 1).unwrap(),
                Validator::new("B", &keys[1], 1).unwrap(),
                Validator::new("C", &keys[2], 1).unwrap(),
                Validator::new("D", &keys[3], 1).unwrap(),
            ],
        )
        .unwrap()
    }
}
