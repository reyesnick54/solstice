use sunrey_interop::asset::{InteropAssetLedger, DEV_INTEROP_TEST_ASSET};
use sunrey_interop::encoding::{build_membership_proof, merkle_root};
use sunrey_interop::engine::{
    amount_payload, development_fixture, make_packet, open_dev_path, packet_state_key,
    InteropEngine,
};
use sunrey_interop::error::InteropError;
use sunrey_interop::foreign::ExternalDevChain;
use sunrey_interop::governance::InteropGovernanceAction;
use sunrey_interop::header::ForeignHeader;
use sunrey_interop::light_client::adapter_for;
use sunrey_interop::registry::{EXTERNAL_DEV_CHAIN_ID, SUNREY_CHAIN_ID};
use sunrey_interop::relayer::IsolatedRelayer;
use sunrey_interop::types::{ActorKind, ChannelOrdering, ChannelType, ClientType, FinalityModel};
use sunrey_interop::INTEROP_PROTOCOL_VERSION;

fn setup() -> (ExternalDevChain, InteropEngine, String, IsolatedRelayer) {
    let foreign = ExternalDevChain::genesis();
    let engine = development_fixture(
        foreign.latest_header().unwrap(),
        foreign.latest_proof().unwrap(),
        foreign.validator_public_keys(),
    )
    .unwrap();
    let client = engine.clients.keys().next().cloned().unwrap();
    (foreign, engine, client, IsolatedRelayer::new("relayer-honest"))
}

#[test]
fn merkle_membership_roundtrip() {
    let entries =
        vec![("a".into(), b"1".to_vec()), ("b".into(), b"2".to_vec()), ("c".into(), b"3".to_vec())];
    let root = merkle_root(&entries);
    let proof = build_membership_proof(&entries, "b").unwrap();
    sunrey_interop::encoding::verify_membership_proof(&root, &proof).unwrap();
}

#[test]
fn wrong_external_chain_id_rejected() {
    let (mut foreign, mut engine, client, relayer) = setup();
    foreign.put("k", b"v".to_vec());
    let (mut header, proof) = foreign.finalize_next().unwrap();
    header.chain_id = "chn_other_network".into();
    let err = engine.submit_header_update(&client, header, proof, &relayer).unwrap_err();
    assert_eq!(err, InteropError::WrongExternalChainId);
}

#[test]
fn wrong_genesis_rejected() {
    let foreign = ExternalDevChain::genesis();
    let mut engine = development_fixture(
        foreign.latest_header().unwrap(),
        foreign.latest_proof().unwrap(),
        foreign.validator_public_keys(),
    )
    .unwrap();
    let mut fake = foreign.latest_header().unwrap().clone();
    fake.timestamp_unix += 99;
    let err = engine
        .initialize_client(
            sunrey_interop::ids::InterchainClientId::new(
                EXTERNAL_DEV_CHAIN_ID,
                SUNREY_CHAIN_ID,
                "client-1",
            ),
            EXTERNAL_DEV_CHAIN_ID,
            &fake,
            foreign.latest_proof().unwrap(),
            foreign.validator_public_keys(),
        )
        .unwrap_err();
    assert_eq!(err, InteropError::WrongGenesis);
}

#[test]
fn invalid_foreign_header_rejected() {
    let (mut foreign, mut engine, client, relayer) = setup();
    foreign.put("k", b"v".to_vec());
    let (mut header, proof) = foreign.finalize_next().unwrap();
    header.parent_hash = [9u8; 32];
    let err = engine.submit_header_update(&client, header, proof, &relayer).unwrap_err();
    assert_eq!(err, InteropError::InvalidHeader);
}

#[test]
fn invalid_finality_proof_rejected() {
    let (mut foreign, mut engine, client, relayer) = setup();
    foreign.put("k", b"v".to_vec());
    let (header, mut proof) = foreign.finalize_next().unwrap();
    proof.signatures.clear();
    let err = engine.submit_header_update(&client, header, proof, &relayer).unwrap_err();
    assert_eq!(err, InteropError::InvalidFinalityProof);
}

#[test]
fn invalid_membership_proof_rejected() {
    let (mut foreign, mut engine, client, relayer) = setup();
    let (_, src, dst) = open_dev_path(
        &mut engine,
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        ChannelType::GenericMessage,
        ChannelOrdering::Unordered,
    )
    .unwrap();
    let packet = make_packet(
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        &src,
        &dst,
        0,
        ChannelType::GenericMessage,
        b"hello".to_vec(),
        10,
    );
    foreign.put(packet_state_key(&packet), packet.encode());
    let (header, proof) = foreign.finalize_next().unwrap();
    engine.submit_header_update(&client, header, proof, &relayer).unwrap();
    let mut membership = foreign.membership(&packet_state_key(&packet)).unwrap();
    membership.value = b"tampered".to_vec();
    let err = engine.recv_packet(&client, packet, &membership, 1, &relayer).unwrap_err();
    assert!(matches!(err, InteropError::InvalidMembershipProof | InteropError::ModifiedPacket));
}

