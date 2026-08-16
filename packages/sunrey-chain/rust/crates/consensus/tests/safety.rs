use sunrey_consensus::{
    app_proposal_from_txs, development_secret, four_validator_set, sign_domain_message, BlockId,
    ConsensusEngine, ConsensusError, ConsensusOutput, ConsensusParams, ConsensusStep, EngineConfig,
    EnginePaths, Evidence, FourValidatorHarness, Height, MemoryApp, Proposal, Round, TimeoutKind,
    ValidatorSet, Vote, VoteType, DOMAIN_PRECOMMIT, DOMAIN_PREVOTE, DOMAIN_PROPOSAL,
};
use sunrey_crypto::{DevEd25519Sha256Suite, SigningSecret};

fn open_single(id: &str, set: ValidatorSet) -> ConsensusEngine<MemoryApp, DevEd25519Sha256Suite> {
    ConsensusEngine::open(
        EngineConfig::development(id),
        DevEd25519Sha256Suite,
        MemoryApp::default(),
        ConsensusParams::development(),
        set,
        Some(development_secret(id)),
        EnginePaths { wal: None, signer: None },
    )
    .unwrap()
}

#[test]
fn conflicting_proposals_same_round_produce_evidence_not_commit() {
    let set = four_validator_set().unwrap();
    let mut honest = open_single("val_b", set.clone());
    let _ = honest.start_round(Round::ZERO).unwrap();
    let mut byz = open_single("val_a", set);
    let outputs = byz.start_round(Round::ZERO).unwrap();
    let first = outputs
        .iter()
        .find_map(|o| match o {
            ConsensusOutput::Proposal(p) => Some((**p).clone()),
            _ => None,
        })
        .unwrap();
    let mut second_value = first.value.clone();
    second_value.transactions = vec![b"equivocate".to_vec()];
    second_value.tx_root = [9u8; 32];
    let second = byz.propose(Height::FIRST, Round::ZERO, second_value);
    assert!(second.is_err(), "signer safety must refuse a second proposal at same H/R");

    let mut forged = first.clone();
    forged.value.transactions = vec![b"other".to_vec()];
    let roots = app_proposal_from_txs(&forged.value.transactions);
    forged.value.tx_root = roots.tx_root;
    forged.value.app_hash_proposal = roots.app_hash_proposal;
    forged.signature = sign_domain_message(
        &DevEd25519Sha256Suite,
        &development_secret("val_a"),
        DOMAIN_PROPOSAL,
        &forged.encode_unsigned(),
    )
    .unwrap();
    let more = honest.receive_proposal(first).unwrap();
    let _ = more;
    let result = honest.receive_proposal(forged).unwrap();
    assert!(result
        .iter()
        .any(|o| matches!(o, ConsensusOutput::Evidence(e) if matches!(**e, Evidence::DoubleProposal { .. }))));
}

#[test]
fn double_vote_is_evidence_and_does_not_count_twice() {
    let set = four_validator_set().unwrap();
    let mut engine = open_single("val_b", set);
    let _ = engine.start_round(Round::ZERO).unwrap();
    let mut vote = Vote {
        vote_type: VoteType::Prevote,
        network_id: engine.config.network_id.clone(),
        chain_id: engine.config.chain_id.clone(),
        protocol_version: engine.config.protocol_version.clone(),
        height: Height::FIRST,
        round: Round::ZERO,
        block_id: BlockId([1u8; 32]),
        validator_id: "val_c".into(),
        validator_set_version: 1,
        signature: Vec::new(),
    };
    vote.signature = sign_domain_message(
        &DevEd25519Sha256Suite,
        &development_secret("val_c"),
        DOMAIN_PREVOTE,
        &vote.encode_unsigned(),
    )
    .unwrap();
    engine.receive_prevote(vote.clone()).unwrap();
    let mut other = vote.clone();
    other.block_id = BlockId([2u8; 32]);
    other.signature = sign_domain_message(
        &DevEd25519Sha256Suite,
        &development_secret("val_c"),
        DOMAIN_PREVOTE,
        &other.encode_unsigned(),
    )
    .unwrap();
    let out = engine.receive_prevote(other).unwrap();
    assert!(out
        .iter()
        .any(|o| matches!(o, ConsensusOutput::Evidence(e) if matches!(**e, Evidence::DoublePrevote { .. }))));
}

