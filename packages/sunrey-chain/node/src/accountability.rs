//! Versioned validator accountability policy, receipts, jail, tombstone,
//! and simulation-bond penalties.
//!
//! Decisions are deterministic. There is no AI path. Customer fiat,
//! SunRey Coin, and MoonRey balances cannot be debited from here.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use crate::codec::Writer;
use crate::crypto::sha256;
use crate::error::{NodeError, NodeResult};
use crate::evidence::{
    verify_equivocation_evidence, EquivocationEvidence, EvidenceContext, EvidenceType,
};
use crate::validators::{ValidatorRuntime, ValidatorStatus};

pub const POLICY_VERSION: u32 = 1;
pub const DOUBLE_PROPOSAL_PENALTY_BPS: u16 = 5_000;
pub const DOUBLE_PREVOTE_PENALTY_BPS: u16 = 2_500;
pub const DOUBLE_PRECOMMIT_PENALTY_BPS: u16 = 5_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ValidatorAccountabilityPolicy {
    pub version: u32,
}

impl Default for ValidatorAccountabilityPolicy {
    fn default() -> Self {
        Self {
            version: POLICY_VERSION,
        }
    }
}

impl ValidatorAccountabilityPolicy {
    pub fn development() -> Self {
        Self::default()
    }

    pub fn hash(self) -> [u8; 32] {
        let mut w = Writer::new();
        w.u32(self.version);
        w.u8(EvidenceType::DoubleProposal as u8);
        w.u8(1); // tombstone
        w.u8(1); // jail
        w.u16(DOUBLE_PROPOSAL_PENALTY_BPS);
        w.u8(EvidenceType::DoublePrevote as u8);
        w.u8(0);
        w.u8(1);
        w.u16(DOUBLE_PREVOTE_PENALTY_BPS);
        w.u8(EvidenceType::DoublePrecommit as u8);
        w.u8(1);
        w.u8(1);
        w.u16(DOUBLE_PRECOMMIT_PENALTY_BPS);
        sha256(&w.finish())
    }

    pub fn hex_hash(self) -> String {
        hex::encode(self.hash())
    }