#[test]
fn modified_packet_rejected() {
    let (mut foreign, mut engine, client, relayer) = setup();
    let (_, src, dst) = open_dev_path(
        &mut engine,
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        ChannelType::GenericMessage,
        ChannelOrdering::Unordered,
    )
    .unwrap();
    let packet = make_packet(
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        &src,
        &dst,
        0,
        ChannelType::GenericMessage,
        b"hello".to_vec(),
        10,
    );
    foreign.put(packet_state_key(&packet), packet.encode());
    let (header, proof) = foreign.finalize_next().unwrap();
    engine.submit_header_update(&client, header, proof, &relayer).unwrap();
    let membership = foreign.membership(&packet_state_key(&packet)).unwrap();
    let mut modified = packet.clone();
    modified.payload = b"evil".to_vec();
    let err = engine.recv_packet(&client, modified, &membership, 1, &relayer).unwrap_err();
    assert_eq!(err, InteropError::ModifiedPacket);
}

#[test]
fn packet_replay_rejected() {
    let (mut foreign, mut engine, client, relayer) = setup();
    let (_, src, dst) = open_dev_path(
        &mut engine,
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        ChannelType::GenericMessage,
        ChannelOrdering::Unordered,
    )
    .unwrap();
    let packet = make_packet(
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        &src,
        &dst,
        0,
        ChannelType::GenericMessage,
        b"hello".to_vec(),
        10,
    );
    foreign.put(packet_state_key(&packet), packet.encode());
    let (header, proof) = foreign.finalize_next().unwrap();
    engine.submit_header_update(&client, header, proof, &relayer).unwrap();
    let membership = foreign.membership(&packet_state_key(&packet)).unwrap();
    engine.recv_packet(&client, packet.clone(), &membership, 1, &relayer).unwrap();
    let err = engine.recv_packet(&client, packet, &membership, 1, &relayer).unwrap_err();
    assert_eq!(err, InteropError::PacketReplay);
}

#[test]
fn duplicate_relayer_submission_safe() {
    let (mut foreign, mut engine, client, _) = setup();
    foreign.put("k", b"v".to_vec());
    let (header, proof) = foreign.finalize_next().unwrap();
    let a = IsolatedRelayer::new("relayer-a");
    let b = IsolatedRelayer::new("relayer-b");
    engine.submit_header_update(&client, header.clone(), proof.clone(), &a).unwrap();
    engine.submit_header_update(&client, header, proof, &b).unwrap();
    assert_eq!(engine.metrics.duplicate_updates, 1);
    assert_eq!(engine.clients[&client].latest_height, 1);
}

#[test]
fn timeout_deterministic() {
    let (mut foreign, mut engine, client, relayer) = setup();
    let (_, src, dst) = open_dev_path(
        &mut engine,
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        ChannelType::GenericMessage,
        ChannelOrdering::Unordered,
    )
    .unwrap();
    let packet = make_packet(
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        &src,
        &dst,
        0,
        ChannelType::GenericMessage,
        b"hello".to_vec(),
        1,
    );
    engine.send_packet(packet.clone()).unwrap();
    foreign.put("unrelated", b"1".to_vec());
    let (header, proof) = foreign.finalize_next().unwrap();
    engine.submit_header_update(&client, header, proof, &relayer).unwrap();
    let (left, right) =
        foreign.non_membership(&format!("receipts/{}", packet.packet_id().canonical())).unwrap();
    engine
        .timeout_packet(
            &packet.packet_id().canonical(),
            &client,
            1,
            left.as_ref(),
            right.as_ref(),
            &format!("receipts/{}", packet.packet_id().canonical()),
        )
        .unwrap();
    assert_eq!(
        engine.packets[&packet.packet_id().canonical()].lifecycle,
        sunrey_interop::types::PacketLifecycle::TimedOut
    );
}

