//! Equivocation evidence formats, deterministic EvidenceId, and verification.
//!
//! Only cryptographically provable double-sign evidence may trigger
//! automatic deterministic penalties. Missed votes are not fraud.

use crate::codec::{Reader, Writer};
use crate::consensus_vote::{ConsensusMessageType, SignedConsensusMessage};
use crate::crypto::sha256;
use crate::error::{NodeError, NodeResult};
use crate::validators::ValidatorSet;

pub const MAX_EVIDENCE_AGE_HEIGHTS: u64 = 16;
pub const MAX_EVIDENCE_PER_BLOCK: usize = 8;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum EvidenceType {
    DoubleProposal = 1,
    DoublePrevote = 2,
    DoublePrecommit = 3,
    InvalidStateProposal = 10,
    ConsensusLivenessViolation = 11,
}

impl EvidenceType {
    pub fn from_u8(value: u8) -> NodeResult<Self> {
        match value {
            1 => Ok(Self::DoubleProposal),
            2 => Ok(Self::DoublePrevote),
            3 => Ok(Self::DoublePrecommit),
            10 => Ok(Self::InvalidStateProposal),
            11 => Ok(Self::ConsensusLivenessViolation),
            _ => Err(NodeError::Validation("unknown evidence type".into())),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::DoubleProposal => "DOUBLE_PROPOSAL",
            Self::DoublePrevote => "DOUBLE_PREVOTE",
            Self::DoublePrecommit => "DOUBLE_PRECOMMIT",
            Self::InvalidStateProposal => "INVALID_STATE_PROPOSAL",
            Self::ConsensusLivenessViolation => "CONSENSUS_LIVENESS_VIOLATION",
        }
    }

    pub fn is_automatic_penalty(self) -> bool {
        matches!(
            self,
            Self::DoubleProposal | Self::DoublePrevote | Self::DoublePrecommit
        )
    }

    pub fn from_message_type(ty: ConsensusMessageType) -> Self {
        match ty {
            ConsensusMessageType::Proposal => Self::DoubleProposal,
            ConsensusMessageType::Prevote => Self::DoublePrevote,
            ConsensusMessageType::Precommit => Self::DoublePrecommit,
        }
    }

