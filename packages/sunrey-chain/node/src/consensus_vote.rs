//! Signed consensus messages used as equivocation evidence.
//!
//! These are development Tendermint-family vote/proposal bytes. They are
//! not Execution Authority and cannot post journals.

use crate::codec::{Reader, Writer};
use crate::crypto::{verify, DomainKey, KeyDomain};
use crate::error::{NodeError, NodeResult};

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConsensusMessageType {
    Proposal = 1,
    Prevote = 2,
    Precommit = 3,
}

impl ConsensusMessageType {
    pub fn from_u8(value: u8) -> NodeResult<Self> {
        match value {
            1 => Ok(Self::Proposal),
            2 => Ok(Self::Prevote),
            3 => Ok(Self::Precommit),
            _ => Err(NodeError::Validation(
                "unknown consensus message type".into(),
            )),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Proposal => "PROPOSAL",
            Self::Prevote => "PREVOTE",
            Self::Precommit => "PRECOMMIT",
        }
    }

    pub fn signing_domain(self) -> KeyDomain {
        match self {
            Self::Proposal => KeyDomain::ValidatorProposal,
            Self::Prevote | Self::Precommit => KeyDomain::ValidatorConsensus,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignedConsensusMessage {
    pub network_id: String,
    pub chain_id: String,
    pub validator_id: String,
    pub height: u64,
    pub round: u32,
    pub msg_type: ConsensusMessageType,
    pub block_id: [u8; 32],
    pub validator_set_hash: [u8; 32],
    pub public_key: [u8; 32],
    pub signature: [u8; 64],
}

impl SignedConsensusMessage {
    pub fn unsigned_bytes(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.string(&self.network_id)?;
        w.string(&self.chain_id)?;
        w.string(&self.validator_id)?;
        w.u64(self.height);
        w.u32(self.round);
        w.u8(self.msg_type as u8);
        w.bytes32(&self.block_id);
        w.bytes32(&self.validator_set_hash);
        w.bytes32(&self.public_key);
        Ok(w.finish())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn sign(
        key: &DomainKey,
        network_id: &str,
        chain_id: &str,
        validator_id: &str,
        height: u64,
        round: u32,
        msg_type: ConsensusMessageType,
        block_id: [u8; 32],
        validator_set_hash: [u8; 32],
    ) -> NodeResult<Self> {
        if key.domain != msg_type.signing_domain() {
            return Err(NodeError::Forbidden(
                "consensus message signed with the wrong key domain".into(),
            ));
        }
        let mut message = Self {
            network_id: network_id.into(),
            chain_id: chain_id.into(),
            validator_id: validator_id.into(),
            height,
            round,
            msg_type,
            block_id,
            validator_set_hash,
            public_key: key.public_key(),
            signature: [0u8; 64],
        };
        let unsigned = message.unsigned_bytes()?;
        message.signature = key.sign(&unsigned);
        Ok(message)
    }

    pub fn verify_signature(&self) -> NodeResult<()> {
        verify(
            self.msg_type.signing_domain(),
            &self.public_key,
            &self.unsigned_bytes()?,
            &self.signature,
        )
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(1);
        w.string(&self.network_id)?;
        w.string(&self.chain_id)?;
        w.string(&self.validator_id)?;
        w.u64(self.height);
        w.u32(self.round);
        w.u8(self.msg_type as u8);
        w.bytes32(&self.block_id);
        w.bytes32(&self.validator_set_hash);
        w.bytes32(&self.public_key);
        w.bytes64(&self.signature);
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        if r.u8()? != 1 {
            return Err(NodeError::Codec("unknown consensus message schema".into()));
        }
        let message = Self {
            network_id: r.string()?,
            chain_id: r.string()?,
            validator_id: r.string()?,
            height: r.u64()?,
            round: r.u32()?,
            msg_type: ConsensusMessageType::from_u8(r.u8()?)?,
            block_id: r.bytes32()?,
            validator_set_hash: r.bytes32()?,
            public_key: r.bytes32()?,
            signature: r.bytes64()?,
        };
        r.finish()?;
        Ok(message)
    }

    pub fn content_id(&self) -> [u8; 32] {
        crate::crypto::sha256(&self.unsigned_bytes().unwrap_or_default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn p2p_key_cannot_sign_prevote() {
        let p2p = DomainKey::generate(KeyDomain::P2pNode);
        let err = SignedConsensusMessage::sign(
            &p2p,
            "net",
            "chn",
            "val-a",
            1,
            0,
            ConsensusMessageType::Prevote,
            [1u8; 32],
            [2u8; 32],
        )
        .unwrap_err();
        assert!(err.to_string().contains("wrong key domain"));
    }
}
