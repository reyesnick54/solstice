use serde::{Deserialize, Serialize};
use sunrey_protocol::{
    encode_string, encode_u32, encode_u64, DomainHasher, Hash32, DOMAIN_CONSENSUS_PARAMS,
};

use crate::error::ConsensusError;

const MIN_TIMEOUT_MS: u64 = 1;
const MAX_TIMEOUT_MS: u64 = 60_000;
const MAX_COMMIT_DELAY_MS: u64 = 10_000;
const MAX_BLOCK_BYTES: u32 = 1_048_576;
const MAX_TRANSACTIONS: u32 = 4_096;
const MAX_EVIDENCE_AGE: u64 = 100_000;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimeoutConfig {
    pub propose_timeout_ms: u64,
    pub prevote_timeout_ms: u64,
    pub precommit_timeout_ms: u64,
    pub commit_delay_ms: u64,
}

impl TimeoutConfig {
    pub fn development() -> Self {
        Self {
            propose_timeout_ms: 200,
            prevote_timeout_ms: 200,
            precommit_timeout_ms: 200,
            commit_delay_ms: 0,
        }
    }

    pub fn validate(&self) -> Result<(), ConsensusError> {
        for value in [self.propose_timeout_ms, self.prevote_timeout_ms, self.precommit_timeout_ms] {
            if !(MIN_TIMEOUT_MS..=MAX_TIMEOUT_MS).contains(&value) {
                return Err(ConsensusError::TimeoutBounds);
            }
        }
        if self.commit_delay_ms > MAX_COMMIT_DELAY_MS {
            return Err(ConsensusError::TimeoutBounds);
        }
        Ok(())
    }
}

/// Versioned consensus parameters hashed into the block header.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConsensusParams {
    pub version: u32,
    pub max_block_bytes: u32,
    pub max_transactions: u32,
    pub timeouts: TimeoutConfig,
    pub evidence_max_age: u64,
    pub max_round: u32,
}

impl ConsensusParams {
    pub fn development() -> Self {
        Self {
            version: 1,
            max_block_bytes: 65_536,
            max_transactions: 32,
            timeouts: TimeoutConfig::development(),
            evidence_max_age: 10_000,
            max_round: 1_024,
        }
    }

    pub fn validate(&self) -> Result<(), ConsensusError> {
        if self.version != 1 {
            return Err(ConsensusError::WrongProtocolVersion);
        }
        if self.max_block_bytes == 0 || self.max_block_bytes > MAX_BLOCK_BYTES {
            return Err(ConsensusError::BlockLimit);
        }
        if self.max_transactions == 0 || self.max_transactions > MAX_TRANSACTIONS {
            return Err(ConsensusError::BlockLimit);
        }
        if self.evidence_max_age == 0 || self.evidence_max_age > MAX_EVIDENCE_AGE {
            return Err(ConsensusError::BlockLimit);
        }
        if self.max_round == 0 {
            return Err(ConsensusError::InvalidRound);
        }
        self.timeouts.validate()
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, "ConsensusParamsV1");
        encode_u32(&mut out, self.version);
        encode_u32(&mut out, self.max_block_bytes);
        encode_u32(&mut out, self.max_transactions);
        encode_u64(&mut out, self.timeouts.propose_timeout_ms);
        encode_u64(&mut out, self.timeouts.prevote_timeout_ms);
        encode_u64(&mut out, self.timeouts.precommit_timeout_ms);
        encode_u64(&mut out, self.timeouts.commit_delay_ms);
        encode_u64(&mut out, self.evidence_max_age);
        encode_u32(&mut out, self.max_round);
        out
    }

    pub fn hash(&self, hasher: &dyn DomainHasher) -> Hash32 {
        hasher.hash(DOMAIN_CONSENSUS_PARAMS, &self.encode())
    }
}
