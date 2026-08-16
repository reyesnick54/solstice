use sha2::{Digest, Sha256};
use sunrey_protocol::{domain_payload, encode_bool, encode_string, encode_u32, encode_u64};

use crate::lifecycle::{assert_controller, assert_separated, transition};
use crate::types::{
    err, Epoch, QueuedChange, QueuedChangeKind, TransitionReceipt, ValidatorError, ValidatorRecord,
    ValidatorSet, ValidatorStatus, DOMAIN_VALSET,
};

pub fn sort_validators(set: &mut ValidatorSet) {
    set.validators.sort_by(|a, b| a.validator_id.cmp(&b.validator_id));
}

pub fn encode_validator_set(set: &ValidatorSet) -> Vec<u8> {
    let mut ordered = set.clone();
    sort_validators(&mut ordered);
    let mut payload = Vec::new();
    encode_u64(&mut payload, ordered.version);
    encode_u32(&mut payload, ordered.validators.len() as u32);
    for validator in &ordered.validators {
        encode_string(&mut payload, &validator.validator_id);
        encode_string(&mut payload, &validator.consensus_public_key.public_key_hex);
        encode_string(&mut payload, &validator.crypto_suite_id);
        encode_u64(&mut payload, validator.voting_power);
        encode_bool(&mut payload, validator.status == ValidatorStatus::Active);
    }
    payload
}

pub fn validator_set_hash(set: &ValidatorSet) -> String {
    let framed = domain_payload(DOMAIN_VALSET, &encode_validator_set(set));
    hex::encode(Sha256::digest(framed))
}

pub fn assert_set_invariants(set: &ValidatorSet) -> Result<(), ValidatorError> {
    let mut seen = Vec::new();
    for validator in &set.validators {
        assert_separated(validator)?;
        if matches!(validator.status, ValidatorStatus::Exited | ValidatorStatus::Tombstoned) {
            continue;
        }
        if seen.iter().any(|key: &String| key == &validator.consensus_public_key.public_key_hex) {
            return Err(err("DUPLICATE_CONSENSUS_KEY", "duplicate active consensus public key"));
        }
        seen.push(validator.consensus_public_key.public_key_hex.clone());
    }
    Ok(())
}

fn apply_change(
    validators: &mut Vec<ValidatorRecord>,
    change: &QueuedChange,
    epoch: &Epoch,
    height: u64,
) -> Result<(), ValidatorError> {
    assert_controller(&change.controller_kind)?;
    match change.kind {
        QueuedChangeKind::AddValidator => {
            let mut record = change
                .record
                .clone()
                .ok_or_else(|| err("UNDEFINED_TRANSITION", "ADD_VALIDATOR requires a record"))?;
            if validators.iter().any(|row| row.validator_id == record.validator_id) {
                return Err(err("UNDEFINED_TRANSITION", "validator already present"));
            }
            record.status = ValidatorStatus::PendingActivation;
            record.activation_epoch = epoch.number;
            assert_separated(&record)?;
            validators.push(record);
        }
        QueuedChangeKind::ActivateValidator
        | QueuedChangeKind::ChangeVotingPower
        | QueuedChangeKind::RotateConsensusKey
        | QueuedChangeKind::ScheduleExit
        | QueuedChangeKind::JailValidator
        | QueuedChangeKind::RestoreEligibleValidator => {
            let index = validators
                .iter()
                .position(|row| row.validator_id == change.validator_id)
                .ok_or_else(|| err("UNDEFINED_TRANSITION", "unknown validator"))?;
            match change.kind {
                QueuedChangeKind::ActivateValidator => {
                    let (next, _) = transition(
                        &validators[index],
                        ValidatorStatus::Active,
                        height,
                        epoch.number,
                    )?;
                    validators[index] = next;
                }
                QueuedChangeKind::ChangeVotingPower => {
                    validators[index].voting_power = change
                        .voting_power
                        .ok_or_else(|| err("FLOATING_POINT_FORBIDDEN", "voting power required"))?;
                    validators[index].updated_height = height;
                }
                QueuedChangeKind::RotateConsensusKey => {
                    let key = change.consensus_public_key.clone().ok_or_else(|| {
                        err("KEY_ROLE_MISMATCH", "rotation requires a new consensus public key")
                    })?;
                    if key.role != "CONSENSUS_VOTING_KEY" {
                        return Err(err(
                            "KEY_ROLE_MISMATCH",
                            "rotated key must be CONSENSUS_VOTING_KEY",
                        ));
                    }
                    let current = validators[index].consensus_public_key.clone();
                    validators[index].historical_consensus_keys.push(current);
                    validators[index].consensus_public_key = key;
                    validators[index].updated_height = height;
                }
                QueuedChangeKind::ScheduleExit => {
                    let (next, _) = transition(
                        &validators[index],
                        ValidatorStatus::PendingExit,
                        height,
                        epoch.number,
                    )?;
                    validators[index] = next;
                }
                QueuedChangeKind::JailValidator => {
                    let (next, _) = transition(
                        &validators[index],
                        ValidatorStatus::Jailed,
                        height,
                        epoch.number,
                    )?;
                    validators[index] = next;
                }
                QueuedChangeKind::RestoreEligibleValidator => {
                    if validators[index].status == ValidatorStatus::Tombstoned {
                        return Err(err(
                            "UNDEFINED_TRANSITION",
                            "tombstoned validators cannot be restored",
                        ));
                    }
                    let (next, _) = transition(
                        &validators[index],
                        ValidatorStatus::Bonded,
                        height,
                        epoch.number,
                    )?;
                    validators[index] = next;
                }
                QueuedChangeKind::AddValidator => unreachable!(),
            }
        }
    }
    Ok(())
}

