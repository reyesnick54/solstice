//! Development validator registry, simulation bonds, and epoch sets.
//!
//! Bonds are integer `SimulationBondUnits` only. They are not Money, not
//! customer fiat, not SunRey Coin, and not MoonRey. No yield product.

use std::collections::BTreeMap;

use crate::codec::{Reader, Writer};
use crate::crypto::{sha256, DomainKey, KeyDomain};
use crate::error::{NodeError, NodeResult};

pub const DEFAULT_EPOCH_LENGTH: u64 = 4;
pub const DEFAULT_SIMULATION_BOND_UNITS: u128 = 1_000_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ValidatorStatus {
    Candidate = 0,
    Active = 1,
    Jailed = 2,
    Tombstoned = 3,
    Exited = 4,
}

impl ValidatorStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Candidate => "CANDIDATE",
            Self::Active => "ACTIVE",
            Self::Jailed => "JAILED",
            Self::Tombstoned => "TOMBSTONED",
            Self::Exited => "EXITED",
        }
    }

    pub fn from_u8(value: u8) -> NodeResult<Self> {
        match value {
            0 => Ok(Self::Candidate),
            1 => Ok(Self::Active),
            2 => Ok(Self::Jailed),
            3 => Ok(Self::Tombstoned),
            4 => Ok(Self::Exited),
            _ => Err(NodeError::Validation("unknown validator status".into())),
        }
    }

    pub fn is_consensus_eligible(self) -> bool {
        self == Self::Active
    }
}

/// Integer protocol-bond units. Distinct from `packages/money` Money.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct SimulationBond {
    pub bond_units: u128,
    pub locked_units: u128,
    pub penalized_units: u128,
    pub remaining_units: u128,
}

impl SimulationBond {
    pub fn new(bond_units: u128) -> Self {
        Self {
            bond_units,
            locked_units: bond_units,
            penalized_units: 0,
            remaining_units: bond_units,
        }
    }

    pub fn apply_penalty(&mut self, units: u128) -> u128 {
        let applied = units.min(self.remaining_units);
        self.penalized_units = self.penalized_units.saturating_add(applied);
        self.remaining_units = self.remaining_units.saturating_sub(applied);
        self.locked_units = self.remaining_units;
        applied
    }

    pub fn encode(&self, w: &mut Writer) {
        w.u64((self.bond_units >> 64) as u64);
        w.u64(self.bond_units as u64);
        w.u64((self.locked_units >> 64) as u64);
        w.u64(self.locked_units as u64);
        w.u64((self.penalized_units >> 64) as u64);
        w.u64(self.penalized_units as u64);
        w.u64((self.remaining_units >> 64) as u64);
        w.u64(self.remaining_units as u64);
    }

    pub fn decode(r: &mut Reader<'_>) -> NodeResult<Self> {
        Ok(Self {
            bond_units: read_u128(r)?,
            locked_units: read_u128(r)?,
            penalized_units: read_u128(r)?,
            remaining_units: read_u128(r)?,
        })
    }
}

