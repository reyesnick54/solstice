//! Deterministic four-validator development fixture.

use crate::chain::Genesis;
use crate::crypto::{DomainKey, KeyDomain};

use super::signer::ConsensusSigner;
use super::types::ConsensusParams;
use super::validators::{Validator, ValidatorSet};

pub const VALIDATOR_NAMES: [&str; 4] = ["A", "B", "C", "D"];

#[derive(Clone)]
pub struct ValidatorFixture {
    pub name: String,
    pub consensus_key: DomainKey,
    pub p2p_seed: [u8; 32],
}

#[derive(Clone)]
pub struct FourValidatorFixture {
    pub validators: Vec<ValidatorFixture>,
    pub set: ValidatorSet,
    pub genesis: Genesis,
    pub params: ConsensusParams,
}

impl FourValidatorFixture {
    pub fn development() -> Self {
        let mut validators = Vec::new();
        let mut records = Vec::new();
        for (i, name) in VALIDATOR_NAMES.iter().enumerate() {
            let mut consensus_seed = [0u8; 32];
            consensus_seed[0] = (i + 1) as u8;
            consensus_seed[31] = 0xC1;
            let mut p2p_seed = [0u8; 32];
            p2p_seed[0] = (i + 11) as u8;
            p2p_seed[31] = 0xA2;
            let consensus_key = DomainKey::from_seed(KeyDomain::ValidatorConsensus, consensus_seed);
            records.push(Validator::new(*name, &consensus_key, 1).expect("validator"));
            validators.push(ValidatorFixture {
                name: (*name).into(),
                consensus_key,
                p2p_seed,
            });
        }
        let set = ValidatorSet::new(1, records).expect("validator set");
        let mut genesis = Genesis::development();
        genesis.validator_set_hash = set.hash();
        genesis.hash = genesis.compute_hash();
        Self {
            validators,
            set,
            genesis,
            params: ConsensusParams::four_validator_p2p(),
        }
    }

    pub fn signer(&self, index: usize) -> ConsensusSigner {
        ConsensusSigner::new(self.validators[index].consensus_key.clone()).expect("signer")
    }

    pub fn by_name(&self, name: &str) -> &ValidatorFixture {
        self.validators
            .iter()
            .find(|v| v.name == name)
            .expect("named validator")
    }
}
