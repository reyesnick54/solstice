//! Productized validator lifecycle mapping.
//!
//! Protocol statuses stay authoritative. This module exposes the
//! operator-facing lifecycle required for network operations without
//! inventing stake economics.

use serde::{Deserialize, Serialize};

use crate::lifecycle::{allowed_transitions, assert_controller, transition};
use crate::types::{err, ValidatorError, ValidatorRecord, ValidatorStatus};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OperatorLifecycle {
    Registered,
    PendingActivation,
    Active,
    Suspended,
    Exiting,
    Inactive,
}

impl OperatorLifecycle {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Registered => "REGISTERED",
            Self::PendingActivation => "PENDING_ACTIVATION",
            Self::Active => "ACTIVE",
            Self::Suspended => "SUSPENDED",
            Self::Exiting => "EXITING",
            Self::Inactive => "INACTIVE",
        }
    }
}

pub fn to_operator_lifecycle(status: ValidatorStatus) -> OperatorLifecycle {
    match status {
        ValidatorStatus::Candidate | ValidatorStatus::Bonded => OperatorLifecycle::Registered,
        ValidatorStatus::PendingActivation => OperatorLifecycle::PendingActivation,
        ValidatorStatus::Active => OperatorLifecycle::Active,
        ValidatorStatus::Jailed => OperatorLifecycle::Suspended,
        ValidatorStatus::PendingExit => OperatorLifecycle::Exiting,
        ValidatorStatus::Tombstoned | ValidatorStatus::Exited => OperatorLifecycle::Inactive,
    }
}

