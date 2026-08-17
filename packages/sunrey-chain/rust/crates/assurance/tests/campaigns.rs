use sunrey_assurance::{economic_campaign, signer_safety_sequence, ASSURANCE_SEED};
use sunrey_consensus::FourValidatorHarness;

#[test]
fn required_consensus_campaign() {
    let mut harness = FourValidatorHarness::open_ephemeral().expect("harness");
    harness.set_available("val_d", false);
    let finalized = harness.drive_until_commit(96).expect("3/4 commit");
    assert!(finalized.height.get() >= 1);
    harness.set_available("val_d", true);
    let _ = harness.fire_timeouts();
    signer_safety_sequence(64).expect("restart-safe signer");
}

#[test]
fn required_economic_campaign_thousands() {
    let root = economic_campaign(ASSURANCE_SEED, 2_048).expect("thousands of ops");
    assert_eq!(root.len(), 64);
    let again = economic_campaign(ASSURANCE_SEED, 2_048).expect("deterministic");
    assert_eq!(root, again);
}
