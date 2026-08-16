use std::collections::BTreeMap;

use crate::codec::{Reader, Writer};
use crate::crypto::{sha256, verify, KeyDomain, CRYPTO_SUITE_ID};
use crate::error::{NodeError, NodeResult};

use super::signer::{ConsensusSigner, SignKind};
use super::types::{
    read_optional_block_id, write_optional_block_id, BlockId, Height, RejectReason, Round,
    VoteType, CONSENSUS_SCHEMA,
};
use super::validators::{ValidatorId, ValidatorSet};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignedVote {
    pub network_id: String,
    pub chain_id: String,
    pub height: Height,
    pub round: Round,
    pub vote_type: VoteType,
    pub block_id: Option<BlockId>,
    pub validator_id: ValidatorId,
    pub consensus_public_key: [u8; 32],
    pub crypto_suite: String,
    pub signature: [u8; 64],
}

impl SignedVote {
    pub fn unsigned_bytes(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.bytes(self.vote_type.domain())?;
        w.string(&self.network_id)?;
        w.string(&self.chain_id)?;
        w.u64(self.height);
        w.u32(self.round);
        w.u8(self.vote_type.as_u8());
        write_optional_block_id(&mut w, self.block_id);
        w.bytes32(&self.validator_id.0);
        w.bytes32(&self.consensus_public_key);
        w.string(&self.crypto_suite)?;
        Ok(w.finish())
    }

    pub fn signed_hash(&self) -> [u8; 32] {
        sha256(&self.encode().unwrap_or_default())
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(1);
        w.u16(CONSENSUS_SCHEMA);
        w.string(&self.network_id)?;
        w.string(&self.chain_id)?;
        w.u64(self.height);
        w.u32(self.round);
        w.u8(self.vote_type.as_u8());
        write_optional_block_id(&mut w, self.block_id);
        w.bytes32(&self.validator_id.0);
        w.bytes32(&self.consensus_public_key);
        w.string(&self.crypto_suite)?;
        w.bytes64(&self.signature);
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        if r.u8()? != 1 {
            return Err(NodeError::Codec("unknown vote schema".into()));
        }
        if r.u16()? != CONSENSUS_SCHEMA {
            return Err(NodeError::Codec("unsupported vote schema version".into()));
        }
        let vote = Self {
            network_id: r.string()?,
            chain_id: r.string()?,
            height: r.u64()?,
            round: r.u32()?,
            vote_type: VoteType::from_u8(r.u8()?)?,
            block_id: read_optional_block_id(&mut r)?,
            validator_id: ValidatorId(r.bytes32()?),
            consensus_public_key: r.bytes32()?,
            crypto_suite: r.string()?,
            signature: r.bytes64()?,
        };
        r.finish()?;
        Ok(vote)
    }

    pub fn sign(
        signer: &mut ConsensusSigner,
        network_id: &str,
        chain_id: &str,
        height: Height,
        round: Round,
        vote_type: VoteType,
        block_id: Option<BlockId>,
    ) -> NodeResult<Self> {
        signer.authorize(height, round, SignKind::from_vote(vote_type), block_id)?;
        let mut vote = Self {
            network_id: network_id.into(),
            chain_id: chain_id.into(),
            height,
            round,
            vote_type,
            block_id,
            validator_id: signer.validator_id,
            consensus_public_key: signer.public_key(),
            crypto_suite: CRYPTO_SUITE_ID.into(),
            signature: [0u8; 64],
        };
        let unsigned = vote.unsigned_bytes()?;
        vote.signature = signer.sign(&unsigned);
        Ok(vote)
    }

    pub fn verify(&self, set: &ValidatorSet) -> Result<(), RejectReason> {
        if self.crypto_suite != CRYPTO_SUITE_ID {
            return Err(if self.crypto_suite.is_empty() {
                RejectReason::UnknownCryptoSuite
            } else {
                RejectReason::WrongCryptoSuite
            });
        }
        let Some(validator) = set.get(self.validator_id) else {
            return Err(RejectReason::NotInValidatorSet);
        };
        if validator.consensus_public_key != self.consensus_public_key {
            return Err(RejectReason::P2pCannotForgeConsensus);
        }
        if ValidatorId::from_consensus_key(&self.consensus_public_key) != self.validator_id {
            return Err(RejectReason::P2pCannotForgeConsensus);
        }
        let unsigned = self
            .unsigned_bytes()
            .map_err(|_| RejectReason::InvalidSignature)?;
        verify(
            KeyDomain::ValidatorConsensus,
            &self.consensus_public_key,
            &unsigned,
            &self.signature,
        )
        .map_err(|_| RejectReason::InvalidSignature)
    }
}

#[derive(Debug, Clone)]
pub struct VoteSet {
    pub height: Height,
    pub round: Round,
    pub vote_type: VoteType,
    votes: BTreeMap<ValidatorId, SignedVote>,
}

impl VoteSet {
    pub fn new(height: Height, round: Round, vote_type: VoteType) -> Self {
        Self {
            height,
            round,
            vote_type,
            votes: BTreeMap::new(),
        }
    }

