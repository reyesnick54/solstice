use sunrey_consensus::{
    four_validator_set, ConsensusStep, FourValidatorHarness, Height, HARNESS_VALIDATORS,
};

#[test]
fn four_validators_propose_prevote_precommit_commit() {
    let mut harness = FourValidatorHarness::open_ephemeral().unwrap();
    let finalized = harness.drive_until_commit(64).unwrap();
    assert_eq!(finalized.height, Height::FIRST);
    assert!(!finalized.block_id.is_nil());
    finalized
        .certificate
        .verify(&sunrey_crypto::DevEd25519Sha256Suite, &four_validator_set().unwrap())
        .unwrap();
    let committed =
        harness.nodes.values().filter(|node| node.engine.last_finalized.is_some()).count();
    assert!(committed >= 3, "at least a 2/3 quorum must finalize");
    for node in harness.nodes.values() {
        if node.engine.last_finalized.is_some() {
            assert_eq!(node.engine.state.step, ConsensusStep::Finalized);
        }
    }
}

#[test]
fn three_of_four_still_finalize_when_d_unavailable() {
    let mut harness = FourValidatorHarness::open_ephemeral().unwrap();
    harness.set_available("val_d", false);
    let finalized = harness.drive_until_commit(64).unwrap();
    assert_eq!(finalized.height, Height::FIRST);
    assert!(harness.nodes["val_d"].engine.last_finalized.is_none());
    for id in ["val_a", "val_b", "val_c"] {
        assert!(harness.nodes[id].engine.last_finalized.is_some(), "{id} should finalize");
    }
}

#[test]
fn first_proposer_is_val_a() {
    let set = four_validator_set().unwrap();
    assert_eq!(
        set.select_proposer(Height::FIRST, sunrey_consensus::Round::ZERO).unwrap().as_str(),
        "val_a"
    );
    assert_eq!(HARNESS_VALIDATORS.len(), 4);
}
