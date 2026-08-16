use sunrey_consensus::{
    exceeds_one_third, exceeds_two_thirds, max_byzantine_power, two_thirds_threshold, BlockId,
    CommitCertificate, Height, Proposal, ProposedValue, Round, Validator, ValidatorSet, Vote,
    VoteSet, VoteType,
};

#[test]
fn proposal_decoder_never_panics_on_arbitrary_bytes() {
    for len in 0..64 {
        let mut data = vec![0u8; len];
        for (i, byte) in data.iter_mut().enumerate() {
            *byte = (i.wrapping_mul(31) as u8).wrapping_add(7);
        }
        let _ = Proposal::decode(&data);
        let _ = ProposedValue::decode(&data);
    }
    let mut growing = Vec::new();
    for byte in 0u8..=32 {
        growing.push(byte.wrapping_mul(17));
        let _ = Proposal::decode(&growing);
    }
}

#[test]
fn vote_decoder_never_panics_on_arbitrary_bytes() {
    for seed in 0u8..40 {
        let data: Vec<u8> = (0..seed).map(|i| i.wrapping_mul(seed)).collect();
        let _ = Vote::decode(&data);
    }
}

#[test]
fn vote_aggregation_sums_unique_power() {
    let set = ValidatorSet::new(
        1,
        vec![
            Validator::new("a", vec![1; 32], 10),
            Validator::new("b", vec![2; 32], 20),
            Validator::new("c", vec![3; 32], 30),
        ],
    )
    .unwrap();
    let mut votes = VoteSet::new(VoteType::Prevote, Height::FIRST, Round::ZERO);
    for (id, power_block) in [("a", [1u8; 32]), ("b", [1u8; 32]), ("c", [2u8; 32])] {
        let vote = Vote {
            vote_type: VoteType::Prevote,
            network_id: "n".into(),
            chain_id: "c".into(),
            protocol_version: "1".into(),
            height: Height::FIRST,
            round: Round::ZERO,
            block_id: BlockId(power_block),
            validator_id: id.into(),
            validator_set_version: 1,
            signature: vec![0],
        };
        let _ = votes.add(vote, &set).unwrap();
    }
    assert_eq!(votes.power_for(BlockId([1u8; 32]), &set).unwrap(), 30);
    assert_eq!(votes.power_for(BlockId([2u8; 32]), &set).unwrap(), 30);
    assert!(!votes.has_two_thirds_for(BlockId([1u8; 32]), &set).unwrap());
}

#[test]
fn quorum_arithmetic_property() {
    for total in 1u64..=256 {
        let threshold = two_thirds_threshold(total).unwrap();
        assert!(exceeds_two_thirds(threshold, total).unwrap());
        if threshold > 0 {
            assert!(!exceeds_two_thirds(threshold - 1, total).unwrap());
        }
        let f = max_byzantine_power(total).unwrap();
        assert!(!exceeds_one_third(f, total).unwrap());
        if f < total {
            let honest = total - f;
            assert!(honest >= threshold || total < 3);
        }
    }
}

#[test]
fn commit_certificate_decoder_never_panics() {
    for len in 0..48 {
        let data: Vec<u8> = (0..len).map(|i| (i * 13) as u8).collect();
        let _ = CommitCertificate::decode(&data);
    }
}

#[test]
fn round_state_transitions_are_monotonic_ranks() {
    use sunrey_consensus::ConsensusStep;
    let order = [
        ConsensusStep::NewHeight,
        ConsensusStep::Propose,
        ConsensusStep::Prevote,
        ConsensusStep::Precommit,
        ConsensusStep::Commit,
        ConsensusStep::Finalized,
    ];
    for window in order.windows(2) {
        assert!(window[0].rank() < window[1].rank());
    }
}
