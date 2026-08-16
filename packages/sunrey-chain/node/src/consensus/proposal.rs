use crate::chain::Block;
use crate::codec::{Reader, Writer};
use crate::crypto::{verify, KeyDomain, CRYPTO_SUITE_ID};
use crate::error::{NodeError, NodeResult};

use super::signer::{ConsensusSigner, SignKind};
use super::types::{
    BlockId, Height, RejectReason, Round, CONSENSUS_DOMAIN_PROPOSAL, CONSENSUS_SCHEMA,
};
use super::validators::{ValidatorId, ValidatorSet};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignedProposal {
    pub network_id: String,
    pub chain_id: String,
    pub height: Height,
    pub round: Round,
    pub block_id: BlockId,
    pub polka_round: Option<Round>,
    pub validator_id: ValidatorId,
    pub consensus_public_key: [u8; 32],
    pub crypto_suite: String,
    pub signature: [u8; 64],
}

impl SignedProposal {
    pub fn unsigned_bytes(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.bytes(CONSENSUS_DOMAIN_PROPOSAL)?;
        w.string(&self.network_id)?;
        w.string(&self.chain_id)?;
        w.u64(self.height);
        w.u32(self.round);
        w.bytes32(&self.block_id);
        match self.polka_round {
            None => w.u8(0),
            Some(round) => {
                w.u8(1);
                w.u32(round);
            }
        }
        w.bytes32(&self.validator_id.0);
        w.bytes32(&self.consensus_public_key);
        w.string(&self.crypto_suite)?;
        Ok(w.finish())
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
        match self.polka_round {
            None => w.u8(0),
            Some(round) => {
                w.u8(1);
                w.u32(round);
            }
        }
        w.bytes32(&self.validator_id.0);
        w.bytes32(&self.consensus_public_key);
        w.string(&self.crypto_suite)?;
        w.bytes64(&self.signature);
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        if r.u8()? != 1 {
            return Err(NodeError::Codec("unknown proposal schema".into()));
        }
        if r.u16()? != CONSENSUS_SCHEMA {
            return Err(NodeError::Codec("unsupported proposal schema".into()));
        }
        let proposal = Self {
            network_id: r.string()?,
            chain_id: r.string()?,
            height: r.u64()?,
            round: r.u32()?,
            block_id: r.bytes32()?,
            polka_round: match r.u8()? {
                0 => None,
                1 => Some(r.u32()?),
                _ => return Err(NodeError::Codec("invalid polka round".into())),
            },
            validator_id: ValidatorId(r.bytes32()?),
            consensus_public_key: r.bytes32()?,
            crypto_suite: r.string()?,
            signature: r.bytes64()?,
        };
        r.finish()?;
        Ok(proposal)
    }

    pub fn sign(
        signer: &mut ConsensusSigner,
        network_id: &str,
        chain_id: &str,
        height: Height,
        round: Round,
        block_id: BlockId,
        polka_round: Option<Round>,
    ) -> NodeResult<Self> {
        signer.authorize(height, round, SignKind::Proposal, Some(block_id))?;
        let mut proposal = Self {
            network_id: network_id.into(),
            chain_id: chain_id.into(),
            height,
            round,
            block_id,
            polka_round,
            validator_id: signer.validator_id,
            consensus_public_key: signer.public_key(),
            crypto_suite: CRYPTO_SUITE_ID.into(),
            signature: [0u8; 64],
        };
        let unsigned = proposal.unsigned_bytes()?;
        proposal.signature = signer.sign(&unsigned);
        Ok(proposal)
    }

    pub fn verify(&self, set: &ValidatorSet) -> Result<(), RejectReason> {
        if self.crypto_suite != CRYPTO_SUITE_ID {
            return Err(RejectReason::UnknownCryptoSuite);
        }
        let expected = set
            .proposer(self.height, self.round)
            .ok_or(RejectReason::IncorrectProposer)?;
        if expected.id != self.validator_id {
            return Err(RejectReason::IncorrectProposer);
        }
        if expected.consensus_public_key != self.consensus_public_key {
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProposalBundle {
    pub proposal: SignedProposal,
    pub block: Option<Block>,
}