#[test]
fn ack_replay_rejected() {
    let (mut foreign, mut engine, client, relayer) = setup();
    let (_, src, dst) = open_dev_path(
        &mut engine,
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        ChannelType::GenericMessage,
        ChannelOrdering::Unordered,
    )
    .unwrap();
    let packet = make_packet(
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        &src,
        &dst,
        0,
        ChannelType::GenericMessage,
        b"hello".to_vec(),
        10,
    );
    foreign.put(packet_state_key(&packet), packet.encode());
    let (header, proof) = foreign.finalize_next().unwrap();
    engine.submit_header_update(&client, header, proof, &relayer).unwrap();
    let membership = foreign.membership(&packet_state_key(&packet)).unwrap();
    let ack = engine.recv_packet(&client, packet.clone(), &membership, 1, &relayer).unwrap();
    foreign.put(format!("acks/{}", packet.packet_id().canonical()), ack.clone());
    let (header, proof) = foreign.finalize_next().unwrap();
    engine.submit_header_update(&client, header, proof, &relayer).unwrap();
    let ack_proof =
        foreign.membership(&format!("acks/{}", packet.packet_id().canonical())).unwrap();
    engine
        .acknowledge_packet(&packet.packet_id().canonical(), &ack, &client, &ack_proof, 2)
        .unwrap();
    let err = engine
        .acknowledge_packet(&packet.packet_id().canonical(), &ack, &client, &ack_proof, 2)
        .unwrap_err();
    assert_eq!(err, InteropError::AckReplay);
}

#[test]
fn frozen_client_rejects_updates() {
    let (mut foreign, mut engine, client, relayer) = setup();
    foreign.put("k", b"v".to_vec());
    let (header, proof) = foreign.finalize_next().unwrap();
    let mut other = header.clone();
    other.state_root = [7u8; 32];
    let mut other_proof = proof.clone();
    other_proof.header_hash = other.hash();
    // conflicting headers with valid signatures are constructed from the same keys
    let keys = ExternalDevChain::validator_keys();
    let other_proof = sunrey_interop::header::FinalityProof::sign_header(&other, &keys);
    let evidence = sunrey_interop::evidence::MisbehaviorEvidence {
        client_id: client.clone(),
        external_chain_id: EXTERNAL_DEV_CHAIN_ID.into(),
        height: header.height,
        header_a: header.clone(),
        proof_a: proof.clone(),
        header_b: other,
        proof_b: other_proof,
    };
    engine.freeze_on_misbehavior(&client, evidence).unwrap();
    let err = engine.submit_header_update(&client, header, proof, &relayer).unwrap_err();
    assert_eq!(err, InteropError::ClientFrozen);
}

#[test]
fn unregistered_chain_rejected() {
    let mut engine = InteropEngine::new();
    let foreign = ExternalDevChain::genesis();
    let err = engine
        .initialize_client(
            sunrey_interop::ids::InterchainClientId::new("chn_unknown", SUNREY_CHAIN_ID, "c"),
            "chn_unknown",
            foreign.latest_header().unwrap(),
            foreign.latest_proof().unwrap(),
            foreign.validator_public_keys(),
        )
        .unwrap_err();
    assert_eq!(err, InteropError::UnregisteredChain);
}

#[test]
fn relayer_cannot_vote_or_govern() {
    let relayer = IsolatedRelayer::new("relayer-x");
    assert_eq!(relayer.cannot_vote().unwrap_err(), InteropError::RelayerForbidden);
    assert_eq!(relayer.cannot_govern().unwrap_err(), InteropError::RelayerForbidden);
    let auth = sunrey_interop::engine::gov(
        "relayer-x",
        ActorKind::Relayer,
        InteropGovernanceAction::ActivateExternalChain,
        EXTERNAL_DEV_CHAIN_ID,
    );
    let mut engine = InteropEngine::new();
    assert_eq!(
        engine.activate_chain(EXTERNAL_DEV_CHAIN_ID, &auth).unwrap_err(),
        InteropError::RelayerForbidden
    );
}

#[test]
fn ai_cannot_activate_external_chain() {
    let mut engine = InteropEngine::new();
    let auth = sunrey_interop::engine::gov(
        "ai",
        ActorKind::AiPreparer,
        InteropGovernanceAction::ActivateExternalChain,
        EXTERNAL_DEV_CHAIN_ID,
    );
    assert_eq!(
        engine.activate_chain(EXTERNAL_DEV_CHAIN_ID, &auth).unwrap_err(),
        InteropError::AiCannotActivate
    );
}

