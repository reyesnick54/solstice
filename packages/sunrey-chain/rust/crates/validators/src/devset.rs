use ed25519_dalek::SigningKey;
use sha2::{Digest, Sha256};

use crate::set::{sort_validators, validator_set_hash};
use crate::types::{
    BondDescriptor, PublicKeyRef, ValidatorRecord, ValidatorSet, ValidatorStatus,
    PROTOCOL_SUITE_ID, SCHEMA_VERSION,
};

pub const FOUR_VALIDATOR_LABELS: [&str; 4] = ["A", "B", "C", "D"];

pub fn development_key_label(validator: &str, role: &str) -> String {
    format!("SUNREY_DEV_VALIDATOR_{validator}_{role}_NOT_FOR_PRODUCTION_v1")
}

pub fn development_seed_from_label(label: &str) -> [u8; 32] {
    Sha256::digest(label.as_bytes()).into()
}

fn public_from_label(validator: &str, role: &str, purpose: &str, key_role: &str) -> PublicKeyRef {
    let seed = development_seed_from_label(&development_key_label(validator, role));
    let public = SigningKey::from_bytes(&seed).verifying_key().to_bytes();
    PublicKeyRef {
        role: key_role.to_string(),
        purpose: purpose.to_string(),
        public_key_hex: hex::encode(public),
        key_id: format!("dev:{}:{}", validator.to_lowercase(), role.to_lowercase()),
        suite_id: PROTOCOL_SUITE_ID.to_string(),
    }
}

pub fn development_validator_record(label: &str) -> ValidatorRecord {
    let id = label.to_lowercase();
    ValidatorRecord {
        validator_id: format!("val_dev_{id}"),
        operator_actor_id: format!("actor.human.operator.{id}"),
        controller_kind: "HUMAN".into(),
        legal_entity_ref: Some(format!("le.dev.validator.{id}")),
        consensus_public_key: public_from_label(
            label,
            "CONSENSUS",
            "VALIDATOR_CONSENSUS_SIGNING",
            "CONSENSUS_VOTING_KEY",
        ),
        crypto_suite_id: PROTOCOL_SUITE_ID.to_string(),
        p2p_node_id: format!("node_dev_{id}"),
        p2p_public_key: public_from_label(label, "P2P", "P2P_IDENTITY", "P2P_NODE_KEY"),
        governance_public_key: public_from_label(
            label,
            "GOVERNANCE",
            "GOVERNANCE_SIGNING",
            "GOVERNANCE_KEY",
        ),
        recovery_key_ref: public_from_label(
            label,
            "RECOVERY",
            "ATTESTATION_SIGNING",
            "RECOVERY_KEY",
        ),
        reward_address: None,
        bond_descriptor: BondDescriptor::simulation(1),
        voting_power: 1,
        status: ValidatorStatus::Active,
        activation_epoch: 0,
        exit_epoch: None,
        jurisdiction_metadata: "SIM:DEV".into(),
        protocol_metadata: "chunk-36-four-validator-devset".into(),
        created_height: 0,
        updated_height: 0,
        schema_version: SCHEMA_VERSION,
        historical_consensus_keys: Vec::new(),
    }
}

pub fn four_validator_development_set() -> ValidatorSet {
    let mut set = ValidatorSet {
        version: 1,
        epoch: 0,
        validators: FOUR_VALIDATOR_LABELS
            .iter()
            .map(|label| development_validator_record(label))
            .collect(),
    };
    sort_validators(&mut set);
    set
}

pub fn four_validator_development_hash() -> String {
    validator_set_hash(&four_validator_development_set())
}

pub fn public_view() -> serde_json::Value {
    let set = four_validator_development_set();
    serde_json::json!({
        "validator_set_version": set.version,
        "validator_set_hash": validator_set_hash(&set),
        "crypto_suite_id": PROTOCOL_SUITE_ID,
        "algorithm_id": sunrey_crypto::PROTOCOL_ALGORITHM_ID,
        "validators": set.validators.iter().map(|row| serde_json::json!({
            "validator_id": row.validator_id,
            "consensus_public_key": row.consensus_public_key.public_key_hex,
            "p2p_node_id": row.p2p_node_id,
            "voting_power": row.voting_power,
            "status": row.status.as_str(),
            "bond": row.bond_descriptor.kind.as_str(),
        })).collect::<Vec<_>>(),
    })
}