#[test]
fn one_third_or_less_cannot_finalize_conflicting_blocks() {
    let mut harness = FourValidatorHarness::open_ephemeral().unwrap();
    let a = harness.drive_until_commit(64).unwrap();
    let mut conflicting = a.clone();
    conflicting.block_id = BlockId([7u8; 32]);
    conflicting.certificate.block_id = BlockId([7u8; 32]);
    for vote in &mut conflicting.certificate.votes {
        vote.block_id = BlockId([7u8; 32]);
    }
    let set = four_validator_set().unwrap();
    assert!(conflicting.certificate.verify(&DevEd25519Sha256Suite, &set).is_err());
}

#[test]
fn locked_validator_does_not_prevote_conflicting_value() {
    let set = four_validator_set().unwrap();
    let mut engine = open_single("val_b", set);
    let _ = engine.start_round(Round::ZERO).unwrap();
    engine.state.locked =
        sunrey_consensus::LockedValue { value: Some(BlockId([3u8; 32])), round: Some(Round::ZERO) };
    engine.state.step = ConsensusStep::Propose;
    engine.state.round = Round::new(1);
    let mut proposal = Proposal {
        value: sunrey_consensus::ProposedValue {
            network_id: engine.config.network_id.clone(),
            chain_id: engine.config.chain_id.clone(),
            protocol_version: engine.config.protocol_version.clone(),
            height: Height::FIRST,
            round: Round::new(1),
            parent: [0u8; 32],
            validator_set_hash: engine.validators.hash(&DevEd25519Sha256Suite),
            validator_set_version: 1,
            consensus_parameter_hash: engine.params.hash(&DevEd25519Sha256Suite),
            proposer: "val_b".into(),
            tx_root: app_proposal_from_txs(&[]).tx_root,
            app_hash_proposal: app_proposal_from_txs(&[]).app_hash_proposal,
            transactions: Vec::new(),
            time_unix_ms: 1,
        },
        pol_round: None,
        signature: Vec::new(),
    };
    proposal.signature = sign_domain_message(
        &DevEd25519Sha256Suite,
        &development_secret("val_b"),
        DOMAIN_PROPOSAL,
        &proposal.encode_unsigned(),
    )
    .unwrap();
    let outputs = engine.receive_proposal(proposal).unwrap();
    let voted_nil = outputs.iter().any(|o| match o {
        ConsensusOutput::Vote(v) => v.vote_type == VoteType::Prevote && v.block_id.is_nil(),
        _ => false,
    });
    assert!(voted_nil, "locked validator must prevote NIL for a conflicting value");
}

#[test]
fn nil_votes_cannot_form_a_commit() {
    let set = four_validator_set().unwrap();
    let err = sunrey_consensus::CommitCertificate::from_votes(
        &DevEd25519Sha256Suite,
        &set,
        Height::FIRST,
        Round::ZERO,
        BlockId::NIL,
        Vec::new(),
    )
    .unwrap_err();
    assert_eq!(err, ConsensusError::NilCommit);
}

#[test]
fn nil_round_advances_without_clearing_locks() {
    let set = four_validator_set().unwrap();
    let mut engine = open_single("val_a", set);
    let _ = engine.start_round(Round::ZERO).unwrap();
    engine.state.locked =
        sunrey_consensus::LockedValue { value: Some(BlockId([4u8; 32])), round: Some(Round::ZERO) };
    let locked = engine.state.locked.clone();
    let _ = engine.on_timeout(TimeoutKind::Precommit, Height::FIRST, Round::ZERO).unwrap();
    assert_eq!(engine.state.round, Round::new(1));
    assert_eq!(engine.state.locked, locked);
}

#[test]
fn signer_safety_refuses_conflicting_precommit() {
    let set = four_validator_set().unwrap();
    let mut engine = open_single("val_a", set);
    let first = engine.precommit(Height::FIRST, Round::ZERO, BlockId([1u8; 32])).unwrap();
    assert_eq!(first.vote_type, VoteType::Precommit);
    let err = engine.precommit(Height::FIRST, Round::ZERO, BlockId([2u8; 32])).unwrap_err();
    assert_eq!(err, ConsensusError::SignerSafetyConflict);
}

#[test]
fn exactly_one_third_is_not_a_quorum() {
    assert!(!sunrey_consensus::exceeds_one_third(1, 3).unwrap());
    assert!(!sunrey_consensus::exceeds_two_thirds(1, 3).unwrap());
    assert!(!sunrey_consensus::exceeds_two_thirds(2, 3).unwrap());
    assert_eq!(sunrey_consensus::max_byzantine_power(3).unwrap(), 0);
    assert_eq!(sunrey_consensus::two_thirds_threshold(3).unwrap(), 3);
}

#[allow(dead_code)]
fn _secret() -> SigningSecret {
    development_secret("unused")
}

#[allow(dead_code)]
fn _precommit_domain() -> &'static str {
    DOMAIN_PRECOMMIT
}
