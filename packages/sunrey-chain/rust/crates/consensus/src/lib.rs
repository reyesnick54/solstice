//! SunRey Tendermint-family BFT consensus engine (development).
//!
//! This crate is an internal module of `packages/sunrey-chain`. It is not a
//! workspace package at `packages/consensus-engine` or `packages/tendermint`.

#![forbid(unsafe_code)]
//!
//! Consensus finalizes protocol blocks. It does not post fiat journals, issue
//! Execution Authority, alter KYC or Consent, mint SunRey Coin or MoonRey,
//! call AI, or call external APIs.
//!
//! See [`ALGORITHM.md`](../ALGORITHM.md) for the lock-rule specification.

mod adapter;
mod app;
mod commit;
mod engine;
mod error;
mod evidence;
mod harness;
mod message;
mod metrics;
mod params;
mod quorum;
mod signer;
mod types;
mod valset;
mod voteset;
mod wal;

pub use adapter::{ConsensusAdapter, ExecutionConsensusAdapter};
pub use app::{
    app_proposal_from_txs, AppProposal, ConsensusApplication, MemoryApp, ProposalContext,
};
pub use commit::{Commit, CommitCertificate, FinalizedBlock};
pub use engine::{ConsensusEngine, ConsensusOutput, EngineConfig, EnginePaths, TimeoutKind};
pub use error::ConsensusError;
pub use evidence::Evidence;
pub use harness::{
    development_secret, four_validator_set, FourValidatorHarness, HarnessNode, HARNESS_VALIDATORS,
};
pub use message::{
    sign_domain_message, verify_domain_message, Proposal, ProposedValue, Vote, DOMAIN_COMMIT,
    DOMAIN_PRECOMMIT, DOMAIN_PREVOTE, DOMAIN_PROPOSAL, PROTOCOL_VERSION,
};
pub use metrics::{ConsensusMetrics, ConsensusMetricsSnapshot};
pub use params::{ConsensusParams, TimeoutConfig};
pub use quorum::{
    exceeds_one_third, exceeds_two_thirds, max_byzantine_power, two_thirds_threshold,
};
pub use signer::{SignerSafetyState, SignerSafetyStore};
pub use types::{
    BlockId, ConsensusStep, Height, LockedValue, ProposalId, Round, RoundState, ValidValue,
    ValidatorId, VoteType,
};
pub use valset::{Validator, ValidatorSet};
pub use voteset::VoteSet;
pub use wal::{ConsensusWal, WalRecord, WalStatusView};

#[cfg(test)]
mod boundary_tests {
    use std::fs;
    use std::path::PathBuf;

    fn rust_sources() -> Vec<PathBuf> {
        let mut out = Vec::new();
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
        walk(&root, &mut out);
        out
    }

    fn walk(dir: &std::path::Path, out: &mut Vec<PathBuf>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    walk(&path, out);
                } else if path.extension().and_then(|e| e.to_str()) == Some("rs") {
                    out.push(path);
                }
            }
        }
    }

    #[test]
    fn consensus_does_not_cross_application_boundary() {
        let forbidden = [
            format!("post{}(", "Journal"),
            format!("Authority{}", "Issuer"),
            format!("LIVE_CHAIN_{}", "ENABLED"),
            format!("MAINNET_{}", "ENABLED"),
            "openai".to_string(),
        ];
        for path in rust_sources() {
            if path.ends_with("lib.rs") {
                continue;
            }
            let source = fs::read_to_string(&path).expect("read");
            for needle in &forbidden {
                assert!(!source.contains(needle), "{} contains {needle}", path.display());
            }
        }
    }
}
