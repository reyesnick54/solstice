use sunrey_chain_node::accountability::AccountabilityState;
use sunrey_chain_node::chain::{DevChain, Genesis, Transaction};
use sunrey_chain_node::codec::{
    decode_frame, encode_frame, Channel, Frame, FrameDecoder, MAX_FRAME_BYTES,
};
use sunrey_chain_node::consensus_vote::{ConsensusMessageType, SignedConsensusMessage};
use sunrey_chain_node::crypto::{DomainKey, KeyDomain};
use sunrey_chain_node::evidence::{
    verify_equivocation_evidence, EquivocationEvidence, EvidenceContext,
};
use sunrey_chain_node::handshake::{
    build_hello, evaluate_hello, HandshakeHello, HandshakeReplayCache, LocalHandshakeView,
};
use sunrey_chain_node::identity::PeerIdentity;
use sunrey_chain_node::mempool::{Mempool, MempoolConfig};
use sunrey_chain_node::messages::NetMessage;
use sunrey_chain_node::node::MAX_SYNC_RANGE;
use sunrey_chain_node::peer::{PeerLimits, PeerManager};
use sunrey_chain_node::validators::{four_validator_devnet, ValidatorRuntime, ValidatorStatus};

#[test]
fn oversized_and_malformed_frames_are_rejected() {
    let huge = Frame {
        channel: Channel::PeerControl,
        flags: 0,
        payload: vec![0; (MAX_FRAME_BYTES as usize) + 1],
    };
    assert!(encode_frame(&huge).is_err());

    let mut decoder = FrameDecoder::new(64);
    let mut header = Vec::from(*b"SRP1");
    header.push(4);
    header.extend_from_slice(&0u16.to_be_bytes());
    header.extend_from_slice(&10_000u32.to_be_bytes());
    assert!(decoder.push(&header).is_err());

    assert!(decode_frame(b"XXXX").is_err());
    assert!(NetMessage::decode(&[255, 0, 1]).is_err());
}

#[test]
fn handshake_rejects_incompatible_peers() {
    let local = PeerIdentity::generate();
    let remote = PeerIdentity::generate();
    let genesis = [3u8; 32];
    let hello = build_hello(&remote, "net_a", "chn_a", genesis, 0, 0, [1u8; 32]).unwrap();
    let mut replay = HandshakeReplayCache::default();
    let view = LocalHandshakeView {
        network_id: "net_b".into(),
        chain_id: "chn_a".into(),
        genesis_hash: genesis,
        node_id: local.node_id,
        now_ms: hello.timestamp_ms,
    };
    assert!(evaluate_hello(&view, &hello, &mut replay).is_err());
    assert!(HandshakeHello::decode(&[0, 1, 2, 3]).is_err());
}

#[test]
fn mempool_enforces_bounds_and_rejects_invalid_signatures() {
    let chain = DevChain::new(Genesis::development());
    let mut mempool = Mempool::new(MempoolConfig {
        max_count: 2,
        max_bytes: 8_000,
        max_per_actor: 1,
        max_tx_bytes: 1_024,
    });
    let wallet = DomainKey::generate(KeyDomain::TxWallet);
    let tx = Transaction::sign(
        &wallet,
        &chain.genesis.network_id,
        &chain.genesis.chain_id,
        "actor",
        1,
        b"ok".to_vec(),
        0,
    )
    .unwrap();
    mempool.admit(&chain, tx.clone()).unwrap();
    assert!(mempool.admit(&chain, tx).is_err());

    let mut bad = Transaction::sign(
        &wallet,
        &chain.genesis.network_id,
        &chain.genesis.chain_id,
        "actor-2",
        1,
        b"bad".to_vec(),
        0,
    )
    .unwrap();
    bad.signature[0] ^= 0xff;
    assert!(mempool.admit(&chain, bad).is_err());
}

#[test]
fn peer_manager_limits_and_bans() {
    let limits = PeerLimits {
        max_inbound: 1,
        max_outbound: 1,
        max_per_ip: 1,
        ban_score: 10,
        ban_ms: 1_000,
        max_failures: 2,
    };
    let mgr = PeerManager::new(limits, Vec::new(), None);
    assert!(mgr.can_accept_inbound("127.0.0.1".parse().unwrap()).is_ok());
    const {
        assert!(MAX_SYNC_RANGE <= 32);
    }
}

#[test]
fn decoder_fuzz_corpus_does_not_panic() {
    let samples: &[&[u8]] = &[
        &[],
        &[0],
        b"SRP1",
        b"SRP1\x00\x00\x00\xff\xff\xff\xff",
        b"SRP2\x01\x00\x00\x00\x00\x00\x01X",
    ];
    for sample in samples {
        let _ = decode_frame(sample);
        let _ = HandshakeHello::decode(sample);
        let _ = NetMessage::decode(sample);
        let _ = sunrey_chain_node::messages::decode_tx_gossip(sample);
        let _ = sunrey_chain_node::messages::decode_block_gossip(sample);
        let _ = sunrey_chain_node::messages::decode_sync_response(sample);
        let mut decoder = FrameDecoder::new(128);
        let _ = decoder.push(sample);
    }
}

#[test]
fn forged_evidence_against_honest_validator_is_rejected() {
    let (set, fixtures) = four_validator_devnet();
    let processed = std::collections::BTreeSet::new();
    let byz = &fixtures[3];
    let left = SignedConsensusMessage::sign(
        &byz.consensus,
        "net_sunrey_development",
        "chn_sunrey_development",
        "val-a",
        1,
        0,
        ConsensusMessageType::Prevote,
        [1u8; 32],
        set.hash(),
    )
    .unwrap();
    let mut right = left.clone();
    right.block_id = [2u8; 32];
    right.signature = byz.consensus.sign(&right.unsigned_bytes().unwrap());
    let forged = EquivocationEvidence::from_conflicting(left, right).unwrap();
    let ctx = EvidenceContext {
        network_id: "net_sunrey_development",
        chain_id: "chn_sunrey_development",
        current_height: 1,
        historical_set: &set,
        processed: &processed,
    };
    assert!(verify_equivocation_evidence(&forged, &ctx).is_err());
    let mut runtime = ValidatorRuntime::new(set, 4);
    let mut state = AccountabilityState::new(
        sunrey_chain_node::accountability::ValidatorAccountabilityPolicy::development(),
    );
    assert!(state
        .execute(
            &forged,
            &mut runtime,
            "net_sunrey_development",
            "chn_sunrey_development",
            1,
            [9u8; 32],
        )
        .is_err());
    assert_eq!(
        runtime.pending.get("val-a").unwrap().status,
        ValidatorStatus::Active
    );
    assert_eq!(
        runtime.pending.get("val-a").unwrap().bond.penalized_units,
        0
    );
    assert_eq!(runtime.active.hash(), runtime.pending.hash());
}
