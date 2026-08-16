use crate::types::{err, ValidatorError, ValidatorRecord, ValidatorStatus};

pub fn allowed_transitions(from: ValidatorStatus) -> &'static [ValidatorStatus] {
    match from {
        ValidatorStatus::Candidate => &[ValidatorStatus::Bonded],
        ValidatorStatus::Bonded => &[ValidatorStatus::PendingActivation, ValidatorStatus::Jailed],
        ValidatorStatus::PendingActivation => &[ValidatorStatus::Active, ValidatorStatus::Jailed],
        ValidatorStatus::Active => &[ValidatorStatus::PendingExit, ValidatorStatus::Jailed],
        ValidatorStatus::PendingExit => &[ValidatorStatus::Exited, ValidatorStatus::Jailed],
        ValidatorStatus::Jailed => &[ValidatorStatus::Tombstoned, ValidatorStatus::Bonded],
        ValidatorStatus::Tombstoned | ValidatorStatus::Exited => &[],
    }
}

pub fn transition(
    record: &ValidatorRecord,
    to: ValidatorStatus,
    height: u64,
    epoch: u64,
) -> Result<(ValidatorRecord, &'static str), ValidatorError> {
    if !allowed_transitions(record.status).contains(&to) {
        return Err(err(
            "UNDEFINED_TRANSITION",
            format!("undefined validator transition {:?} -> {:?}", record.status, to),
        ));
    }
    let reason = match (record.status, to) {
        (ValidatorStatus::Candidate, ValidatorStatus::Bonded) => "BOND_ACCEPTED",
        (ValidatorStatus::Bonded, ValidatorStatus::PendingActivation) => "QUEUED_FOR_EPOCH",
        (ValidatorStatus::PendingActivation, ValidatorStatus::Active) => "EPOCH_BOUNDARY_ACTIVATE",
        (ValidatorStatus::Active, ValidatorStatus::PendingExit) => "EXIT_SCHEDULED",
        (ValidatorStatus::PendingExit, ValidatorStatus::Exited) => "EPOCH_BOUNDARY_EXIT",
        (_, ValidatorStatus::Jailed) => "JAIL_EVIDENCE",
        (ValidatorStatus::Jailed, ValidatorStatus::Tombstoned) => "TOMBSTONE_EQUIVOCATION",
        (ValidatorStatus::Jailed, ValidatorStatus::Bonded) => "RESTORE_ELIGIBLE",
        _ => return Err(err("UNDEFINED_TRANSITION", "missing reason code")),
    };
    let mut next = record.clone();
    next.status = to;
    next.updated_height = height;
    if to == ValidatorStatus::PendingExit {
        next.exit_epoch = Some(epoch.saturating_add(1));
    }
    if to == ValidatorStatus::Exited {
        next.exit_epoch = Some(epoch);
    }
    Ok((next, reason))
}

pub fn assert_controller(kind: &str) -> Result<(), ValidatorError> {
    if crate::types::FORBIDDEN_CONTROLLERS.contains(&kind) {
        return Err(err(
            "FORBIDDEN_CONTROLLER",
            format!("{kind} cannot control a validator, cast a vote, or alter the validator set"),
        ));
    }
    if !crate::types::PERMITTED_CONTROLLERS.contains(&kind) {
        return Err(err(
            "FORBIDDEN_CONTROLLER",
            format!("{kind} is not a permitted validator controller"),
        ));
    }
    Ok(())
}

pub fn assert_consensus_purpose(purpose: &str) -> Result<(), ValidatorError> {
    if crate::types::FORBIDDEN_CONSENSUS_PURPOSES.contains(&purpose) {
        return Err(err(
            "FORBIDDEN_KEY_PURPOSE",
            format!("{purpose} cannot be a validator consensus voting key"),
        ));
    }
    if purpose != "VALIDATOR_CONSENSUS_SIGNING" {
        return Err(err(
            "KEY_ROLE_MISMATCH",
            "consensus key purpose must be VALIDATOR_CONSENSUS_SIGNING",
        ));
    }
    Ok(())
}

pub fn assert_separated(record: &ValidatorRecord) -> Result<(), ValidatorError> {
    assert_consensus_purpose(&record.consensus_public_key.purpose)?;
    if record.consensus_public_key.role != "CONSENSUS_VOTING_KEY"
        || record.p2p_public_key.role != "P2P_NODE_KEY"
        || record.governance_public_key.role != "GOVERNANCE_KEY"
        || record.recovery_key_ref.role != "RECOVERY_KEY"
    {
        return Err(err("KEY_ROLE_MISMATCH", "validator key roles are incorrect"));
    }
    let ids = [
        record.consensus_public_key.key_id.as_str(),
        record.p2p_public_key.key_id.as_str(),
        record.governance_public_key.key_id.as_str(),
        record.recovery_key_ref.key_id.as_str(),
    ];
    let mut unique = ids.to_vec();
    unique.sort_unstable();
    unique.dedup();
    if unique.len() != ids.len() {
        return Err(err("UNIVERSAL_VALIDATOR_KEY", "validator keys must be distinct"));
    }
    Ok(())
}