pub fn protocol_targets(lifecycle: OperatorLifecycle) -> &'static [ValidatorStatus] {
    match lifecycle {
        OperatorLifecycle::Registered => &[ValidatorStatus::Candidate, ValidatorStatus::Bonded],
        OperatorLifecycle::PendingActivation => &[ValidatorStatus::PendingActivation],
        OperatorLifecycle::Active => &[ValidatorStatus::Active],
        OperatorLifecycle::Suspended => &[ValidatorStatus::Jailed],
        OperatorLifecycle::Exiting => &[ValidatorStatus::PendingExit],
        OperatorLifecycle::Inactive => &[ValidatorStatus::Exited, ValidatorStatus::Tombstoned],
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ValidatorProductRecord {
    pub validator_id: String,
    pub operator: String,
    pub network_id: String,
    pub consensus_key_id: String,
    pub p2p_key_id: String,
    pub governance_key_id: String,
    pub status: OperatorLifecycle,
    pub protocol_status: ValidatorStatus,
    pub voting_power: u64,
    pub bond_kind: String,
    pub bond_units: u64,
    pub activation_epoch: u64,
    pub metadata: String,
    pub mainnet_activation_requires_governance: bool,
}

pub fn product_view(record: &ValidatorRecord, network_id: &str) -> ValidatorProductRecord {
    ValidatorProductRecord {
        validator_id: record.validator_id.clone(),
        operator: record.operator_actor_id.clone(),
        network_id: network_id.to_string(),
        consensus_key_id: record.consensus_public_key.key_id.clone(),
        p2p_key_id: record.p2p_public_key.key_id.clone(),
        governance_key_id: record.governance_public_key.key_id.clone(),
        status: to_operator_lifecycle(record.status),
        protocol_status: record.status,
        voting_power: record.voting_power,
        bond_kind: record.bond_descriptor.kind.as_str().to_string(),
        bond_units: record.bond_descriptor.units,
        activation_epoch: record.activation_epoch,
        metadata: record.protocol_metadata.clone(),
        mainnet_activation_requires_governance: true,
    }
}

pub fn refuse_mainnet_activation(
    environment: &str,
    human_governance_approved: bool,
) -> Result<(), ValidatorError> {
    if environment == "MAINNET" && !human_governance_approved {
        return Err(err(
            "MAINNET_ACTIVATION_REQUIRES_GOVERNANCE",
            "mainnet validator activation requires an explicit human governance process",
        ));
    }
    Ok(())
}

pub fn controlled_transition(
    record: &ValidatorRecord,
    to: OperatorLifecycle,
    height: u64,
    epoch: u64,
    controller_kind: &str,
) -> Result<(ValidatorRecord, &'static str), ValidatorError> {
    assert_controller(controller_kind)?;
    let target = match to {
        OperatorLifecycle::Registered => ValidatorStatus::Bonded,
        OperatorLifecycle::PendingActivation => ValidatorStatus::PendingActivation,
        OperatorLifecycle::Active => ValidatorStatus::Active,
        OperatorLifecycle::Suspended => ValidatorStatus::Jailed,
        OperatorLifecycle::Exiting => ValidatorStatus::PendingExit,
        OperatorLifecycle::Inactive => ValidatorStatus::Exited,
    };
    if record.status == target {
        return Ok((record.clone(), "ALREADY_IN_STATE"));
    }
    if !allowed_transitions(record.status).contains(&target) {
        return Err(err(
            "UNDEFINED_TRANSITION",
            format!("operator lifecycle {:?} is not reachable from {:?}", to, record.status),
        ));
    }
    transition(record, target, height, epoch)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::devset::development_validator_record;

    #[test]
    fn maps_protocol_statuses_to_operator_lifecycle() {
        assert_eq!(
            to_operator_lifecycle(ValidatorStatus::Candidate),
            OperatorLifecycle::Registered
        );
        assert_eq!(to_operator_lifecycle(ValidatorStatus::Bonded), OperatorLifecycle::Registered);
        assert_eq!(
            to_operator_lifecycle(ValidatorStatus::PendingActivation),
            OperatorLifecycle::PendingActivation
        );
        assert_eq!(to_operator_lifecycle(ValidatorStatus::Active), OperatorLifecycle::Active);
        assert_eq!(to_operator_lifecycle(ValidatorStatus::Jailed), OperatorLifecycle::Suspended);
        assert_eq!(to_operator_lifecycle(ValidatorStatus::PendingExit), OperatorLifecycle::Exiting);
        assert_eq!(to_operator_lifecycle(ValidatorStatus::Exited), OperatorLifecycle::Inactive);
    }

    #[test]
    fn walks_controlled_lifecycle() {
        let mut record = development_validator_record("A");
        record.status = ValidatorStatus::Candidate;
        let (bonded, _) =
            controlled_transition(&record, OperatorLifecycle::Registered, 1, 0, "HUMAN").unwrap();
        let (pending, _) =
            controlled_transition(&bonded, OperatorLifecycle::PendingActivation, 2, 0, "HUMAN")
                .unwrap();
        let (active, _) =
            controlled_transition(&pending, OperatorLifecycle::Active, 10, 1, "HUMAN").unwrap();
        assert_eq!(to_operator_lifecycle(active.status), OperatorLifecycle::Active);
        let (exiting, _) =
            controlled_transition(&active, OperatorLifecycle::Exiting, 11, 1, "HUMAN").unwrap();
        let (inactive, _) =
            controlled_transition(&exiting, OperatorLifecycle::Inactive, 20, 2, "HUMAN").unwrap();
        assert_eq!(to_operator_lifecycle(inactive.status), OperatorLifecycle::Inactive);
    }

    #[test]
    fn ai_cannot_drive_lifecycle_and_mainnet_requires_governance() {
        let record = development_validator_record("A");
        assert_eq!(
            controlled_transition(&record, OperatorLifecycle::Registered, 1, 0, "AI_AGENT")
                .unwrap_err()
                .code(),
            "FORBIDDEN_CONTROLLER"
        );
        assert_eq!(
            refuse_mainnet_activation("MAINNET", false).unwrap_err().code(),
            "MAINNET_ACTIVATION_REQUIRES_GOVERNANCE"
        );
        assert!(refuse_mainnet_activation("TESTNET", false).is_ok());
    }
}
