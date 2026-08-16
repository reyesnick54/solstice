use std::path::Path;

use sunrey_consensus::{
    development_secret, four_validator_set, BlockId, ConsensusEngine, ConsensusError,
    ConsensusParams, ConsensusStep, EngineConfig, EnginePaths, FourValidatorHarness, Height,
    MemoryApp, Round, VoteType,
};
use sunrey_crypto::DevEd25519Sha256Suite;
use tempfile::TempDir;

fn reopen(dir: &Path, id: &str) -> ConsensusEngine<MemoryApp, DevEd25519Sha256Suite> {
    ConsensusEngine::open(
        EngineConfig::development(id),
        DevEd25519Sha256Suite,
        MemoryApp::default(),
        ConsensusParams::development(),
        four_validator_set().unwrap(),
        Some(development_secret(id)),
        EnginePaths {
            wal: Some(&dir.join("consensus.wal")),
            signer: Some(&dir.join("signer.bin")),
        },
    )
    .unwrap()
}

#[test]
fn recover_during_propose_refuses_conflicting_proposal() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path().join("val_a");
    {
        let mut engine = reopen(&dir, "val_a");
        let _ = engine.start_round(Round::ZERO).unwrap();
        assert_eq!(engine.state.step, ConsensusStep::Prevote);
    }
    let mut engine = reopen(&dir, "val_a");
    assert!(engine.metrics.snapshot().consensus_wal_recovery >= 1);
    let mut value = sunrey_consensus::ProposedValue {
        network_id: engine.config.network_id.clone(),
        chain_id: engine.config.chain_id.clone(),
        protocol_version: engine.config.protocol_version.clone(),
        height: Height::FIRST,
        round: Round::ZERO,
        parent: [0u8; 32],
        validator_set_hash: engine.validators.hash(&DevEd25519Sha256Suite),
        validator_set_version: 1,
        consensus_parameter_hash: engine.params.hash(&DevEd25519Sha256Suite),
        proposer: "val_a".into(),
        tx_root: [1u8; 32],
        app_hash_proposal: [2u8; 32],
        transactions: vec![b"conflict".to_vec()],
        time_unix_ms: 1,
    };
    value.tx_root = [3u8; 32];
    let err = engine.propose(Height::FIRST, Round::ZERO, value).unwrap_err();
    assert_eq!(err, ConsensusError::SignerSafetyConflict);
}

#[test]
fn recover_during_prevote_refuses_conflicting_prevote() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path().join("val_b");
    let first_id;
    {
        let mut engine = reopen(&dir, "val_b");
        let _ = engine.start_round(Round::ZERO).unwrap();
        let vote = engine.prevote(Height::FIRST, Round::ZERO, BlockId([1u8; 32])).unwrap();
        first_id = vote.block_id;
        assert_eq!(vote.vote_type, VoteType::Prevote);
    }
    let mut engine = reopen(&dir, "val_b");
    let again = engine.prevote(Height::FIRST, Round::ZERO, first_id);
    assert!(again.is_ok(), "same value may be re-signed after crash");
    let err = engine.prevote(Height::FIRST, Round::ZERO, BlockId([9u8; 32])).unwrap_err();
    assert_eq!(err, ConsensusError::SignerSafetyConflict);
}

#[test]
fn recover_during_precommit_refuses_conflicting_precommit() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path().join("val_c");
    {
        let mut engine = reopen(&dir, "val_c");
        let _ = engine.precommit(Height::FIRST, Round::ZERO, BlockId([4u8; 32])).unwrap();
    }
    let mut engine = reopen(&dir, "val_c");
    let err = engine.precommit(Height::FIRST, Round::ZERO, BlockId([5u8; 32])).unwrap_err();
    assert_eq!(err, ConsensusError::SignerSafetyConflict);
}

#[test]
fn recover_before_commit_persistence_can_still_finalize() {
    let tmp = TempDir::new().unwrap();
    let mut harness = FourValidatorHarness::open_with_dirs(Some(tmp.path().to_path_buf())).unwrap();
    let finalized = harness.drive_until_commit(64).unwrap();
    drop(harness);
    let recovered = FourValidatorHarness::open_with_dirs(Some(tmp.path().to_path_buf())).unwrap();
    for node in recovered.nodes.values() {
        assert!(
            node.engine.commits.contains_key(&finalized.height.get())
                || node.engine.state.height.get() >= finalized.height.get(),
            "{} lost commit after restart",
            node.id.as_str()
        );
    }
    let _ = recovered;
}

#[test]
fn recover_after_commit_does_not_revert_height() {
    let tmp = TempDir::new().unwrap();
    let mut harness = FourValidatorHarness::open_with_dirs(Some(tmp.path().to_path_buf())).unwrap();
    let finalized = harness.drive_until_commit(64).unwrap();
    drop(harness);
    let recovered = FourValidatorHarness::open_with_dirs(Some(tmp.path().to_path_buf())).unwrap();
    let a = &recovered.nodes["val_a"].engine;
    assert!(a.commits.contains_key(&finalized.height.get()));
    assert!(a.state.height.get() >= finalized.height.get());
    assert!(a.commits.contains_key(&1), "finalized height 1 must remain after restart");
}