    pub fn priority(self) -> u8 {
        match self {
            Self::DoublePrecommit => 3,
            Self::DoubleProposal => 2,
            Self::DoublePrevote => 1,
            Self::InvalidStateProposal | Self::ConsensusLivenessViolation => 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EquivocationEvidence {
    pub evidence_type: EvidenceType,
    pub left: SignedConsensusMessage,
    pub right: SignedConsensusMessage,
}

impl EquivocationEvidence {
    pub fn from_conflicting(
        left: SignedConsensusMessage,
        right: SignedConsensusMessage,
    ) -> NodeResult<Self> {
        if left.msg_type != right.msg_type {
            return Err(NodeError::Validation(
                "evidence messages must share a type".into(),
            ));
        }
        if left.block_id == right.block_id {
            return Err(NodeError::Validation(
                "same message twice is not equivocation".into(),
            ));
        }
        let (left, right) = order_messages(left, right);
        Ok(Self {
            evidence_type: EvidenceType::from_message_type(left.msg_type),
            left,
            right,
        })
    }

    pub fn evidence_id(&self) -> [u8; 32] {
        let (a, b) = order_messages(self.left.clone(), self.right.clone());
        let mut w = Writer::new();
        w.u8(self.evidence_type as u8);
        w.bytes(&a.encode().unwrap_or_default())
            .expect("evidence left");
        w.bytes(&b.encode().unwrap_or_default())
            .expect("evidence right");
        sha256(&w.finish())
    }

    pub fn hex_id(&self) -> String {
        hex::encode(self.evidence_id())
    }

    pub fn validator_id(&self) -> &str {
        &self.left.validator_id
    }

    pub fn offense_height(&self) -> u64 {
        self.left.height
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(1);
        w.u8(self.evidence_type as u8);
        w.bytes(&self.left.encode()?)?;
        w.bytes(&self.right.encode()?)?;
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        if r.u8()? != 1 {
            return Err(NodeError::Codec("unknown evidence schema".into()));
        }
        let evidence = Self {
            evidence_type: EvidenceType::from_u8(r.u8()?)?,
            left: SignedConsensusMessage::decode(&r.bytes()?)?,
            right: SignedConsensusMessage::decode(&r.bytes()?)?,
        };
        r.finish()?;
        Ok(evidence)
    }

    pub fn public_view(&self) -> serde_json::Value {
        serde_json::json!({
            "evidence_id": self.hex_id(),
            "evidence_type": self.evidence_type.as_str(),
            "validator_id": self.validator_id(),
            "height": self.left.height,
            "round": self.left.round,
            "left_block_id": hex::encode(self.left.block_id),
            "right_block_id": hex::encode(self.right.block_id),
            "left_signature": hex::encode(self.left.signature),
            "right_signature": hex::encode(self.right.signature),
            "left_public_key": hex::encode(self.left.public_key),
            "right_public_key": hex::encode(self.right.public_key),
        })
    }
}

fn order_messages(
    left: SignedConsensusMessage,
    right: SignedConsensusMessage,
) -> (SignedConsensusMessage, SignedConsensusMessage) {
    let left_bytes = left.encode().unwrap_or_default();
    let right_bytes = right.encode().unwrap_or_default();
    if left_bytes <= right_bytes {
        (left, right)
    } else {
        (right, left)
    }
}

#[derive(Debug, Clone)]
pub struct EvidenceContext<'a> {
    pub network_id: &'a str,
    pub chain_id: &'a str,
    pub current_height: u64,
    pub historical_set: &'a ValidatorSet,
    pub processed: &'a std::collections::BTreeSet<[u8; 32]>,
}

pub fn verify_equivocation_evidence(
    evidence: &EquivocationEvidence,
    ctx: &EvidenceContext<'_>,
) -> NodeResult<()> {
    if !evidence.evidence_type.is_automatic_penalty() {
        return Err(NodeError::Validation(
            "reserved evidence type cannot trigger automatic penalties".into(),
        ));
    }
    if evidence.left.msg_type != evidence.right.msg_type {
        return Err(NodeError::Validation("evidence type mismatch".into()));
    }
    if EvidenceType::from_message_type(evidence.left.msg_type) != evidence.evidence_type {
        return Err(NodeError::Validation(
            "evidence type does not match votes".into(),
        ));
    }
    if evidence.left.validator_id != evidence.right.validator_id {
        return Err(NodeError::Validation("evidence validators differ".into()));
    }
    if evidence.left.network_id != evidence.right.network_id
        || evidence.left.chain_id != evidence.right.chain_id
    {
        return Err(NodeError::Validation(
            "evidence chain identity differs".into(),
        ));
    }
    if evidence.left.network_id != ctx.network_id || evidence.left.chain_id != ctx.chain_id {
        return Err(NodeError::Validation(
            "evidence chain or network mismatch".into(),
        ));
    }
    if evidence.left.height != evidence.right.height {
        return Err(NodeError::Validation("evidence heights differ".into()));
    }
    if evidence.left.round != evidence.right.round {
        return Err(NodeError::Validation("evidence rounds differ".into()));
    }
    if evidence.left.block_id == evidence.right.block_id {
        return Err(NodeError::Validation(
            "same message twice is not equivocation".into(),
        ));
    }
    if evidence.left.public_key != evidence.right.public_key {
        return Err(NodeError::Validation(
            "evidence signatures are not from the same consensus key".into(),
        ));
    }
    if evidence.left.validator_set_hash != evidence.right.validator_set_hash {
        return Err(NodeError::Validation(
            "evidence validator-set hashes differ".into(),
        ));
    }
    if evidence.left.validator_set_hash != ctx.historical_set.hash() {
        return Err(NodeError::Validation(
            "evidence validator-set hash does not match historical set".into(),
        ));
    }
    let Some(validator) = ctx.historical_set.get(&evidence.left.validator_id) else {
        return Err(NodeError::Validation(
            "validator was not a member at the offense height".into(),
        ));
    };
    let expected_key = match evidence.left.msg_type {
        ConsensusMessageType::Proposal => validator.proposal_pubkey,
        ConsensusMessageType::Prevote | ConsensusMessageType::Precommit => {
            validator.consensus_pubkey
        }
    };
    if evidence.left.public_key != expected_key {
        return Err(NodeError::Validation(
            "wrong historical validator key".into(),
        ));
    }
    evidence.left.verify_signature()?;
    evidence.right.verify_signature()?;
    if ctx.current_height
        > evidence
            .offense_height()
            .saturating_add(MAX_EVIDENCE_AGE_HEIGHTS)
    {
        return Err(NodeError::Validation("expired evidence".into()));
    }
    if ctx.processed.contains(&evidence.evidence_id()) {
        return Err(NodeError::Validation("duplicate evidence".into()));
    }
    Ok(())
}

pub fn evidence_root(items: &[EquivocationEvidence]) -> [u8; 32] {
    let mut w = Writer::new();
    w.u32(items.len() as u32);
    let mut ids: Vec<[u8; 32]> = items
        .iter()
        .map(EquivocationEvidence::evidence_id)
        .collect();
    ids.sort();
    for id in ids {
        w.bytes32(&id);
    }
    sha256(&w.finish())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::consensus_vote::ConsensusMessageType;
    use crate::validators::four_validator_devnet;
    use std::collections::BTreeSet;

    fn pair(
        ty: ConsensusMessageType,
        left_block: u8,
        right_block: u8,
    ) -> (EquivocationEvidence, crate::validators::ValidatorSet) {
        let (set, fixtures) = four_validator_devnet();
        let byz = &fixtures[3];
        let key = match ty {
            ConsensusMessageType::Proposal => &byz.proposal,
            _ => &byz.consensus,
        };
        let left = SignedConsensusMessage::sign(
            key,
            "net_sunrey_development",
            "chn_sunrey_development",
            "val-d",
            1,
            0,
            ty,
            [left_block; 32],
            set.hash(),
        )
        .unwrap();
        let right = SignedConsensusMessage::sign(
            key,
            "net_sunrey_development",
            "chn_sunrey_development",
            "val-d",
            1,
            0,
            ty,
            [right_block; 32],
            set.hash(),
        )
        .unwrap();
        (
            EquivocationEvidence::from_conflicting(left, right).unwrap(),
            set,
        )
    }

    #[test]
    fn evidence_id_ignores_submission_order() {
        let (a, _) = pair(ConsensusMessageType::Prevote, 1, 2);
        let (b, _) = pair(ConsensusMessageType::Prevote, 2, 1);
        assert_eq!(a.evidence_id(), b.evidence_id());
    }

    #[test]
    fn valid_double_votes_verify() {
        for ty in [
            ConsensusMessageType::Proposal,
            ConsensusMessageType::Prevote,
            ConsensusMessageType::Precommit,
        ] {
            let (evidence, set) = pair(ty, 1, 2);
            let processed = BTreeSet::new();
            let ctx = EvidenceContext {
                network_id: "net_sunrey_development",
                chain_id: "chn_sunrey_development",
                current_height: 1,
                historical_set: &set,
                processed: &processed,
            };
            verify_equivocation_evidence(&evidence, &ctx).unwrap();
        }
    }
}
