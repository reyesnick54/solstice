use sunrey_interop::encoding::hex_hash;
use sunrey_interop::engine::{development_fixture, make_packet, open_dev_path, packet_state_key};
use sunrey_interop::foreign::ExternalDevChain;
use sunrey_interop::registry::{EXTERNAL_DEV_CHAIN_ID, SUNREY_CHAIN_ID};
use sunrey_interop::relayer::IsolatedRelayer;
use sunrey_interop::types::{ChannelOrdering, ChannelType};

#[test]
fn four_sunrey_validators_two_relayers_identical_state() {
    let mut foreign = ExternalDevChain::genesis();
    let genesis = foreign.latest_header().unwrap().clone();
    let genesis_proof = foreign.latest_proof().unwrap().clone();
    let keys = foreign.validator_public_keys();

    let mut validators: Vec<_> = (0..4)
        .map(|_| development_fixture(&genesis, &genesis_proof, keys.clone()).unwrap())
        .collect();
    let relayer_a = IsolatedRelayer::new("relayer-a");
    let relayer_b = IsolatedRelayer::new("relayer-b");

    for engine in &mut validators {
        open_dev_path(
            engine,
            EXTERNAL_DEV_CHAIN_ID,
            SUNREY_CHAIN_ID,
            ChannelType::GenericMessage,
            ChannelOrdering::Unordered,
        )
        .unwrap();
    }

    let src = validators[0]
        .channels
        .values()
        .find(|c| c.channel_id.source_chain == EXTERNAL_DEV_CHAIN_ID)
        .unwrap()
        .channel_id
        .canonical();
    let dst = validators[0]
        .channels
        .values()
        .find(|c| c.channel_id.source_chain == SUNREY_CHAIN_ID)
        .unwrap()
        .channel_id
        .canonical();

    let packet = make_packet(
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        &src,
        &dst,
        0,
        ChannelType::GenericMessage,
        b"four-validator-demo".to_vec(),
        20,
    );
    foreign.put(packet_state_key(&packet), packet.encode());
    let (header, proof) = foreign.finalize_next().unwrap();
    let membership = foreign.membership(&packet_state_key(&packet)).unwrap();

    for engine in &mut validators {
        let client = engine.clients.keys().next().cloned().unwrap();
        engine.submit_header_update(&client, header.clone(), proof.clone(), &relayer_a).unwrap();
        engine.submit_header_update(&client, header.clone(), proof.clone(), &relayer_b).unwrap();
        engine.recv_packet(&client, packet.clone(), &membership, 1, &relayer_a).unwrap();
        let replay = engine.recv_packet(&client, packet.clone(), &membership, 1, &relayer_b);
        assert!(replay.is_err());
    }

    let roots: Vec<String> = validators.iter().map(|e| hex_hash(&e.state_root())).collect();
    assert!(roots.iter().all(|r| r == &roots[0]));
    assert_eq!(validators[0].metrics.interop_packets_received, 1);
    assert_eq!(validators[0].metrics.duplicate_updates, 1);
    assert_eq!(validators[0].clients.values().next().unwrap().latest_height, 1);
}