#[test]
fn foreign_value_does_not_mutate_fiat_or_become_truth() {
    let fact = sunrey_interop::oracle::VerifiedExternalChainFact::from_verified(
        EXTERNAL_DEV_CHAIN_ID.into(),
        "price".into(),
        b"100".to_vec(),
        1,
        "00".into(),
    );
    assert_eq!(
        fact.refuse_as_economic_truth().unwrap_err(),
        InteropError::ForeignValueNotEconomicTruth
    );
    assert_eq!(fact.refuse_fiat_mutation().unwrap_err(), InteropError::FiatLedgerMutationForbidden);
}

#[test]
fn no_wrapped_fiat_created() {
    assert_eq!(
        InteropAssetLedger::refuse_fiat("USD").unwrap_err(),
        InteropError::WrappedFiatForbidden
    );
    assert_eq!(
        InteropAssetLedger::refuse_fiat("SUNREY_COIN").unwrap_err(),
        InteropError::ProductionAssetUnavailable
    );
    InteropAssetLedger::refuse_fiat(DEV_INTEROP_TEST_ASSET).unwrap();
}

#[test]
fn unimplemented_finality_models_do_not_pretend() {
    assert_eq!(
        adapter_for(FinalityModel::DeterministicBft, ClientType::DeterministicBft).unwrap_err(),
        InteropError::VerificationNotImplemented
    );
    assert_eq!(
        adapter_for(
            FinalityModel::ProbabilisticLongestChain,
            ClientType::ProbabilisticLongestChain
        )
        .unwrap_err(),
        InteropError::VerificationNotImplemented
    );
    adapter_for(
        FinalityModel::SimulatedDeterministicBftExternalChain,
        ClientType::SimulatedDeterministicBft,
    )
    .unwrap();
}

#[test]
fn identity_attestation_is_not_automatically_trusted() {
    let att = sunrey_interop::identity::ExternalIdentityAttestation::draft(
        "issuer-1",
        b"cred".to_vec(),
        EXTERNAL_DEV_CHAIN_ID,
    );
    assert_eq!(
        att.refuse_automatic_trust().unwrap_err(),
        InteropError::IdentityNotAutomaticallyTrusted
    );
}

#[test]
fn packet_from_other_network_invalid() {
    let packet = make_packet(
        "chn_other",
        SUNREY_CHAIN_ID,
        "chan",
        "chan",
        0,
        ChannelType::GenericMessage,
        b"x".to_vec(),
        1,
    );
    assert_eq!(
        packet
            .bind_matches(EXTERNAL_DEV_CHAIN_ID, SUNREY_CHAIN_ID, INTEROP_PROTOCOL_VERSION)
            .unwrap_err(),
        InteropError::WrongExternalChainId
    );
}

#[test]
fn expired_client_requires_governed_recovery() {
    let (_, mut engine, client, _) = setup();
    engine.now_unix += 200_000;
    engine.expire_clients();
    assert_eq!(engine.clients[&client].status, sunrey_interop::types::ClientStatus::Expired);
    let relayer = IsolatedRelayer::new("r");
    let header = ForeignHeader {
        chain_id: EXTERNAL_DEV_CHAIN_ID.into(),
        height: 1,
        parent_hash: [0u8; 32],
        state_root: [0u8; 32],
        validator_commitment: [0u8; 32],
        timestamp_unix: engine.now_unix,
        client_version: 1,
    };
    let err = engine
        .submit_header_update(
            &client,
            header,
            sunrey_interop::header::FinalityProof { header_hash: [0u8; 32], signatures: vec![] },
            &relayer,
        )
        .unwrap_err();
    assert_eq!(err, InteropError::ClientExpired);
}

#[test]
fn security_profile_exposes_pq_boundary() {
    let (_, engine, client, _) = setup();
    let profile = engine.security_profile(&client).unwrap();
    assert!(!profile.absolute_security_claim);
    assert!(!profile.trusted_multisig_bridge);
    assert!(profile.interop_cannot_exceed_weakest_domain);
    assert_eq!(profile.foreign_crypto_classification, "CLASSICAL");
    assert!(!profile.production_ready);
}

#[test]
fn rpc_url_does_not_register_a_chain() {
    let engine = InteropEngine::new();
    assert!(engine.chains.is_empty());
    assert_eq!(
        engine.require_registered("https://example.invalid/rpc").unwrap_err(),
        InteropError::UnregisteredChain
    );
}

#[test]
fn amount_payload_roundtrip_dev_asset() {
    let mut ledger = InteropAssetLedger::development(100);
    ledger.escrow(40).unwrap();
    ledger.represent_remote(25).unwrap();
    ledger.invariant().unwrap();
    assert_eq!(ledger.circulating, 60);
    assert_eq!(ledger.escrowed, 15);
    assert_eq!(ledger.authorized_remote, 25);
    let _ = amount_payload(10);
}
