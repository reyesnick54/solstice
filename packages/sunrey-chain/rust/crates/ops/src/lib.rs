//! Development resilience helpers. Not a second ledger or consensus engine.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

pub const DEVELOPMENT_CHAIN_ID: &str = "chn_sunrey_local_dev";

#[derive(Debug, Error, PartialEq, Eq)]
pub enum OpsError {
    #[error("voting-power concentration allows a single failure domain to finalize")]
    VotingPowerConcentration,
    #[error("tampered snapshot rejected")]
    TamperedSnapshot,
    #[error("wrong-chain backup rejected")]
    WrongChain,
    #[error("two active signers rejected by fencing")]
    DualActiveSigner,
    #[error("stale signer-safety restore rejected")]
    StaleSignerSafety,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ValidatorPlacement {
    pub validator_id: String,
    pub domain_id: String,
    pub voting_power: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SnapshotManifest {
    pub snapshot_id: String,
    pub chain_id: String,
    pub network: String,
    pub height: u64,
    pub block_id: String,
    pub state_root: String,
    pub storage_schema: u32,
    pub protocol_version: String,
    pub state_sha256: String,
    pub manifest_sha256: String,
    pub hash_manifest: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignerFence {
    pub validator_id: String,
    pub active_site: String,
    pub passive_site: String,
}

pub fn seven_validator_placements() -> Vec<ValidatorPlacement> {
    vec![
        placement("val_dev_1", "fd_alpha", 1),
        placement("val_dev_2", "fd_alpha", 1),
        placement("val_dev_3", "fd_alpha", 1),
        placement("val_dev_4", "fd_bravo", 1),
        placement("val_dev_5", "fd_bravo", 1),
        placement("val_dev_6", "fd_charlie", 1),
        placement("val_dev_7", "fd_charlie", 1),
    ]
}

fn placement(validator_id: &str, domain_id: &str, voting_power: u64) -> ValidatorPlacement {
    ValidatorPlacement {
        validator_id: validator_id.to_string(),
        domain_id: domain_id.to_string(),
        voting_power,
    }
}

pub fn two_thirds_plus(total: u64) -> u64 {
    (total * 2) / 3 + 1
}

pub fn assert_no_independent_finality(rows: &[ValidatorPlacement]) -> Result<(), OpsError> {
    let total: u64 = rows.iter().map(|row| row.voting_power).sum();
    let threshold = two_thirds_plus(total);
    let mut by_domain = std::collections::BTreeMap::<&str, u64>::new();
    for row in rows {
        *by_domain.entry(&row.domain_id).or_default() += row.voting_power;
    }
    if by_domain.len() < 3 || by_domain.values().any(|power| *power >= threshold) {
        return Err(OpsError::VotingPowerConcentration);
    }
    Ok(())
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

pub fn create_snapshot(
    state: &[u8],
    height: u64,
    block_id: &str,
    state_root: &str,
) -> SnapshotManifest {
    let state_sha256 = sha256_hex(state);
    let mut manifest = SnapshotManifest {
        snapshot_id: format!("snap_{height}"),
        chain_id: DEVELOPMENT_CHAIN_ID.to_string(),
        network: "net_sunrey_local_dev".to_string(),
        height,
        block_id: block_id.to_string(),
        state_root: state_root.to_string(),
        storage_schema: 1,
        protocol_version: "1".to_string(),
        state_sha256,
        manifest_sha256: String::new(),
        hash_manifest: String::new(),
    };
    let hashed = manifest_hash(&manifest);
    manifest.manifest_sha256 = hashed.clone();
    manifest.hash_manifest = hashed;
    manifest
}

fn manifest_hash(manifest: &SnapshotManifest) -> String {
    sha256_hex(
        format!(
            "{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}",
            manifest.snapshot_id,
            manifest.chain_id,
            manifest.network,
            manifest.height,
            manifest.block_id,
            manifest.state_root,
            manifest.storage_schema,
            manifest.protocol_version,
            manifest.state_sha256
        )
        .as_bytes(),
    )
}

pub fn verify_snapshot(
    manifest: &SnapshotManifest,
    state: &[u8],
    expected_chain: &str,
) -> Result<(), OpsError> {
    if manifest.chain_id != expected_chain {
        return Err(OpsError::WrongChain);
    }
    if sha256_hex(state) != manifest.state_sha256
        || manifest_hash(manifest) != manifest.manifest_sha256
    {
        return Err(OpsError::TamperedSnapshot);
    }
    Ok(())
}

pub fn activate_passive(
    fence: &SignerFence,
    already_active: &str,
) -> Result<SignerFence, OpsError> {
    if already_active == fence.passive_site && already_active == fence.active_site {
        return Err(OpsError::DualActiveSigner);
    }
    if already_active == fence.passive_site {
        return Err(OpsError::DualActiveSigner);
    }
    Ok(SignerFence {
        validator_id: fence.validator_id.clone(),
        active_site: fence.passive_site.clone(),
        passive_site: fence.active_site.clone(),
    })
}

pub fn reject_stale_watermark(backup: u64, known: u64) -> Result<(), OpsError> {
    if backup < known {
        return Err(OpsError::StaleSignerSafety);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seven_validators_have_no_independent_finality() {
        let rows = seven_validator_placements();
        assert_eq!(rows.len(), 7);
        assert_eq!(assert_no_independent_finality(&rows), Ok(()));
        let bad = vec![
            placement("val_dev_1", "fd_alpha", 5),
            placement("val_dev_2", "fd_bravo", 1),
            placement("val_dev_3", "fd_charlie", 1),
        ];
        assert_eq!(assert_no_independent_finality(&bad), Err(OpsError::VotingPowerConcentration));
    }

    #[test]
    fn snapshot_rejects_tamper_and_wrong_chain() {
        let state = b"{\"height\":1}";
        let manifest = create_snapshot(state, 1, "block", "root");
        assert_eq!(verify_snapshot(&manifest, state, DEVELOPMENT_CHAIN_ID), Ok(()));
        let mut tampered = manifest.clone();
        tampered.state_root = "other".to_string();
        assert_eq!(
            verify_snapshot(&tampered, state, DEVELOPMENT_CHAIN_ID),
            Err(OpsError::TamperedSnapshot)
        );
        assert_eq!(verify_snapshot(&manifest, state, "chn_other"), Err(OpsError::WrongChain));
    }

    #[test]
    fn fencing_rejects_two_active_signers_and_stale_restore() {
        let fence = SignerFence {
            validator_id: "val_dev_1".to_string(),
            active_site: "site_a".to_string(),
            passive_site: "site_b".to_string(),
        };
        let next = activate_passive(&fence, "site_a").expect("fence");
        assert_eq!(next.active_site, "site_b");
        assert_eq!(activate_passive(&fence, "site_b"), Err(OpsError::DualActiveSigner));
        assert_eq!(reject_stale_watermark(3, 9), Err(OpsError::StaleSignerSafety));
        assert_eq!(reject_stale_watermark(9, 9), Ok(()));
    }
}
