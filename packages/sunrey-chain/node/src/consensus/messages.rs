//! Canonical binary consensus gossip messages. JSON is not a consensus encoding.

use crate::chain::Block;
use crate::codec::{Reader, Writer};
use crate::error::{NodeError, NodeResult};

use super::evidence::EquivocationEvidence;
use super::proposal::SignedProposal;
use super::types::{BlockId, Height, Round, Step, CONSENSUS_SCHEMA};
use super::vote::{CommitCertificate, SignedVote};

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConsensusMessageType {
    ProposalAnnouncement = 40,
    ProposalRequest = 41,
    ProposalResponse = 42,
    PrevoteMessage = 43,
    PrecommitMessage = 44,
    CommitAnnouncement = 45,
    CommitRequest = 46,
    CommitResponse = 47,
    RoundStateHint = 48,
    EvidenceAnnouncement = 49,
}

impl ConsensusMessageType {
    pub fn from_u8(value: u8) -> NodeResult<Self> {
        match value {
            40 => Ok(Self::ProposalAnnouncement),
            41 => Ok(Self::ProposalRequest),
            42 => Ok(Self::ProposalResponse),
            43 => Ok(Self::PrevoteMessage),
            44 => Ok(Self::PrecommitMessage),
            45 => Ok(Self::CommitAnnouncement),
            46 => Ok(Self::CommitRequest),
            47 => Ok(Self::CommitResponse),
            48 => Ok(Self::RoundStateHint),
            49 => Ok(Self::EvidenceAnnouncement),
            _ => Err(NodeError::Codec(format!(
                "unknown consensus message type {value}"
            ))),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConsensusMessage {
    ProposalAnnouncement {
        height: Height,
        round: Round,
        block_id: BlockId,
        proposal: SignedProposal,
    },
    ProposalRequest {
        height: Height,
        round: Round,
        block_id: BlockId,
    },
    ProposalResponse {
        proposal: SignedProposal,
        block: Block,
    },
    Prevote(SignedVote),
    Precommit(SignedVote),
    CommitAnnouncement(CommitCertificate),
    CommitRequest {
        height: Height,
    },
    CommitResponse {
        certificate: CommitCertificate,
        block: Block,
    },
    RoundStateHint {
        height: Height,
        round: Round,
        step: Step,
    },
    EvidenceAnnouncement(EquivocationEvidence),
}

impl ConsensusMessage {
    pub fn ty(&self) -> ConsensusMessageType {
        match self {
            Self::ProposalAnnouncement { .. } => ConsensusMessageType::ProposalAnnouncement,
            Self::ProposalRequest { .. } => ConsensusMessageType::ProposalRequest,
            Self::ProposalResponse { .. } => ConsensusMessageType::ProposalResponse,
            Self::Prevote(_) => ConsensusMessageType::PrevoteMessage,
            Self::Precommit(_) => ConsensusMessageType::PrecommitMessage,
            Self::CommitAnnouncement(_) => ConsensusMessageType::CommitAnnouncement,
            Self::CommitRequest { .. } => ConsensusMessageType::CommitRequest,
            Self::CommitResponse { .. } => ConsensusMessageType::CommitResponse,
            Self::RoundStateHint { .. } => ConsensusMessageType::RoundStateHint,
            Self::EvidenceAnnouncement(_) => ConsensusMessageType::EvidenceAnnouncement,
        }
    }

    pub fn height(&self) -> Option<Height> {
        match self {
            Self::ProposalAnnouncement { height, .. }
            | Self::ProposalRequest { height, .. }
            | Self::CommitRequest { height } => Some(*height),
            Self::ProposalResponse { proposal, .. } => Some(proposal.height),
            Self::Prevote(vote) | Self::Precommit(vote) => Some(vote.height),
            Self::CommitAnnouncement(cert)
            | Self::CommitResponse {
                certificate: cert, ..
            } => Some(cert.height),
            Self::RoundStateHint { height, .. } => Some(*height),
            Self::EvidenceAnnouncement(_) => None,
        }
    }

    pub fn round(&self) -> Option<Round> {
        match self {
            Self::ProposalAnnouncement { round, .. } | Self::ProposalRequest { round, .. } => {
                Some(*round)
            }
            Self::ProposalResponse { proposal, .. } => Some(proposal.round),
            Self::Prevote(vote) | Self::Precommit(vote) => Some(vote.round),
            Self::CommitAnnouncement(cert)
            | Self::CommitResponse {
                certificate: cert, ..
            } => Some(cert.round),
            Self::RoundStateHint { round, .. } => Some(*round),
            Self::CommitRequest { .. } | Self::EvidenceAnnouncement(_) => None,
        }
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(self.ty() as u8);
        w.u16(CONSENSUS_SCHEMA);
        match self {
            Self::ProposalAnnouncement {
                height,
                round,
                block_id,
                proposal,
            } => {
                w.u64(*height);
                w.u32(*round);
                w.bytes32(block_id);
                w.bytes(&proposal.encode()?)?;
            }
            Self::ProposalRequest {
                height,
                round,
                block_id,
            } => {
                w.u64(*height);
                w.u32(*round);
                w.bytes32(block_id);
            }
            Self::ProposalResponse { proposal, block } => {
                w.bytes(&proposal.encode()?)?;
                w.bytes(&block.encode()?)?;
            }
            Self::Prevote(vote) | Self::Precommit(vote) => w.bytes(&vote.encode()?)?,
            Self::CommitAnnouncement(cert) => w.bytes(&cert.encode()?)?,
            Self::CommitRequest { height } => w.u64(*height),
            Self::CommitResponse { certificate, block } => {
                w.bytes(&certificate.encode()?)?;
                w.bytes(&block.encode()?)?;
            }
            Self::RoundStateHint {
                height,
                round,
                step,
            } => {
                w.u64(*height);
                w.u32(*round);
                w.u8(step.as_u8());
            }
            Self::EvidenceAnnouncement(evidence) => w.bytes(&evidence.encode()?)?,
        }
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        let ty = ConsensusMessageType::from_u8(r.u8()?)?;
        if r.u16()? != CONSENSUS_SCHEMA {
            return Err(NodeError::Codec("unsupported consensus schema".into()));
        }
        let msg = match ty {
            ConsensusMessageType::ProposalAnnouncement => Self::ProposalAnnouncement {
                height: r.u64()?,
                round: r.u32()?,
                block_id: r.bytes32()?,
                proposal: SignedProposal::decode(&r.bytes()?)?,
            },
            ConsensusMessageType::ProposalRequest => Self::ProposalRequest {
                height: r.u64()?,
                round: r.u32()?,
                block_id: r.bytes32()?,
            },
            ConsensusMessageType::ProposalResponse => Self::ProposalResponse {
                proposal: SignedProposal::decode(&r.bytes()?)?,
                block: Block::decode(&r.bytes()?)?,
            },
            ConsensusMessageType::PrevoteMessage => Self::Prevote(SignedVote::decode(&r.bytes()?)?),
            ConsensusMessageType::PrecommitMessage => {
                Self::Precommit(SignedVote::decode(&r.bytes()?)?)
            }
            ConsensusMessageType::CommitAnnouncement => {
                Self::CommitAnnouncement(CommitCertificate::decode(&r.bytes()?)?)
            }
            ConsensusMessageType::CommitRequest => Self::CommitRequest { height: r.u64()? },
            ConsensusMessageType::CommitResponse => Self::CommitResponse {
                certificate: CommitCertificate::decode(&r.bytes()?)?,
                block: Block::decode(&r.bytes()?)?,
            },
            ConsensusMessageType::RoundStateHint => Self::RoundStateHint {
                height: r.u64()?,
                round: r.u32()?,
                step: Step::from_u8(r.u8()?)?,
            },
            ConsensusMessageType::EvidenceAnnouncement => {
                Self::EvidenceAnnouncement(EquivocationEvidence::decode(&r.bytes()?)?)
            }
        };
        r.finish()?;
        Ok(msg)
    }
}
