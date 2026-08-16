use crate::codec::{Reader, Writer};
use crate::error::{NodeError, NodeResult};

use super::proposal::SignedProposal;
use super::types::{Height, Round, CONSENSUS_SCHEMA};
use super::validators::ValidatorId;
use super::vote::SignedVote;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EvidenceKind {
    DoubleProposal,
    DoublePrevote,
    DoublePrecommit,
}

impl EvidenceKind {
    pub fn as_u8(self) -> u8 {
        match self {
            Self::DoubleProposal => 1,
            Self::DoublePrevote => 2,
            Self::DoublePrecommit => 3,
        }
    }

    pub fn from_u8(value: u8) -> NodeResult<Self> {
        match value {
            1 => Ok(Self::DoubleProposal),
            2 => Ok(Self::DoublePrevote),
            3 => Ok(Self::DoublePrecommit),
            _ => Err(NodeError::Codec("unknown evidence kind".into())),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EquivocationEvidence {
    Proposal {
        height: Height,
        round: Round,
        validator_id: ValidatorId,
        first: SignedProposal,
        second: SignedProposal,
    },
    Vote {
        kind: EvidenceKind,
        first: SignedVote,
        second: SignedVote,
    },
}

impl EquivocationEvidence {
    pub fn kind(&self) -> EvidenceKind {
        match self {
            Self::Proposal { .. } => EvidenceKind::DoubleProposal,
            Self::Vote { kind, .. } => *kind,
        }
    }

    pub fn validator_id(&self) -> ValidatorId {
        match self {
            Self::Proposal { validator_id, .. } => *validator_id,
            Self::Vote { first, .. } => first.validator_id,
        }
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(1);
        w.u16(CONSENSUS_SCHEMA);
        w.u8(self.kind().as_u8());
        match self {
            Self::Proposal {
                height,
                round,
                validator_id,
                first,
                second,
            } => {
                w.u64(*height);
                w.u32(*round);
                w.bytes32(&validator_id.0);
                w.bytes(&first.encode()?)?;
                w.bytes(&second.encode()?)?;
            }
            Self::Vote { first, second, .. } => {
                w.bytes(&first.encode()?)?;
                w.bytes(&second.encode()?)?;
            }
        }
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        if r.u8()? != 1 {
            return Err(NodeError::Codec("unknown evidence schema".into()));
        }
        if r.u16()? != CONSENSUS_SCHEMA {
            return Err(NodeError::Codec("unsupported evidence schema".into()));
        }
        let kind = EvidenceKind::from_u8(r.u8()?)?;
        let evidence = match kind {
            EvidenceKind::DoubleProposal => Self::Proposal {
                height: r.u64()?,
                round: r.u32()?,
                validator_id: ValidatorId(r.bytes32()?),
                first: SignedProposal::decode(&r.bytes()?)?,
                second: SignedProposal::decode(&r.bytes()?)?,
            },
            EvidenceKind::DoublePrevote | EvidenceKind::DoublePrecommit => Self::Vote {
                kind,
                first: SignedVote::decode(&r.bytes()?)?,
                second: SignedVote::decode(&r.bytes()?)?,
            },
        };
        r.finish()?;
        Ok(evidence)
    }
}
