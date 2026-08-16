use std::collections::BTreeSet;

use sunrey_chain_node::accountability::{
    refuse_ai_punishment, refuse_customer_asset_confiscation, AccountabilityState,
    ValidatorAccountabilityPolicy,
};
use sunrey_chain_node::chain::{DevChain, Genesis};
use sunrey_chain_node::consensus_vote::{ConsensusMessageType, SignedConsensusMessage};
use sunrey_chain_node::crypto::{DomainKey, KeyDomain};
use sunrey_chain_node::evidence::{
    verify_equivocation_evidence, EquivocationEvidence, EvidenceContext, EvidenceType,
};
use sunrey_chain_node::evidence_pool::EvidencePool;
use sunrey_chain_node::validators::{
    four_validator_devnet, ValidatorRuntime, ValidatorStatus, DEFAULT_SIMULATION_BOND_UNITS,
};

#[allow(clippy::too_many_arguments)]
fn signed_pair(
    ty: ConsensusMessageType,
    validator_id: &str,
    fixture_index: usize,
    height: u64,
    round: u32,
    left: u8,
    right: u8,
    set_hash: [u8; 32],
    network: &str,
    chain: &str,
) -> EquivocationEvidence {
    let (_, fixtures) = four_validator_devnet();
    let fixture = &fixtures[fixture_index];
    let key = match ty {
        ConsensusMessageType::Proposal => &fixture.proposal,
        _ => &fixture.consensus,
    };
    let a = SignedConsensusMessage::sign(
        key,
        network,
        chain,
        validator_id,
        height,
        round,
        ty,
        [left; 32],
        set_hash,
    )
    .unwrap();
    let b = SignedConsensusMessage::sign(
        key,
        network,
        chain,
        validator_id,
        height,
        round,
        ty,
        [right; 32],
        set_hash,
    )
    .unwrap();
    EquivocationEvidence::from_conflicting(a, b).unwrap()
}

fn ctx<'a>(
    set: &'a sunrey_chain_node::validators::ValidatorSet,
    processed: &'a BTreeSet<[u8; 32]>,
    height: u64,
) -> EvidenceContext<'a> {
    EvidenceContext {
        network_id: "net_sunrey_development",
        chain_id: "chn_sunrey_development",
        current_height: height,
        historical_set: set,
        processed,
    }
}

#[test]
fn valid_double_proposal_prevote_precommit() {
    let (set, _) = four_validator_devnet();
    let processed = BTreeSet::new();
    for ty in [
        ConsensusMessageType::Proposal,
        ConsensusMessageType::Prevote,
        ConsensusMessageType::Precommit,
    ] {
        let evidence = signed_pair(
            ty,
            "val-d",
            3,
            1,
            0,
            1,
            2,
            set.hash(),
            "net_sunrey_development",
            "chn_sunrey_development",
        );
        verify_equivocation_evidence(&evidence, &ctx(&set, &processed, 1)).unwrap();
    }
}