fn read_u128(r: &mut Reader<'_>) -> NodeResult<u128> {
    let hi = r.u64()? as u128;
    let lo = r.u64()? as u128;
    Ok((hi << 64) | lo)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatorRecord {
    pub validator_id: String,
    pub operator_id: String,
    pub consensus_pubkey: [u8; 32],
    pub proposal_pubkey: [u8; 32],
    pub voting_power: u64,
    pub status: ValidatorStatus,
    pub bond: SimulationBond,
    pub jailed_until_epoch: Option<u64>,
}

impl ValidatorRecord {
    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.string(&self.validator_id)?;
        w.string(&self.operator_id)?;
        w.bytes32(&self.consensus_pubkey);
        w.bytes32(&self.proposal_pubkey);
        w.u64(self.voting_power);
        w.u8(self.status as u8);
        self.bond.encode(&mut w);
        match self.jailed_until_epoch {
            Some(epoch) => {
                w.u8(1);
                w.u64(epoch);
            }
            None => w.u8(0),
        }
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        let record = Self {
            validator_id: r.string()?,
            operator_id: r.string()?,
            consensus_pubkey: r.bytes32()?,
            proposal_pubkey: r.bytes32()?,
            voting_power: r.u64()?,
            status: ValidatorStatus::from_u8(r.u8()?)?,
            bond: SimulationBond::decode(&mut r)?,
            jailed_until_epoch: if r.u8()? == 1 { Some(r.u64()?) } else { None },
        };
        r.finish()?;
        Ok(record)
    }

    pub fn is_eligible(&self) -> bool {
        self.status.is_consensus_eligible() && self.voting_power > 0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatorSet {
    pub version: u64,
    pub epoch: u64,
    pub validators: Vec<ValidatorRecord>,
}

impl ValidatorSet {
    pub fn empty() -> Self {
        Self {
            version: 0,
            epoch: 0,
            validators: Vec::new(),
        }
    }

    pub fn sort(&mut self) {
        self.validators
            .sort_by(|a, b| a.validator_id.cmp(&b.validator_id));
    }

    pub fn hash(&self) -> [u8; 32] {
        let mut w = Writer::new();
        w.u64(self.version);
        w.u64(self.epoch);
        w.u32(self.validators.len() as u32);
        let mut ordered = self.validators.clone();
        ordered.sort_by(|a, b| a.validator_id.cmp(&b.validator_id));
        for validator in &ordered {
            w.bytes(&validator.encode().expect("validator encode"))
                .expect("validator bytes");
        }
        sha256(&w.finish())
    }

    pub fn get(&self, validator_id: &str) -> Option<&ValidatorRecord> {
        self.validators
            .iter()
            .find(|v| v.validator_id == validator_id)
    }

    pub fn get_mut(&mut self, validator_id: &str) -> Option<&mut ValidatorRecord> {
        self.validators
            .iter_mut()
            .find(|v| v.validator_id == validator_id)
    }

    pub fn by_consensus_key(&self, key: &[u8; 32]) -> Option<&ValidatorRecord> {
        self.validators.iter().find(|v| &v.consensus_pubkey == key)
    }

    pub fn total_voting_power(&self) -> u64 {
        self.validators.iter().map(|v| v.voting_power).sum()
    }

    pub fn eligible_voting_power(&self) -> u64 {
        self.validators
            .iter()
            .filter(|v| v.is_eligible())
            .map(|v| v.voting_power)
            .sum()
    }

    pub fn bft_quorum(&self) -> u64 {
        let total = self.eligible_voting_power();
        if total == 0 {
            return 1;
        }
        (total * 2) / 3 + 1
    }

    pub fn remaining_can_progress(&self) -> bool {
        self.eligible_voting_power() >= self.bft_quorum()
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u64(self.version);
        w.u64(self.epoch);
        w.u32(self.validators.len() as u32);
        for validator in &self.validators {
            w.bytes(&validator.encode()?)?;
        }
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        let version = r.u64()?;
        let epoch = r.u64()?;
        let count = r.u32()? as usize;
        if count > 128 {
            return Err(NodeError::Codec("excessive validator set".into()));
        }
        let mut validators = Vec::with_capacity(count);
        for _ in 0..count {
            validators.push(ValidatorRecord::decode(&r.bytes()?)?);
        }
        r.finish()?;
        Ok(Self {
            version,
            epoch,
            validators,
        })
    }
}

#[derive(Debug, Clone)]
pub struct ValidatorRuntime {
    pub epoch_length: u64,
    pub active: ValidatorSet,
    pub pending: ValidatorSet,
    pub history: BTreeMap<u64, ValidatorSet>,
}

impl ValidatorRuntime {
    pub fn new(genesis: ValidatorSet, epoch_length: u64) -> Self {
        let mut genesis = genesis;
        genesis.sort();
        let mut history = BTreeMap::new();
        history.insert(0, genesis.clone());
        Self {
            epoch_length: epoch_length.max(1),
            active: genesis.clone(),
            pending: genesis,
            history,
        }
    }

    pub fn empty() -> Self {
        Self::new(ValidatorSet::empty(), DEFAULT_EPOCH_LENGTH)
    }

    pub fn epoch_of(&self, height: u64) -> u64 {
        if height == 0 {
            0
        } else {
            (height - 1) / self.epoch_length
        }
    }

    pub fn is_epoch_end(&self, height: u64) -> bool {
        height > 0 && height % self.epoch_length == 0
    }

    pub fn set_at_height(&self, height: u64) -> &ValidatorSet {
        let epoch = self.epoch_of(height);
        self.history.get(&epoch).unwrap_or(&self.active)
    }

    pub fn commit_epoch_if_needed(&mut self, applied_height: u64) {
        if !self.is_epoch_end(applied_height) {
            return;
        }
        let next_epoch = self.epoch_of(applied_height) + 1;
        self.pending.epoch = next_epoch;
        self.pending.version = self.active.version.saturating_add(1);
        self.pending.sort();
        self.active = self.pending.clone();
        self.history.insert(next_epoch, self.active.clone());
    }
}

#[derive(Clone)]
pub struct ValidatorFixture {
    pub record: ValidatorRecord,
    pub consensus: DomainKey,
    pub proposal: DomainKey,
}

pub fn development_validator(id: &str, index: u8, voting_power: u64) -> ValidatorFixture {
    let mut consensus_seed = [0xC0u8; 32];
    consensus_seed[31] = index;
    let mut proposal_seed = [0xB0u8; 32];
    proposal_seed[31] = index;
    let consensus = DomainKey::from_seed(KeyDomain::ValidatorConsensus, consensus_seed);
    let proposal = DomainKey::from_seed(KeyDomain::ValidatorProposal, proposal_seed);
    ValidatorFixture {
        record: ValidatorRecord {
            validator_id: id.into(),
            operator_id: format!("op-{id}"),
            consensus_pubkey: consensus.public_key(),
            proposal_pubkey: proposal.public_key(),
            voting_power,
            status: ValidatorStatus::Active,
            bond: SimulationBond::new(DEFAULT_SIMULATION_BOND_UNITS),
            jailed_until_epoch: None,
        },
        consensus,
        proposal,
    }
}

pub fn four_validator_devnet() -> (ValidatorSet, Vec<ValidatorFixture>) {
    let fixtures = vec![
        development_validator("val-a", 1, 10),
        development_validator("val-b", 2, 10),
        development_validator("val-c", 3, 10),
        development_validator("val-d", 4, 10),
    ];
    let mut set = ValidatorSet {
        version: 1,
        epoch: 0,
        validators: fixtures.iter().map(|f| f.record.clone()).collect(),
    };
    set.sort();
    (set, fixtures)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bond_penalty_is_integer_and_capped() {
        let mut bond = SimulationBond::new(100);
        assert_eq!(bond.apply_penalty(40), 40);
        assert_eq!(bond.remaining_units, 60);
        assert_eq!(bond.penalized_units, 40);
        assert_eq!(bond.apply_penalty(1000), 60);
        assert_eq!(bond.remaining_units, 0);
        assert_eq!(bond.penalized_units, 100);
    }

    #[test]
    fn set_hash_is_order_independent() {
        let (mut set, _) = four_validator_devnet();
        let hash = set.hash();
        set.validators.reverse();
        assert_eq!(set.hash(), hash);
    }

    #[test]
    fn epoch_transition_does_not_rewrite_history() {
        let (set, _) = four_validator_devnet();
        let mut runtime = ValidatorRuntime::new(set, 4);
        let original = runtime.history.get(&0).unwrap().hash();
        runtime.pending.validators[0].voting_power = 0;
        runtime.commit_epoch_if_needed(4);
        assert_eq!(runtime.history.get(&0).unwrap().hash(), original);
        assert_eq!(runtime.active.epoch, 1);
        assert_eq!(runtime.active.validators[0].voting_power, 0);
    }
}
