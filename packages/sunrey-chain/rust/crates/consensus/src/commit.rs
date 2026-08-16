use serde::{Deserialize, Serialize};
use sunrey_crypto::CryptoSuite;
use sunrey_protocol::{
    decode_bytes, decode_string, decode_u32, decode_u64, encode_bytes, encode_string, encode_u32,
    encode_u64,
};

use crate::error::ConsensusError;
use crate::message::{verify_domain_message, Vote, DOMAIN_COMMIT, DOMAIN_PRECOMMIT};
use crate::quorum::exceeds_two_thirds;
use crate::types::{BlockId, Height, Round};
use crate::valset::ValidatorSet;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Commit {
    pub height: Height,
    pub round: Round,
    pub block_id: BlockId,
    pub votes: Vec<Vote>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommitCertificate {
    pub height: Height,
    pub round: Round,
    pub block_id: BlockId,
    pub validator_set_version: u64,
    pub votes: Vec<Vote>,
    pub certificate_hash: [u8; 32],
}

impl CommitCertificate {
    pub fn from_votes<S: CryptoSuite>(
        suite: &S,
        set: &ValidatorSet,
        height: Height,
        round: Round,
        block_id: BlockId,
        votes: Vec<Vote>,
    ) -> Result<Self, ConsensusError> {
        if block_id.is_nil() {
            return Err(ConsensusError::NilCommit);
        }
        let mut cert = Self {
            height,
            round,
            block_id,
            validator_set_version: set.version,
            votes,
            certificate_hash: [0u8; 32],
        };
        cert.verify(suite, set)?;
        cert.certificate_hash = suite.hash(DOMAIN_COMMIT, &cert.encode_unsigned());
        Ok(cert)
    }

    pub fn encode_unsigned(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, "CommitCertificateV1");
        encode_u64(&mut out, self.height.get());
        encode_u32(&mut out, self.round.get());
        encode_bytes(&mut out, &self.block_id.0);
        encode_u64(&mut out, self.validator_set_version);
        encode_u32(&mut out, self.votes.len() as u32);
        for vote in &self.votes {
            encode_bytes(&mut out, &vote.encode());
        }
        out
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = self.encode_unsigned();
        encode_bytes(&mut out, &self.certificate_hash);
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, ConsensusError> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| ConsensusError::Decode)?;
        if tag != "CommitCertificateV1" {
            return Err(ConsensusError::Decode);
        }
        let height = Height::new(decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?);
        let round = Round::new(decode_u32(&mut input).map_err(|_| ConsensusError::Decode)?);
        let block_id = BlockId(decode_hash32(&mut input)?);
        let validator_set_version = decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?;
        let count = decode_u32(&mut input).map_err(|_| ConsensusError::Decode)? as usize;
        let mut votes = Vec::with_capacity(count);
        for _ in 0..count {
            let encoded = decode_bytes(&mut input).map_err(|_| ConsensusError::Decode)?;
            votes.push(Vote::decode(&encoded)?);
        }
        let certificate_hash = decode_hash32(&mut input)?;
        if !input.is_empty() {
            return Err(ConsensusError::Decode);
        }
        Ok(Self { height, round, block_id, validator_set_version, votes, certificate_hash })
    }

    pub fn verify<S: CryptoSuite>(
        &self,
        suite: &S,
        set: &ValidatorSet,
    ) -> Result<(), ConsensusError> {
        if self.block_id.is_nil() {
            return Err(ConsensusError::NilCommit);
        }
        if self.validator_set_version != set.version {
            return Err(ConsensusError::InvalidCertificate("validator-set version"));
        }
        let mut seen = std::collections::BTreeSet::new();
        let mut power = 0u64;
        for vote in &self.votes {
            if vote.vote_type != crate::types::VoteType::Precommit {
                return Err(ConsensusError::InvalidCertificate("not a precommit"));
            }
            if vote.height != self.height
                || vote.round != self.round
                || vote.block_id != self.block_id
            {
                return Err(ConsensusError::InvalidCertificate("vote does not match commit"));
            }
            if !seen.insert(vote.validator_id.as_str()) {
                return Err(ConsensusError::InvalidCertificate("duplicate voter"));
            }
            let validator = set
                .get(&vote.validator_id)
                .ok_or(ConsensusError::InvalidCertificate("unknown voter"))?;
            verify_domain_message(
                suite,
                &validator.public_key,
                DOMAIN_PRECOMMIT,
                &vote.encode_unsigned(),
                &vote.signature,
            )?;
            power = power.checked_add(validator.voting_power).ok_or(ConsensusError::Overflow)?;
        }
        if !exceeds_two_thirds(power, set.total_active_power()?)? {
            return Err(ConsensusError::QuorumNotReached);
        }
        Ok(())
    }
}

fn decode_hash32(input: &mut &[u8]) -> Result<[u8; 32], ConsensusError> {
    let bytes = decode_bytes(input).map_err(|_| ConsensusError::Decode)?;
    bytes.try_into().map_err(|_| ConsensusError::Decode)
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FinalizedBlock {
    pub height: Height,
    pub round: Round,
    pub block_id: BlockId,
    pub value: crate::message::ProposedValue,
    pub certificate: CommitCertificate,
    pub app_hash: [u8; 32],
}