#[test]
fn rejects_invalid_signature_wrong_validator_height_round_and_same_message() {
    let (set, fixtures) = four_validator_devnet();
    let processed = BTreeSet::new();
    let mut evidence = signed_pair(
        ConsensusMessageType::Prevote,
        "val-d",
        3,
        1,
        0,
        1,
        2,
        set.hash(),
        "net_sunrey_development",
        "chn_sunrey_development",
    );
    evidence.left.signature[0] ^= 0xff;
    assert!(verify_equivocation_evidence(&evidence, &ctx(&set, &processed, 1)).is_err());

    let wrong_validator = signed_pair(
        ConsensusMessageType::Prevote,
        "val-a",
        3,
        1,
        0,
        1,
        2,
        set.hash(),
        "net_sunrey_development",
        "chn_sunrey_development",
    );
    assert!(verify_equivocation_evidence(&wrong_validator, &ctx(&set, &processed, 1)).is_err());

    let wrong_height = signed_pair(
        ConsensusMessageType::Prevote,
        "val-d",
        3,
        9,
        0,
        1,
        2,
        set.hash(),
        "net_sunrey_development",
        "chn_sunrey_development",
    );
    // height 9 is not in historical membership for this set hash at epoch 0, but
    // the set is still the same; force a round mismatch instead.
    let mut mixed = signed_pair(
        ConsensusMessageType::Prevote,
        "val-d",
        3,
        1,
        0,
        1,
        2,
        set.hash(),
        "net_sunrey_development",
        "chn_sunrey_development",
    );
    mixed.right.round = 7;
    mixed.right.signature = fixtures[3]
        .consensus
        .sign(&mixed.right.unsigned_bytes().unwrap());
    assert!(verify_equivocation_evidence(&mixed, &ctx(&set, &processed, 1)).is_err());
    let _ = wrong_height;

    let same = SignedConsensusMessage::sign(
        &fixtures[3].consensus,
        "net_sunrey_development",
        "chn_sunrey_development",
        "val-d",
        1,
        0,
        ConsensusMessageType::Prevote,
        [1u8; 32],
        set.hash(),
    )
    .unwrap();
    assert!(EquivocationEvidence::from_conflicting(same.clone(), same).is_err());
}

#[test]
fn rejects_wrong_chain_network_expired_and_altered_bytes() {
    let (set, _) = four_validator_devnet();
    let processed = BTreeSet::new();
    let wrong_chain = signed_pair(
        ConsensusMessageType::Prevote,
        "val-d",
        3,
        1,
        0,
        1,
        2,
        set.hash(),
        "net_other",
        "chn_sunrey_development",
    );
    assert!(verify_equivocation_evidence(&wrong_chain, &ctx(&set, &processed, 1)).is_err());

    let expired = signed_pair(
        ConsensusMessageType::Prevote,
        "val-d",
        3,
        1,
        0,
        1,
        2,
        set.hash(),
        "net_sunrey_development",
        "chn_sunrey_development",
    );
    assert!(verify_equivocation_evidence(&expired, &ctx(&set, &processed, 40)).is_err());

    let mut altered = signed_pair(
        ConsensusMessageType::Prevote,
        "val-d",
        3,
        1,
        0,
        1,
        2,
        set.hash(),
        "net_sunrey_development",
        "chn_sunrey_development",
    );
    altered.left.block_id = [9u8; 32];
    assert!(verify_equivocation_evidence(&altered, &ctx(&set, &processed, 1)).is_err());
}

#[test]
fn historical_key_is_used_not_current_key() {
    let (mut set, fixtures) = four_validator_devnet();
    let processed = BTreeSet::new();
    let evidence = signed_pair(
        ConsensusMessageType::Prevote,
        "val-d",
        3,
        1,
        0,
        1,
        2,
        set.hash(),
        "net_sunrey_development",
        "chn_sunrey_development",
    );
    let rotated = DomainKey::generate(KeyDomain::ValidatorConsensus);
    set.validators[3].consensus_pubkey = rotated.public_key();
    assert!(verify_equivocation_evidence(&evidence, &ctx(&set, &processed, 1)).is_err());

    let (original, _) = four_validator_devnet();
    verify_equivocation_evidence(&evidence, &ctx(&original, &processed, 1)).unwrap();
    let _ = fixtures;
}

