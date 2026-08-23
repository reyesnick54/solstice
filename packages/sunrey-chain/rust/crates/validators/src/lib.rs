//! SunRey validator registry, lifecycle, integer voting power, and
//! durable signer safety. This is not a BFT round engine.

pub mod cli;
pub mod devset;
pub mod economics;
pub mod lifecycle;
pub mod power;
pub mod productization;
pub mod set;
pub mod signer;
pub mod types;

pub use cli::{run_validator_command, ValidatorCli, ValidatorCommand};
pub use devset::{four_validator_development_hash, four_validator_development_set, public_view};
pub use lifecycle::{assert_consensus_purpose, assert_controller, transition};
pub use power::{
    has_one_third_plus, has_two_thirds_plus, one_third_power, total_power, two_thirds_power,
};
pub use productization::{
    controlled_transition, product_view, refuse_mainnet_activation, to_operator_lifecycle,
    OperatorLifecycle, ValidatorProductRecord,
};
pub use set::{apply_epoch_boundary, validator_set_hash};
pub use signer::{
    sign_precommit, sign_prevote, sign_proposal, DurableSignerSafety, LocalDevelopmentSigner,
};
pub use types::{
    BondDescriptor, ConsensusMessageType, ConsensusSignRequest, Epoch, QueuedChange,
    QueuedChangeKind, ValidatorRecord, ValidatorSet, ValidatorStatus, PROTOCOL_ALGORITHM_ID,
    PROTOCOL_SUITE_ID,
};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::devset::development_validator_record;
    use crate::set::apply_epoch_boundary;
    use crate::signer::{safety_path, ConsensusSigner};
    use crate::types::{PublicKeyRef, ValidatorError};

    fn epoch(number: u64, start: u64, end: u64) -> Epoch {
        Epoch { number, start_height: start, end_height: end, validator_set_version: number + 1 }
    }

    fn req(
        message_type: ConsensusMessageType,
        height: u64,
        round: u64,
        block_id: &str,
    ) -> ConsensusSignRequest {
        ConsensusSignRequest {
            validator_id: "val_dev_a".into(),
            network_id: "net_sunrey_local_dev".into(),
            chain_id: "chn_sunrey_local_dev".into(),
            protocol_version: "1".into(),
            message_type,
            height,
            round,
            block_id: block_id.into(),
            validator_set_version: 1,
            crypto_suite_id: PROTOCOL_SUITE_ID.into(),
        }
    }

    fn temp_dir(label: &str) -> std::path::PathBuf {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!(
            "sunrey-val-{}-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed),
            label
        ));
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn deterministic_four_validator_set() {
        let first = four_validator_development_set();
        let second = four_validator_development_set();
        assert_eq!(first.validators.len(), 4);
        assert_eq!(validator_set_hash(&first), validator_set_hash(&second));
        assert_eq!(
            first.validators.iter().map(|row| row.validator_id.as_str()).collect::<Vec<_>>(),
            ["val_dev_a", "val_dev_b", "val_dev_c", "val_dev_d"]
        );
    }

    #[test]
    fn identical_set_identical_hash() {
        assert_eq!(
            four_validator_development_hash(),
            validator_set_hash(&four_validator_development_set())
        );
    }

    #[test]
    fn voting_power_change_changes_hash() {
        let mut changed = four_validator_development_set();
        changed.validators[0].voting_power = 2;
        assert_ne!(four_validator_development_hash(), validator_set_hash(&changed));
    }

    #[test]
    fn public_key_change_changes_hash() {
        let mut changed = four_validator_development_set();
        changed.validators[0].consensus_public_key.public_key_hex = "ff".repeat(32);
        assert_ne!(four_validator_development_hash(), validator_set_hash(&changed));
    }

    #[test]
    fn ai_controller_rejected() {
        assert_eq!(assert_controller("AI_AGENT").unwrap_err().code(), "FORBIDDEN_CONTROLLER");
    }

    #[test]
    fn robot_controller_rejected() {
        assert_eq!(assert_controller("ROBOT").unwrap_err().code(), "FORBIDDEN_CONTROLLER");
    }

    #[test]
    fn device_controller_rejected() {
        assert_eq!(assert_controller("DEVICE").unwrap_err().code(), "FORBIDDEN_CONTROLLER");
    }

    #[test]
    fn p2p_key_rejected_as_consensus() {
        assert_eq!(
            assert_consensus_purpose("P2P_IDENTITY").unwrap_err().code(),
            "FORBIDDEN_KEY_PURPOSE"
        );
    }

    #[test]
    fn execution_authority_key_rejected() {
        assert_eq!(
            assert_consensus_purpose("EXECUTION_AUTHORITY_SIGNING").unwrap_err().code(),
            "FORBIDDEN_KEY_PURPOSE"
        );
    }

    #[test]
    fn duplicate_consensus_key_rejected() {
        let set = four_validator_development_set();
        let mut dup = development_validator_record("B");
        dup.validator_id = "val_dev_dup".into();
        dup.consensus_public_key = set.validators[0].consensus_public_key.clone();
        let change = QueuedChange {
            kind: QueuedChangeKind::AddValidator,
            validator_id: dup.validator_id.clone(),
            activation_epoch: 1,
            controller_kind: "HUMAN".into(),
            voting_power: None,
            consensus_public_key: None,
            record: Some(dup),
        };
        let err = apply_epoch_boundary(&set, &epoch(0, 0, 10), &epoch(1, 10, 20), &[change], 10)
            .unwrap_err();
        assert_eq!(err.code(), "DUPLICATE_CONSENSUS_KEY");
    }

    fn protect(
        dir: &std::path::Path,
        message_type: ConsensusMessageType,
        height: u64,
        round: u64,
        block: &str,
    ) -> Result<String, ValidatorError> {
        let mut safety =
            DurableSignerSafety::new(safety_path(dir, "val_dev_a", "chn_sunrey_local_dev"));
        let signer = LocalDevelopmentSigner::from_seed([7u8; 32]);
        sign_proposal_like(&mut safety, &signer, message_type, height, round, block)
    }

    fn sign_proposal_like(
        safety: &mut DurableSignerSafety,
        signer: &LocalDevelopmentSigner,
        message_type: ConsensusMessageType,
        height: u64,
        round: u64,
        block: &str,
    ) -> Result<String, ValidatorError> {
        match message_type {
            ConsensusMessageType::Proposal => {
                sign_proposal(signer, safety, req(message_type, height, round, block), "HUMAN", "t")
            }
            ConsensusMessageType::Prevote => {
                sign_prevote(signer, safety, req(message_type, height, round, block), "HUMAN", "t")
            }
            ConsensusMessageType::Precommit => sign_precommit(
                signer,
                safety,
                req(message_type, height, round, block),
                "HUMAN",
                "t",
            ),
        }
    }

    #[test]
    fn conflicting_proposal_rejected() {
        let dir = temp_dir("proposal");
        assert!(protect(&dir, ConsensusMessageType::Proposal, 5, 1, "block-a").is_ok());
        assert_eq!(
            protect(&dir, ConsensusMessageType::Proposal, 5, 1, "block-b").unwrap_err().code(),
            "SIGNER_CONFLICT"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn conflicting_prevote_rejected() {
        let dir = temp_dir("prevote");
        assert!(protect(&dir, ConsensusMessageType::Prevote, 5, 1, "block-a").is_ok());
        assert_eq!(
            protect(&dir, ConsensusMessageType::Prevote, 5, 1, "block-b").unwrap_err().code(),
            "SIGNER_CONFLICT"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn conflicting_precommit_rejected() {
        let dir = temp_dir("precommit");
        assert!(protect(&dir, ConsensusMessageType::Precommit, 5, 1, "block-a").is_ok());
        assert_eq!(
            protect(&dir, ConsensusMessageType::Precommit, 5, 1, "block-b").unwrap_err().code(),
            "SIGNER_CONFLICT"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn signer_protection_survives_restart() {
        let dir = temp_dir("restart");
        assert!(protect(&dir, ConsensusMessageType::Proposal, 9, 2, "block-a").is_ok());
        assert_eq!(
            protect(&dir, ConsensusMessageType::Proposal, 9, 2, "block-b").unwrap_err().code(),
            "SIGNER_CONFLICT"
        );
        assert!(protect(&dir, ConsensusMessageType::Proposal, 9, 2, "block-a").is_ok());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn key_rotation_at_epoch_boundary() {
        let set = four_validator_development_set();
        let new_key = PublicKeyRef {
            role: "CONSENSUS_VOTING_KEY".into(),
            purpose: "VALIDATOR_CONSENSUS_SIGNING".into(),
            public_key_hex: "aa".repeat(32),
            key_id: "rotated-a".into(),
            suite_id: PROTOCOL_SUITE_ID.into(),
        };
        let mid = apply_epoch_boundary(&set, &epoch(0, 0, 10), &epoch(1, 10, 20), &[], 5);
        assert_eq!(mid.unwrap_err().code(), "ACTIVE_SET_IMMUTABLE");
        let change = QueuedChange {
            kind: QueuedChangeKind::RotateConsensusKey,
            validator_id: "val_dev_a".into(),
            activation_epoch: 1,
            controller_kind: "HUMAN".into(),
            voting_power: None,
            consensus_public_key: Some(new_key.clone()),
            record: None,
        };
        let next =
            apply_epoch_boundary(&set, &epoch(0, 0, 10), &epoch(1, 10, 20), &[change], 10).unwrap();
        let updated = next
            .next_validator_set
            .validators
            .iter()
            .find(|row| row.validator_id == "val_dev_a")
            .unwrap();
        assert_eq!(updated.consensus_public_key.public_key_hex, new_key.public_key_hex);
        assert_eq!(updated.historical_consensus_keys.len(), 1);
    }

    #[test]
    fn voluntary_exit_at_epoch_boundary() {
        let set = four_validator_development_set();
        let change = QueuedChange {
            kind: QueuedChangeKind::ScheduleExit,
            validator_id: "val_dev_d".into(),
            activation_epoch: 1,
            controller_kind: "HUMAN".into(),
            voting_power: None,
            consensus_public_key: None,
            record: None,
        };
        let pending =
            apply_epoch_boundary(&set, &epoch(0, 0, 10), &epoch(1, 10, 20), &[change], 10).unwrap();
        let row = pending
            .next_validator_set
            .validators
            .iter()
            .find(|row| row.validator_id == "val_dev_d")
            .unwrap();
        assert_eq!(row.status, ValidatorStatus::PendingExit);
        let exited = apply_epoch_boundary(
            &pending.next_validator_set,
            &epoch(1, 10, 20),
            &epoch(2, 20, 30),
            &[],
            20,
        )
        .unwrap();
        let row = exited
            .next_validator_set
            .validators
            .iter()
            .find(|row| row.validator_id == "val_dev_d")
            .unwrap();
        assert_eq!(row.status, ValidatorStatus::Exited);
    }

    #[test]
    fn active_set_immutable_during_epoch() {
        let set = four_validator_development_set();
        let err =
            apply_epoch_boundary(&set, &epoch(0, 0, 10), &epoch(1, 10, 20), &[], 4).unwrap_err();
        assert_eq!(err.code(), "ACTIVE_SET_IMMUTABLE");
    }

    #[test]
    fn exact_two_thirds_threshold() {
        let total = total_power(&[1, 1, 1, 1]).unwrap();
        assert_eq!(total, 4);
        assert_eq!(one_third_power(total), 1);
        assert_eq!(two_thirds_power(total), 2);
        assert!(!has_two_thirds_plus(2, total).unwrap());
        assert!(has_two_thirds_plus(3, total).unwrap());
        assert!(!has_one_third_plus(1, total).unwrap());
        assert!(has_one_third_plus(2, total).unwrap());
    }

    #[test]
    fn no_customer_ledger_or_native_issuance() {
        let set = four_validator_development_set();
        for row in &set.validators {
            assert_eq!(row.bond_descriptor.kind.as_str(), "SIMULATION_BOND");
            assert_eq!(row.bond_descriptor.asset_ref, "SIMULATION.VALIDATOR_BOND");
        }
        assert_eq!(LocalDevelopmentSigner::from_seed([1u8; 32]).kind(), "LOCAL_DEVELOPMENT_SIGNER");
    }
}
