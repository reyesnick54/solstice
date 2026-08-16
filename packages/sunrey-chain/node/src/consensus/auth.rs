//! Consensus message authentication. P2P identity cannot vote.

use crate::crypto::CRYPTO_SUITE_ID;
use crate::identity::NodeId;

use super::messages::ConsensusMessage;
use super::types::RejectReason;
use super::validators::ValidatorSet;

#[derive(Debug, Clone)]
pub struct ConsensusAuthContext<'a> {
    pub network_id: &'a str,
    pub chain_id: &'a str,
    pub genesis_hash: [u8; 32],
    pub validator_set: &'a ValidatorSet,
    pub peer_id: Option<NodeId>,
    pub peer_is_validator: bool,
}

pub fn authenticate(
    ctx: &ConsensusAuthContext<'_>,
    message: &ConsensusMessage,
) -> Result<(), RejectReason> {
    if ctx.peer_id.is_none() {
        return Err(RejectReason::PeerNotAuthenticated);
    }
    match message {
        ConsensusMessage::ProposalAnnouncement { proposal, .. }
        | ConsensusMessage::ProposalResponse { proposal, .. } => {
            check_ids(
                ctx,
                &proposal.network_id,
                &proposal.chain_id,
                &proposal.crypto_suite,
            )?;
            proposal.verify(ctx.validator_set)
        }
        ConsensusMessage::Prevote(vote) | ConsensusMessage::Precommit(vote) => {
            check_ids(ctx, &vote.network_id, &vote.chain_id, &vote.crypto_suite)?;
            vote.verify(ctx.validator_set)?;
            // Relays may forward votes. Only the signed validator identity counts.
            Ok(())
        }
        ConsensusMessage::CommitAnnouncement(cert)
        | ConsensusMessage::CommitResponse {
            certificate: cert, ..
        } => {
            check_ids(ctx, &cert.network_id, &cert.chain_id, CRYPTO_SUITE_ID)?;
            cert.verify(ctx.validator_set)
        }
        ConsensusMessage::ProposalRequest { .. }
        | ConsensusMessage::CommitRequest { .. }
        | ConsensusMessage::RoundStateHint { .. }
        | ConsensusMessage::EvidenceAnnouncement(_) => Ok(()),
    }
}

fn check_ids(
    ctx: &ConsensusAuthContext<'_>,
    network_id: &str,
    chain_id: &str,
    crypto_suite: &str,
) -> Result<(), RejectReason> {
    if network_id != ctx.network_id {
        return Err(RejectReason::WrongNetwork);
    }
    if chain_id != ctx.chain_id {
        return Err(RejectReason::WrongChain);
    }
    if crypto_suite != CRYPTO_SUITE_ID {
        return Err(RejectReason::UnknownCryptoSuite);
    }
    let _ = ctx.genesis_hash;
    let _ = ctx.peer_is_validator;
    Ok(())
}