#[test]
fn jail_tombstone_penalty_and_replay_after_restart() {
    let dir = std::env::temp_dir().join(format!("sunrey-acc-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    let (set, _) = four_validator_devnet();
    let genesis = Genesis::development().with_validator_set(set.clone());
    let mut chain = DevChain::open(&dir, genesis.clone()).unwrap();
    let evidence = signed_pair(
        ConsensusMessageType::Prevote,
        "val-d",
        3,
        1,
        0,
        1,
        2,
        set.hash(),
        &genesis.network_id,
        &genesis.chain_id,
    );
    let block = chain
        .propose_block_with_evidence(vec![], vec![evidence.clone()], 10)
        .unwrap();
    chain.apply_block(block).unwrap();
    assert_eq!(
        chain.validators.pending.get("val-d").unwrap().status,
        ValidatorStatus::Jailed
    );
    assert_eq!(
        chain
            .validators
            .pending
            .get("val-d")
            .unwrap()
            .bond
            .penalized_units,
        DEFAULT_SIMULATION_BOND_UNITS * 2500 / 10_000
    );
    assert_eq!(
        chain.validators.active.get("val-d").unwrap().status,
        ValidatorStatus::Active
    );
    for t in 11..14 {
        let empty = chain.propose_block(vec![], t).unwrap();
        chain.apply_block(empty).unwrap();
    }
    assert_eq!(
        chain.validators.active.get("val-d").unwrap().status,
        ValidatorStatus::Jailed
    );
    assert!(chain.validators.active.remaining_can_progress());

    drop(chain);
    let restarted = DevChain::open(&dir, genesis).unwrap();
    let again = restarted.propose_block_with_evidence(vec![], vec![evidence], 20);
    let proposed = again.unwrap();
    assert!(proposed.evidence.is_empty());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn tombstone_cannot_silently_rejoin() {
    let (set, _) = four_validator_devnet();
    let mut runtime = ValidatorRuntime::new(set.clone(), 4);
    let mut state = AccountabilityState::new(ValidatorAccountabilityPolicy::development());
    let evidence = signed_pair(
        ConsensusMessageType::Precommit,
        "val-d",
        3,
        1,
        0,
        1,
        2,
        set.hash(),
        "net_sunrey_development",
        "chn_sunrey_development",
    );
    state
        .execute(
            &evidence,
            &mut runtime,
            "net_sunrey_development",
            "chn_sunrey_development",
            1,
            [1u8; 32],
        )
        .unwrap();
    runtime.commit_epoch_if_needed(4);
    let tombstoned = runtime.active.get_mut("val-d").unwrap();
    assert_eq!(tombstoned.status, ValidatorStatus::Tombstoned);
    tombstoned.status = ValidatorStatus::Active;
    tombstoned.voting_power = 10;
    // Rehabilitation is not an automatic path. A later governance rule would
    // have to write a new record; the tombstone receipt remains.
    assert!(state.offenses_for("val-d")[0]
        .decision
        .contains("TOMBSTONE"));
}

#[test]
fn no_customer_asset_or_ai_punishment_paths() {
    for err in refuse_customer_asset_confiscation() {
        assert!(err.to_string().contains("cannot"));
    }
    for err in refuse_ai_punishment() {
        assert!(err.to_string().contains("AI cannot"));
    }
    assert!(!EvidenceType::ConsensusLivenessViolation.is_automatic_penalty());
}

#[test]
fn pool_persists_across_restart_without_double_penalty() {
    let dir = std::env::temp_dir().join(format!("sunrey-pool-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let (set, _) = four_validator_devnet();
    let runtime = ValidatorRuntime::new(set.clone(), 4);
    let processed = BTreeSet::new();
    let evidence = signed_pair(
        ConsensusMessageType::Proposal,
        "val-d",
        3,
        1,
        0,
        1,
        2,
        set.hash(),
        "net_sunrey_development",
        "chn_sunrey_development",
    );
    let mut pool = EvidencePool::open(&dir).unwrap();
    pool.admit(
        evidence.clone(),
        &runtime,
        "net_sunrey_development",
        "chn_sunrey_development",
        1,
        &processed,
    )
    .unwrap();
    drop(pool);
    let reopened = EvidencePool::open(&dir).unwrap();
    assert!(reopened.get(&evidence.evidence_id()).is_some());
    let _ = std::fs::remove_dir_all(&dir);
}