#[derive(Debug)]
pub struct EpochTransition {
    pub next_validator_set: ValidatorSet,
    pub next_validator_set_hash: String,
    pub transition_receipt: TransitionReceipt,
    pub rejected_changes: Vec<(QueuedChange, String)>,
}

pub fn apply_epoch_boundary(
    current: &ValidatorSet,
    current_epoch: &Epoch,
    next_epoch: &Epoch,
    queued: &[QueuedChange],
    height: u64,
) -> Result<EpochTransition, ValidatorError> {
    if height < current_epoch.end_height {
        return Err(err(
            "ACTIVE_SET_IMMUTABLE",
            "active validator set is immutable during an epoch",
        ));
    }
    if next_epoch.number != current_epoch.number.saturating_add(1) {
        return Err(err(
            "EPOCH_NOT_STARTED",
            "validator changes apply only at the next epoch boundary",
        ));
    }
    let mut validators = current.validators.clone();
    let mut applied = Vec::new();
    let mut rejected = Vec::new();
    for change in queued.iter().filter(|change| change.activation_epoch == next_epoch.number) {
        match apply_change(&mut validators, change, next_epoch, height) {
            Ok(()) => applied.push(change.kind.as_str().to_string()),
            Err(error) => rejected.push((change.clone(), error.to_string())),
        }
    }
    for validator in &mut validators {
        if validator.status == ValidatorStatus::PendingActivation
            && validator.activation_epoch <= next_epoch.number
        {
            if let Ok((next, _)) =
                transition(validator, ValidatorStatus::Active, height, next_epoch.number)
            {
                *validator = next;
            }
        }
        if validator.status == ValidatorStatus::PendingExit {
            if let Some(exit_epoch) = validator.exit_epoch {
                if exit_epoch <= next_epoch.number {
                    if let Ok((next, _)) =
                        transition(validator, ValidatorStatus::Exited, height, next_epoch.number)
                    {
                        *validator = next;
                    }
                }
            }
        }
    }
    let mut next =
        ValidatorSet { version: current.version + 1, epoch: next_epoch.number, validators };
    sort_validators(&mut next);
    assert_set_invariants(&next)?;
    let hash = validator_set_hash(&next);
    Ok(EpochTransition {
        transition_receipt: TransitionReceipt {
            from_version: current.version,
            to_version: next.version,
            from_epoch: current_epoch.number,
            to_epoch: next_epoch.number,
            applied,
            next_validator_set_hash: hash.clone(),
        },
        next_validator_set_hash: hash,
        next_validator_set: next,
        rejected_changes: rejected,
    })
}