    pub fn outcome(self, evidence_type: EvidenceType) -> PolicyOutcome {
        match evidence_type {
            EvidenceType::DoubleProposal => PolicyOutcome {
                record: true,
                jail: true,
                tombstone: true,
                penalty_bps: DOUBLE_PROPOSAL_PENALTY_BPS,
                decision: "TOMBSTONE+SIMULATION_BOND_PENALTY",
            },
            EvidenceType::DoublePrevote => PolicyOutcome {
                record: true,
                jail: true,
                tombstone: false,
                penalty_bps: DOUBLE_PREVOTE_PENALTY_BPS,
                decision: "JAIL+SIMULATION_BOND_PENALTY",
            },
            EvidenceType::DoublePrecommit => PolicyOutcome {
                record: true,
                jail: true,
                tombstone: true,
                penalty_bps: DOUBLE_PRECOMMIT_PENALTY_BPS,
                decision: "TOMBSTONE+SIMULATION_BOND_PENALTY",
            },
            EvidenceType::InvalidStateProposal | EvidenceType::ConsensusLivenessViolation => {
                PolicyOutcome {
                    record: true,
                    jail: false,
                    tombstone: false,
                    penalty_bps: 0,
                    decision: "RECORD_ONLY",
                }
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PolicyOutcome {
    pub record: bool,
    pub jail: bool,
    pub tombstone: bool,
    pub penalty_bps: u16,
    pub decision: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct AccountabilityReceipt {
    pub evidence_id: String,
    pub validator_id: String,
    pub evidence_type: String,
    pub policy_version: u32,
    pub policy_hash: String,
    pub decision: String,
    pub effective_epoch: u64,
    pub bond_penalty_units: String,
    pub validator_status_change: String,
    pub finalized_block_id: String,
    pub processed_height: u64,
    pub left_content_id: String,
    pub right_content_id: String,
}

impl AccountabilityReceipt {
    pub fn public_view(&self) -> serde_json::Value {
        serde_json::to_value(self).unwrap_or_else(|_| serde_json::json!({}))
    }
}

#[derive(Debug, Clone)]
pub struct AccountabilityState {
    pub policy: ValidatorAccountabilityPolicy,
    pub receipts: Vec<AccountabilityReceipt>,
    pub processed: BTreeSet<[u8; 32]>,
    persist_dir: Option<PathBuf>,
}

impl AccountabilityState {
    pub fn new(policy: ValidatorAccountabilityPolicy) -> Self {
        Self {
            policy,
            receipts: Vec::new(),
            processed: BTreeSet::new(),
            persist_dir: None,
        }
    }

    pub fn with_persist_dir(mut self, dir: &Path) -> Self {
        self.persist_dir = Some(dir.to_path_buf());
        self
    }

    pub fn open(dir: &Path, policy: ValidatorAccountabilityPolicy) -> NodeResult<Self> {
        let mut state = Self {
            policy,
            receipts: Vec::new(),
            processed: BTreeSet::new(),
            persist_dir: Some(dir.to_path_buf()),
        };
        let receipts_path = dir.join("accountability-receipts.json");
        if receipts_path.exists() {
            let text = std::fs::read_to_string(&receipts_path)
                .map_err(|e| NodeError::Store(e.to_string()))?;
            if let Ok(receipts) = serde_json::from_str::<Vec<AccountabilityReceipt>>(&text) {
                for receipt in &receipts {
                    if let Ok(raw) = hex::decode(&receipt.evidence_id) {
                        if raw.len() == 32 {
                            let mut id = [0u8; 32];
                            id.copy_from_slice(&raw);
                            state.processed.insert(id);
                        }
                    }
                }
                state.receipts = receipts;
            }
        }
        Ok(state)
    }

    fn persist(&self) {
        let Some(dir) = &self.persist_dir else {
            return;
        };
        if let Ok(text) = serde_json::to_string_pretty(&self.receipts) {
            let _ = std::fs::write(dir.join("accountability-receipts.json"), text);
        }
    }

    pub fn already_processed(&self, id: &[u8; 32]) -> bool {
        self.processed.contains(id)
    }

    pub fn offenses_for(&self, validator_id: &str) -> Vec<&AccountabilityReceipt> {
        self.receipts
            .iter()
            .filter(|r| r.validator_id == validator_id)
            .collect()
    }

    pub fn execute(
        &mut self,
        evidence: &EquivocationEvidence,
        runtime: &mut ValidatorRuntime,
        network_id: &str,
        chain_id: &str,
        current_height: u64,
        finalized_block_id: [u8; 32],
    ) -> NodeResult<AccountabilityReceipt> {
        let id = evidence.evidence_id();
        if self.processed.contains(&id) {
            return Err(NodeError::Validation("duplicate evidence".into()));
        }
        let historical = runtime.set_at_height(evidence.offense_height()).clone();
        let ctx = EvidenceContext {
            network_id,
            chain_id,
            current_height,
            historical_set: &historical,
            processed: &self.processed,
        };
        verify_equivocation_evidence(evidence, &ctx)?;

        if !evidence.evidence_type.is_automatic_penalty() {
            return Err(NodeError::Validation(
                "unverified or reserved evidence cannot penalize".into(),
            ));
        }

        let outcome = self.policy.outcome(evidence.evidence_type);
        let effective_epoch = runtime.epoch_of(current_height) + 1;
        let Some(pending) = runtime.pending.get_mut(evidence.validator_id()) else {
            return Err(NodeError::Validation(
                "validator missing from pending set".into(),
            ));
        };
        if pending.status == ValidatorStatus::Tombstoned {
            return Err(NodeError::Validation(
                "tombstoned validator cannot be penalized twice for the same identity".into(),
            ));
        }
        let previous = pending.status.as_str().to_string();
        let penalty = if outcome.penalty_bps == 0 {
            0
        } else {
            pending
                .bond
                .remaining_units
                .saturating_mul(u128::from(outcome.penalty_bps))
                / 10_000
        };
        let applied = pending.bond.apply_penalty(penalty);
        if outcome.tombstone {
            pending.status = ValidatorStatus::Tombstoned;
            pending.voting_power = 0;
            pending.jailed_until_epoch = None;
        } else if outcome.jail {
            pending.status = ValidatorStatus::Jailed;
            pending.voting_power = 0;
            pending.jailed_until_epoch = Some(effective_epoch);
        }
        let next_status = pending.status.as_str().to_string();
        // Active set is unchanged until the epoch boundary. History is append-only.
        let receipt = AccountabilityReceipt {
            evidence_id: hex::encode(id),
            validator_id: evidence.validator_id().into(),
            evidence_type: evidence.evidence_type.as_str().into(),
            policy_version: self.policy.version,
            policy_hash: self.policy.hex_hash(),
            decision: outcome.decision.into(),
            effective_epoch,
            bond_penalty_units: applied.to_string(),
            validator_status_change: format!("{previous}->{next_status}"),
            finalized_block_id: hex::encode(finalized_block_id),
            processed_height: current_height,
            left_content_id: hex::encode(evidence.left.content_id()),
            right_content_id: hex::encode(evidence.right.content_id()),
        };
        self.processed.insert(id);
        self.receipts.push(receipt.clone());
        self.persist();
        Ok(receipt)
    }
}

pub fn refuse_customer_asset_confiscation() -> [NodeError; 5] {
    [
        NodeError::Forbidden("accountability cannot debit customer fiat journals".into()),
        NodeError::Forbidden("accountability cannot debit bank accounts".into()),
        NodeError::Forbidden("accountability cannot debit investment accounts".into()),
        NodeError::Forbidden("accountability cannot confiscate customer SunRey Coin".into()),
        NodeError::Forbidden("accountability cannot debit MoonRey balances".into()),
    ]
}

pub fn refuse_ai_punishment() -> [NodeError; 3] {
    [
        NodeError::Forbidden("AI cannot jail a validator".into()),
        NodeError::Forbidden("AI cannot tombstone a validator".into()),
        NodeError::Forbidden("AI cannot apply a simulation bond penalty".into()),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::consensus_vote::{ConsensusMessageType, SignedConsensusMessage};
    use crate::validators::four_validator_devnet;

    fn evidence(ty: ConsensusMessageType) -> (EquivocationEvidence, ValidatorRuntime) {
        let (set, fixtures) = four_validator_devnet();
        let runtime = ValidatorRuntime::new(set.clone(), 4);
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
            [1u8; 32],
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
            [2u8; 32],
            set.hash(),
        )
        .unwrap();
        (
            EquivocationEvidence::from_conflicting(left, right).unwrap(),
            runtime,
        )
    }

    #[test]
    fn prevote_jails_and_penalizes_once() {
        let (ev, mut runtime) = evidence(ConsensusMessageType::Prevote);
        let mut state = AccountabilityState::new(ValidatorAccountabilityPolicy::development());
        let receipt = state
            .execute(
                &ev,
                &mut runtime,
                "net_sunrey_development",
                "chn_sunrey_development",
                1,
                [9u8; 32],
            )
            .unwrap();
        assert_eq!(receipt.decision, "JAIL+SIMULATION_BOND_PENALTY");
        assert_eq!(receipt.bond_penalty_units, "250000");
        assert_eq!(
            runtime.pending.get("val-d").unwrap().status,
            ValidatorStatus::Jailed
        );
        assert_eq!(
            runtime.active.get("val-d").unwrap().status,
            ValidatorStatus::Active
        );
        assert!(state
            .execute(
                &ev,
                &mut runtime,
                "net_sunrey_development",
                "chn_sunrey_development",
                1,
                [9u8; 32],
            )
            .is_err());
        runtime.commit_epoch_if_needed(4);
        assert_eq!(
            runtime.active.get("val-d").unwrap().status,
            ValidatorStatus::Jailed
        );
        assert_eq!(runtime.active.get("val-d").unwrap().voting_power, 0);
        assert!(runtime.active.remaining_can_progress());
    }

    #[test]
    fn proposal_and_precommit_tombstone() {
        for ty in [
            ConsensusMessageType::Proposal,
            ConsensusMessageType::Precommit,
        ] {
            let (ev, mut runtime) = evidence(ty);
            let mut state = AccountabilityState::new(ValidatorAccountabilityPolicy::development());
            let receipt = state
                .execute(
                    &ev,
                    &mut runtime,
                    "net_sunrey_development",
                    "chn_sunrey_development",
                    1,
                    [8u8; 32],
                )
                .unwrap();
            assert!(receipt.decision.contains("TOMBSTONE"));
            assert_eq!(
                runtime.pending.get("val-d").unwrap().status,
                ValidatorStatus::Tombstoned
            );
        }
    }
}
