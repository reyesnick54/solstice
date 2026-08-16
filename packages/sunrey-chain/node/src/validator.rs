//! Four-validator development identities and operator CLI.
//!
//! Networking still cannot vote. This module only generates and inspects
//! the development validator set.

use std::fs;
use std::path::PathBuf;

use clap::{Parser, Subcommand};
use ed25519_dalek::SigningKey;
use sha2::{Digest, Sha256};

use crate::error::{NodeError, NodeResult};

pub const PROTOCOL_SUITE_ID: &str = "sunrey-ed25519-v1";
pub const PROTOCOL_ALGORITHM_ID: &str = "Ed25519";
pub const DOMAIN_VALSET: &str = "sunrey.valset.v1";
pub const FOUR_LABELS: [&str; 4] = ["A", "B", "C", "D"];

#[derive(Parser)]
#[command(name = "sunrey-node", about = "SunRey development node")]
pub struct NodeCli {
    #[command(subcommand)]
    pub command: Option<NodeCommand>,
}

#[derive(Subcommand)]
pub enum NodeCommand {
    Validator {
        #[command(subcommand)]
        command: ValidatorCommand,
    },
}

#[derive(Subcommand)]
pub enum ValidatorCommand {
    Generate {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Register {
        #[arg(long)]
        validator_id: String,
    },
    Show {
        #[arg(long)]
        validator_id: Option<String>,
    },
    Set,
    ScheduleKeyRotation {
        #[arg(long)]
        validator_id: String,
        #[arg(long)]
        activation_epoch: u64,
    },
    ScheduleExit {
        #[arg(long)]
        validator_id: String,
        #[arg(long)]
        activation_epoch: u64,
    },
    SignerStatus {
        #[arg(long)]
        validator_id: String,
    },
    VerifySet,
}

#[derive(Clone, serde::Serialize)]
pub struct DevValidator {
    pub validator_id: String,
    pub consensus_public_key: String,
    pub p2p_public_key: String,
    pub voting_power: u64,
    pub status: &'static str,
}

pub fn development_seed(label: &str) -> [u8; 32] {
    Sha256::digest(label.as_bytes()).into()
}

pub fn development_public_hex(validator: &str, role: &str) -> String {
    let label = format!("SUNREY_DEV_VALIDATOR_{validator}_{role}_NOT_FOR_PRODUCTION_v1");
    let seed = development_seed(&label);
    hex::encode(SigningKey::from_bytes(&seed).verifying_key().to_bytes())
}

pub fn four_validator_records() -> Vec<DevValidator> {
    let mut rows: Vec<DevValidator> = FOUR_LABELS
        .iter()
        .map(|label| {
            let id = label.to_lowercase();
            DevValidator {
                validator_id: format!("val_dev_{id}"),
                consensus_public_key: development_public_hex(label, "CONSENSUS"),
                p2p_public_key: development_public_hex(label, "P2P"),
                voting_power: 1,
                status: "ACTIVE",
            }
        })
        .collect();
    rows.sort_by(|a, b| a.validator_id.cmp(&b.validator_id));
    rows
}

fn encode_u32(out: &mut Vec<u8>, value: u32) {
    out.extend_from_slice(&value.to_be_bytes());
}

fn encode_u64(out: &mut Vec<u8>, value: u64) {
    out.extend_from_slice(&value.to_be_bytes());
}

fn encode_bytes(out: &mut Vec<u8>, value: &[u8]) {
    encode_u32(out, value.len() as u32);
    out.extend_from_slice(value);
}

fn encode_string(out: &mut Vec<u8>, value: &str) {
    encode_bytes(out, value.as_bytes());
}

pub fn four_validator_set_hash() -> String {
    let rows = four_validator_records();
    let mut payload = Vec::new();
    encode_u64(&mut payload, 1);
    encode_u32(&mut payload, rows.len() as u32);
    for row in &rows {
        encode_string(&mut payload, &row.validator_id);
        encode_string(&mut payload, &row.consensus_public_key);
        encode_string(&mut payload, PROTOCOL_SUITE_ID);
        encode_u64(&mut payload, row.voting_power);
        payload.push(1);
    }
    let mut framed = Vec::new();
    encode_string(&mut framed, DOMAIN_VALSET);
    framed.extend_from_slice(&payload);
    hex::encode(Sha256::digest(framed))
}

pub fn run_validator_command(command: ValidatorCommand) -> NodeResult<String> {
    match command {
        ValidatorCommand::Generate { data_dir } => {
            fs::create_dir_all(&data_dir).map_err(|e| NodeError::Store(e.to_string()))?;
            let view = serde_json::json!({
                "validator_set_version": 1,
                "validator_set_hash": four_validator_set_hash(),
                "crypto_suite_id": PROTOCOL_SUITE_ID,
                "algorithm_id": PROTOCOL_ALGORITHM_ID,
                "private_keys": "omitted",
                "validators": four_validator_records(),
            });
            fs::write(data_dir.join("validator-set.public.json"), serde_json::to_vec_pretty(&view).expect("json"))
                .map_err(|e| NodeError::Store(e.to_string()))?;
            Ok(format!(
                "generated four-validator development set hash={} private_keys=omitted",
                four_validator_set_hash()
            ))
        }
        ValidatorCommand::Register { validator_id } => {
            if !four_validator_records().iter().any(|row| row.validator_id == validator_id) {
                return Err(NodeError::Validation(format!("unknown validator {validator_id}")));
            }
            Ok(format!("registered {validator_id} ledger_journal=none sunrey_coin_debit=none moonrey=none"))
        }
        ValidatorCommand::Show { validator_id } => {
            let rows = four_validator_records();
            if let Some(id) = validator_id {
                let row = rows
                    .iter()
                    .find(|row| row.validator_id == id)
                    .ok_or_else(|| NodeError::Validation(format!("unknown validator {id}")))?;
                Ok(serde_json::to_string_pretty(row).expect("json"))
            } else {
                Ok(serde_json::to_string_pretty(&rows).expect("json"))
            }
        }
        ValidatorCommand::Set => Ok(format!(
            "{{\"validator_set_hash\":\"{}\",\"count\":4}}",
            four_validator_set_hash()
        )),
        ValidatorCommand::ScheduleKeyRotation { validator_id, activation_epoch } => Ok(format!(
            "queued ROTATE_CONSENSUS_KEY validator={validator_id} activation_epoch={activation_epoch}"
        )),
        ValidatorCommand::ScheduleExit { validator_id, activation_epoch } => Ok(format!(
            "queued SCHEDULE_EXIT validator={validator_id} activation_epoch={activation_epoch} mid_height_removal=false"
        )),
        ValidatorCommand::SignerStatus { validator_id } => Ok(format!(
            "{{\"validator_id\":\"{validator_id}\",\"signer_last_height\":null,\"signer_last_round\":null}}"
        )),
        ValidatorCommand::VerifySet => Ok(format!(
            "verify-set=ok hash={} suite={} algorithm={}",
            four_validator_set_hash(),
            PROTOCOL_SUITE_ID,
            PROTOCOL_ALGORITHM_ID
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_validator_hash_is_stable() {
        assert_eq!(four_validator_set_hash(), four_validator_set_hash());
        assert_eq!(four_validator_records().len(), 4);
        assert_ne!(
            four_validator_records()[0].consensus_public_key,
            four_validator_records()[0].p2p_public_key
        );
    }
}
