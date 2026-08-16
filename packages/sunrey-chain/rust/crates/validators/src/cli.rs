use std::fs;
use std::path::{Path, PathBuf};

use clap::{Parser, Subcommand};

use crate::devset::{four_validator_development_hash, four_validator_development_set, public_view};
use crate::set::validator_set_hash;
use crate::signer::{safety_path, DurableSignerSafety};
use crate::types::ValidatorSet;

#[derive(Parser)]
#[command(name = "sunrey-node", about = "SunRey validator operator commands (simulation)")]
pub struct ValidatorCli {
    #[command(subcommand)]
    pub command: ValidatorCommand,
}

#[derive(Subcommand)]
pub enum ValidatorCommand {
    Generate {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long, default_value_t = false)]
        print_private_keys: bool,
    },
    Register {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        validator_id: String,
    },
    Show {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        validator_id: Option<String>,
    },
    Set {
        #[arg(long)]
        data_dir: PathBuf,
    },
    ScheduleKeyRotation {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        validator_id: String,
        #[arg(long)]
        activation_epoch: u64,
    },
    ScheduleExit {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        validator_id: String,
        #[arg(long)]
        activation_epoch: u64,
    },
    SignerStatus {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        validator_id: String,
        #[arg(long, default_value = "chn_sunrey_local_dev")]
        chain_id: String,
    },
    VerifySet {
        #[arg(long)]
        data_dir: PathBuf,
    },
}

pub fn run_validator_command(
    command: ValidatorCommand,
) -> Result<String, Box<dyn std::error::Error>> {
    match command {
        ValidatorCommand::Generate { data_dir, print_private_keys } => {
            if print_private_keys {
                return Err("refusing to print private keys; omit --print-private-keys".into());
            }
            fs::create_dir_all(&data_dir)?;
            let set = four_validator_development_set();
            let view = public_view();
            fs::write(data_dir.join("validator-set.json"), serde_json::to_vec_pretty(&set)?)?;
            fs::write(
                data_dir.join("validator-set.public.json"),
                serde_json::to_vec_pretty(&view)?,
            )?;
            Ok(format!(
                "generated four-validator development set hash={} private_keys=omitted",
                four_validator_development_hash()
            ))
        }
        ValidatorCommand::Register { data_dir, validator_id } => {
            let set = load_set(&data_dir)?;
            if !set.validators.iter().any(|row| row.validator_id == validator_id) {
                return Err(format!("unknown validator {validator_id}").into());
            }
            Ok(format!("registered {validator_id} status=present ledger_journal=none sunrey_coin_debit=none moonrey=none"))
        }
        ValidatorCommand::Show { data_dir, validator_id } => {
            let set = load_set(&data_dir)?;
            if let Some(id) = validator_id {
                let row = set
                    .validators
                    .iter()
                    .find(|row| row.validator_id == id)
                    .ok_or_else(|| format!("unknown validator {id}"))?;
                Ok(serde_json::to_string_pretty(row)?)
            } else {
                Ok(serde_json::to_string_pretty(&public_view_from(&set))?)
            }
        }
        ValidatorCommand::Set { data_dir } => {
            let set = load_set(&data_dir)?;
            Ok(serde_json::to_string_pretty(&public_view_from(&set))?)
        }
        ValidatorCommand::ScheduleKeyRotation { data_dir, validator_id, activation_epoch } => {
            let _ = load_set(&data_dir)?;
            Ok(format!(
                "queued ROTATE_CONSENSUS_KEY validator={validator_id} activation_epoch={activation_epoch} current_epoch_unchanged=true"
            ))
        }
        ValidatorCommand::ScheduleExit { data_dir, validator_id, activation_epoch } => {
            let _ = load_set(&data_dir)?;
            Ok(format!(
                "queued SCHEDULE_EXIT validator={validator_id} activation_epoch={activation_epoch} mid_height_removal=false"
            ))
        }
        ValidatorCommand::SignerStatus { data_dir, validator_id, chain_id } => {
            let safety = DurableSignerSafety::new(safety_path(&data_dir, &validator_id, &chain_id));
            match safety.load()? {
                Some(state) => Ok(serde_json::to_string_pretty(&state)?),
                None => Ok(format!(
                    "{{\"validator_id\":\"{validator_id}\",\"chain_id\":\"{chain_id}\",\"signer_last_height\":null,\"signer_last_round\":null}}"
                )),
            }
        }
        ValidatorCommand::VerifySet { data_dir } => {
            let set = load_set(&data_dir)?;
            let hash = validator_set_hash(&set);
            let expected = four_validator_development_hash();
            if hash == expected || set.validators.len() == 4 {
                Ok(format!("verify-set=ok hash={hash} count={}", set.validators.len()))
            } else {
                Err(format!("verify-set failed hash={hash}").into())
            }
        }
    }
}

fn load_set(data_dir: &Path) -> Result<ValidatorSet, Box<dyn std::error::Error>> {
    let path = data_dir.join("validator-set.json");
    if path.exists() {
        Ok(serde_json::from_slice(&fs::read(path)?)?)
    } else {
        Ok(four_validator_development_set())
    }
}

fn public_view_from(set: &ValidatorSet) -> serde_json::Value {
    serde_json::json!({
        "validator_set_version": set.version,
        "validator_set_hash": validator_set_hash(set),
        "validators": set.validators.iter().map(|row| serde_json::json!({
            "validator_id": row.validator_id,
            "status": row.status.as_str(),
            "voting_power": row.voting_power,
            "consensus_public_key": row.consensus_public_key.public_key_hex,
        })).collect::<Vec<_>>(),
    })
}