    pub fn insert(
        &mut self,
        vote: SignedVote,
        set: &ValidatorSet,
    ) -> Result<VoteInsert, RejectReason> {
        if vote.height != self.height
            || vote.round != self.round
            || vote.vote_type != self.vote_type
        {
            return Err(RejectReason::WrongRound);
        }
        vote.verify(set)?;
        if let Some(existing) = self.votes.get(&vote.validator_id) {
            if existing.block_id == vote.block_id {
                return Ok(VoteInsert::Duplicate);
            }
            return Err(RejectReason::ConflictingVote);
        }
        self.votes.insert(vote.validator_id, vote);
        Ok(VoteInsert::Accepted)
    }

    pub fn power_for(&self, set: &ValidatorSet, block_id: Option<BlockId>) -> u64 {
        self.votes
            .values()
            .filter(|vote| vote.block_id == block_id)
            .filter_map(|vote| set.get(vote.validator_id).map(|v| v.voting_power))
            .sum()
    }

    pub fn total_power(&self, set: &ValidatorSet) -> u64 {
        self.votes
            .values()
            .filter_map(|vote| set.get(vote.validator_id).map(|v| v.voting_power))
            .sum()
    }

    pub fn quorum_block(&self, set: &ValidatorSet) -> Option<BlockId> {
        let mut by_block: BTreeMap<BlockId, u64> = BTreeMap::new();
        for vote in self.votes.values() {
            if let Some(id) = vote.block_id {
                if let Some(validator) = set.get(vote.validator_id) {
                    *by_block.entry(id).or_default() += validator.voting_power;
                }
            }
        }
        by_block
            .into_iter()
            .find(|(_, power)| set.has_quorum(*power))
            .map(|(id, _)| id)
    }

    pub fn has_any_quorum(&self, set: &ValidatorSet) -> bool {
        set.has_quorum(self.total_power(set))
    }

    pub fn votes(&self) -> impl Iterator<Item = &SignedVote> {
        self.votes.values()
    }

    pub fn get(&self, id: ValidatorId) -> Option<&SignedVote> {
        self.votes.get(&id)
    }

    pub fn len(&self) -> usize {
        self.votes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.votes.is_empty()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VoteInsert {
    Accepted,
    Duplicate,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommitCertificate {
    pub network_id: String,
    pub chain_id: String,
    pub height: Height,
    pub round: Round,
    pub block_id: BlockId,
    pub state_root: [u8; 32],
    pub validator_set_hash: [u8; 32],
    pub votes: Vec<SignedVote>,
}

impl CommitCertificate {
    #[allow(clippy::too_many_arguments)]
    pub fn from_votes(
        network_id: String,
        chain_id: String,
        height: Height,
        round: Round,
        block_id: BlockId,
        state_root: [u8; 32],
        set: &ValidatorSet,
        votes: Vec<SignedVote>,
    ) -> Result<Self, RejectReason> {
        let mut votes = votes;
        votes.sort_by_key(|a| a.validator_id.0);
        let cert = Self {
            network_id,
            chain_id,
            height,
            round,
            block_id,
            state_root,
            validator_set_hash: set.hash(),
            votes,
        };
        cert.verify(set)?;
        Ok(cert)
    }

    pub fn verify(&self, set: &ValidatorSet) -> Result<(), RejectReason> {
        if self.validator_set_hash != set.hash() {
            return Err(RejectReason::OldValidatorSet);
        }
        if self.votes.is_empty() {
            return Err(RejectReason::MalformedCertificate);
        }
        let mut seen = BTreeMap::new();
        let mut power = 0u64;
        for vote in &self.votes {
            if vote.vote_type != VoteType::Precommit
                || vote.height != self.height
                || vote.round != self.round
                || vote.block_id != Some(self.block_id)
                || vote.network_id != self.network_id
                || vote.chain_id != self.chain_id
            {
                return Err(RejectReason::MalformedCertificate);
            }
            vote.verify(set)?;
            if seen.insert(vote.validator_id, true).is_some() {
                return Err(RejectReason::DuplicateVotingPower);
            }
            power += set
                .get(vote.validator_id)
                .map(|v| v.voting_power)
                .unwrap_or(0);
        }
        if !set.has_quorum(power) {
            return Err(RejectReason::MalformedCertificate);
        }
        Ok(())
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(1);
        w.u16(CONSENSUS_SCHEMA);
        w.string(&self.network_id)?;
        w.string(&self.chain_id)?;
        w.u64(self.height);
        w.u32(self.round);
        w.bytes32(&self.block_id);
        w.bytes32(&self.state_root);
        w.bytes32(&self.validator_set_hash);
        let mut votes = self.votes.clone();
        votes.sort_by_key(|a| a.validator_id.0);
        w.u32(votes.len() as u32);
        for vote in &votes {
            w.bytes(&vote.encode()?)?;
        }
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        if r.u8()? != 1 {
            return Err(NodeError::Codec("unknown commit schema".into()));
        }
        if r.u16()? != CONSENSUS_SCHEMA {
            return Err(NodeError::Codec("unsupported commit schema".into()));
        }
        let cert = Self {
            network_id: r.string()?,
            chain_id: r.string()?,
            height: r.u64()?,
            round: r.u32()?,
            block_id: r.bytes32()?,
            state_root: r.bytes32()?,
            validator_set_hash: r.bytes32()?,
            votes: {
                let count = r.u32()? as usize;
                if count > 64 {
                    return Err(NodeError::Codec("excessive commit votes".into()));
                }
                let mut votes = Vec::with_capacity(count);
                for _ in 0..count {
                    votes.push(SignedVote::decode(&r.bytes()?)?);
                }
                votes
            },
        };
        r.finish()?;
        Ok(cert)
    }
}
