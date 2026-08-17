use proptest::prelude::*;
use sunrey_assurance::{
    consensus_vote_properties, decode_protocol_bytes, development_fee, economic_campaign,
    interop_supply_ok, rust_formula, rust_median, rust_mul_div, signer_safety_sequence,
    wallet_auth_threshold, ASSURANCE_SEED,
};
use sunrey_consensus::{BlockId, ConsensusStep, Height, Round};
use sunrey_consensus::{FourValidatorHarness, SignerSafetyStore};
use sunrey_protocol::{BlockHeader, GenesisV1, SignedTransaction, UnsignedTransaction};

proptest! {
    #![proptest_config(ProptestConfig { cases: 32, ..ProptestConfig::default() })]

    #[test]
    fn protocol_decoders_never_panic(bytes in prop::collection::vec(any::<u8>(), 0..512)) {
        decode_protocol_bytes(&bytes);
        let _ = UnsignedTransaction::decode(&bytes);
        let _ = SignedTransaction::decode(&bytes);
        let _ = BlockHeader::decode(&bytes);
        let _ = GenesisV1::decode(&bytes);
    }

    #[test]
    fn fee_calculate_is_finite(encoded in 0u128..8_000u128, sigs in 1u128..8u128) {
        let fee = development_fee(encoded, sigs).expect("fee");
        prop_assert!(fee >= 100);
    }

    #[test]
    fn mul_div_floor_le_ceil(value in 0u128..10_000, num in 0u128..1_000_000, den in 1u128..1_000_000) {
        let floor = rust_mul_div(value, num, den, "FLOOR");
        let ceil = rust_mul_div(value, num, den, "CEIL");
        prop_assert!(floor <= ceil);
    }

    #[test]
    fn formula_respects_cap(
        eligible in 1u128..5_000,
        category in 1u128..1_000_000,
        claim in 1u128..1_000_000,
        quality in 1u128..1_000_000,
        maximum in 1u128..2_000
    ) {
        let (uncapped, moonrey) = rust_formula(eligible, category, claim, quality, "FLOOR", maximum);
        let uncapped_n: u128 = uncapped.parse().unwrap();
        let moonrey_n: u128 = moonrey.parse().unwrap();
        prop_assert!(moonrey_n <= uncapped_n);
        prop_assert!(moonrey_n <= maximum);
    }

    #[test]
    fn median_order_independent(mut values in prop::collection::vec(1u64..500, 1..8)) {
        let first = rust_median(&values);
        values.reverse();
        prop_assert_eq!(first, rust_median(&values));
    }

    #[test]
    fn wallet_threshold_holds(threshold in 1u32..4, presented in 0u32..5) {
        wallet_auth_threshold(threshold, presented.min(5), false).expect("auth");
    }
}

#[test]
fn consensus_and_interop_invariants() {
    consensus_vote_properties().expect("votes");
    signer_safety_sequence(48).expect("signer");
    interop_supply_ok().expect("interop");
    let mut store = SignerSafetyStore::in_memory();
    store
        .authorize(Height::new(1), Round::new(0), ConsensusStep::Precommit, BlockId([1; 32]))
        .unwrap();
    assert!(store
        .authorize(Height::new(1), Round::new(0), ConsensusStep::Precommit, BlockId([2; 32]))
        .is_err());
}

#[test]
fn economic_campaign_reconciles() {
    let root = economic_campaign(ASSURANCE_SEED, 128).expect("campaign");
    assert_eq!(root.len(), 64);
}

#[test]
fn four_validator_harness_finalizes() {
    let mut harness = FourValidatorHarness::open_ephemeral().expect("harness");
    let finalized = harness.drive_until_commit(64).expect("commit");
    assert_eq!(finalized.height.get(), 1);
}
