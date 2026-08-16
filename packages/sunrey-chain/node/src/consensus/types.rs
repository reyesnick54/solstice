//! Tendermint-family consensus types. Integer voting power only.

use std::time::Duration;

use crate::codec::{Reader, Writer};
use crate::crypto::sha256;
use crate::error::{NodeError, NodeResult};

pub const CONSENSUS_SCHEMA: u16 = 1;
pub const CONSENSUS_DOMAIN_PROPOSAL: &[u8] = b"SUNREY-CONSENSUS-PROPOSAL-V1";
pub const CONSENSUS_DOMAIN_PREVOTE: &[u8] = b"SUNREY-CONSENSUS-PREVOTE-V1";
pub const CONSENSUS_DOMAIN_PRECOMMIT: &[u8] = b"SUNREY-CONSENSUS-PRECOMMIT-V1";
pub const CONSENSUS_DOMAIN_COMMIT: &[u8] = b"SUNREY-CONSENSUS-COMMIT-V1";

pub type Height = u64;
pub type Round = u32;
pub type BlockId = [u8; 32];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Step {
    NewHeight,
    Propose,
    Prevote,
    Precommit,
    Commit,
}

impl Step {
    pub fn as_u8(self) -> u8 {
        match self {
            Self::NewHeight => 0,
            Self::Propose => 1,
            Self::Prevote => 2,
            Self::Precommit => 3,
            Self::Commit => 4,
        }
    }

    pub fn from_u8(value: u8) -> NodeResult<Self> {
        match value {
            0 => Ok(Self::NewHeight),
            1 => Ok(Self::Propose),
            2 => Ok(Self::Prevote),
            3 => Ok(Self::Precommit),
            4 => Ok(Self::Commit),
            _ => Err(NodeError::Codec(format!("unknown consensus step {value}"))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum VoteType {
    Prevote,
    Precommit,
}

impl VoteType {
    pub fn as_u8(self) -> u8 {
        match self {
            Self::Prevote => 1,
            Self::Precommit => 2,
        }
    }

    pub fn from_u8(value: u8) -> NodeResult<Self> {
        match value {
            1 => Ok(Self::Prevote),
            2 => Ok(Self::Precommit),
            _ => Err(NodeError::Codec(format!("unknown vote type {value}"))),
        }
    }

    pub fn domain(self) -> &'static [u8] {
        match self {
            Self::Prevote => CONSENSUS_DOMAIN_PREVOTE,
            Self::Precommit => CONSENSUS_DOMAIN_PRECOMMIT,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TimeoutKind {
    Propose,
    Prevote,
    Precommit,
}

impl TimeoutKind {
    pub fn as_u8(self) -> u8 {
        match self {
            Self::Propose => 1,
            Self::Prevote => 2,
            Self::Precommit => 3,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConsensusParams {
    pub timeout_propose_ms: u64,
    pub timeout_prevote_ms: u64,
    pub timeout_precommit_ms: u64,
    pub timeout_delta_ms: u64,
    pub max_future_height: u64,
    pub max_future_round: u32,
    pub max_buffered_messages: usize,
    pub max_block_bytes: usize,
    pub max_evidence_per_peer: usize,
}

impl Default for ConsensusParams {
    fn default() -> Self {
        Self {
            timeout_propose_ms: 80,
            timeout_prevote_ms: 80,
            timeout_precommit_ms: 80,
            timeout_delta_ms: 20,
            max_future_height: 2,
            max_future_round: 8,
            max_buffered_messages: 256,
            max_block_bytes: crate::chain::MAX_BLOCK_BYTES,
            max_evidence_per_peer: 16,
        }
    }
}

impl ConsensusParams {
    pub fn fast_dev() -> Self {
        Self {
            timeout_propose_ms: 25,
            timeout_prevote_ms: 25,
            timeout_precommit_ms: 25,
            timeout_delta_ms: 8,
            ..Self::default()
        }
    }

    pub fn four_validator_p2p() -> Self {
        Self {
            timeout_propose_ms: 200,
            timeout_prevote_ms: 200,
            timeout_precommit_ms: 200,
            timeout_delta_ms: 50,
            ..Self::default()
        }
    }

    pub fn timeout(&self, kind: TimeoutKind, round: Round) -> Duration {
        let base = match kind {
            TimeoutKind::Propose => self.timeout_propose_ms,
            TimeoutKind::Prevote => self.timeout_prevote_ms,
            TimeoutKind::Precommit => self.timeout_precommit_ms,
        };
        Duration::from_millis(
            base.saturating_add(u64::from(round).saturating_mul(self.timeout_delta_ms)),
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ValueLock {
    pub round: Round,
    pub block_id: BlockId,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RejectReason {
    WrongNetwork,
    WrongChain,
    WrongCryptoSuite,
    UnknownCryptoSuite,
    NotInValidatorSet,
    FutureValidatorKey,
    OldValidatorSet,
    WrongHeight,
    WrongRound,
    IncorrectProposer,
    DuplicateProposal,
    ConflictingProposal,
    ConflictingVote,
    InvalidSignature,
    PeerNotAuthenticated,
    P2pCannotForgeConsensus,
    MalformedCertificate,
    DuplicateVotingPower,
    FutureHeightSpam,
    FutureRoundSpam,
    OversizedBlock,
    StaleRound,
    UnreasonableFuture,
}

impl RejectReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::WrongNetwork => "wrong_network",
            Self::WrongChain => "wrong_chain",
            Self::WrongCryptoSuite => "wrong_crypto_suite",
            Self::UnknownCryptoSuite => "unknown_crypto_suite",
            Self::NotInValidatorSet => "not_in_validator_set",
            Self::FutureValidatorKey => "future_validator_key",
            Self::OldValidatorSet => "old_validator_set",
            Self::WrongHeight => "wrong_height",
            Self::WrongRound => "wrong_round",
            Self::IncorrectProposer => "incorrect_proposer",
            Self::DuplicateProposal => "duplicate_proposal",
            Self::ConflictingProposal => "conflicting_proposal",
            Self::ConflictingVote => "conflicting_vote",
            Self::InvalidSignature => "invalid_signature",
            Self::PeerNotAuthenticated => "peer_not_authenticated",
            Self::P2pCannotForgeConsensus => "p2p_cannot_forge_consensus",
            Self::MalformedCertificate => "malformed_commit_certificate",
            Self::DuplicateVotingPower => "duplicate_voting_power",
            Self::FutureHeightSpam => "future_height_spam",
            Self::FutureRoundSpam => "future_round_spam",
            Self::OversizedBlock => "oversized_block",
            Self::StaleRound => "stale_round",
            Self::UnreasonableFuture => "unreasonable_future",
        }
    }
}

pub fn hash_bytes(parts: &[&[u8]]) -> [u8; 32] {
    let mut w = Writer::new();
    w.u32(parts.len() as u32);
    for part in parts {
        w.bytes(part).expect("hash part");
    }
    sha256(&w.finish())
}

pub fn read_optional_block_id(r: &mut Reader<'_>) -> NodeResult<Option<BlockId>> {
    match r.u8()? {
        0 => Ok(None),
        1 => Ok(Some(r.bytes32()?)),
        _ => Err(NodeError::Codec("invalid optional block id".into())),
    }
}

pub fn write_optional_block_id(w: &mut Writer, id: Option<BlockId>) {
    match id {
        None => w.u8(0),
        Some(id) => {
            w.u8(1);
            w.bytes32(&id);
        }
    }
}
