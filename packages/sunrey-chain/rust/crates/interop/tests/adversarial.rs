use sunrey_interop::engine::{development_fixture, make_packet, open_dev_path, packet_state_key};
use sunrey_interop::error::InteropError;
use sunrey_interop::foreign::ExternalDevChain;
use sunrey_interop::registry::{EXTERNAL_DEV_CHAIN_ID, SUNREY_CHAIN_ID};
use sunrey_interop::relayer::IsolatedRelayer;
use sunrey_interop::types::{ChannelOrdering, ChannelType};

#[test]
fn malicious_relayer_is_rejected_while_honest_continues() {
    let mut foreign = ExternalDevChain::genesis();
    let mut engine = development_fixture(
        foreign.latest_header().unwrap(),
        foreign.latest_proof().unwrap(),
        foreign.validator_public_keys(),
    )
    .unwrap();
    let client = engine.clients.keys().next().cloned().unwrap();
    let honest = IsolatedRelayer::new("relayer-honest");
    let malicious = IsolatedRelayer::new("relayer-malicious");
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
        b"honest-value".to_vec(),
        20,
    );
    foreign.put(packet_state_key(&packet), packet.encode());
    let (header, proof) = foreign.finalize_next().unwrap();

    let mut fake_header = header.clone();
    fake_header.state_root = [0x11; 32];
    assert_eq!(
        engine.submit_header_update(&client, fake_header, proof.clone(), &malicious).unwrap_err(),
        InteropError::InvalidFinalityProof
    );

    let mut fake_proof = proof.clone();
    fake_proof.signatures.clear();
    assert_eq!(
        engine.submit_header_update(&client, header.clone(), fake_proof, &malicious).unwrap_err(),
        InteropError::InvalidFinalityProof
    );

    engine.submit_header_update(&client, header, proof, &honest).unwrap();

    let membership = foreign.membership(&packet_state_key(&packet)).unwrap();
    let mut modified = packet.clone();
    modified.payload = b"modified-external-value".to_vec();
    assert_eq!(
        engine.recv_packet(&client, modified, &membership, 1, &malicious).unwrap_err(),
        InteropError::ModifiedPacket
    );

    engine.recv_packet(&client, packet.clone(), &membership, 1, &honest).unwrap();
    assert_eq!(
        engine.recv_packet(&client, packet, &membership, 1, &malicious).unwrap_err(),
        InteropError::PacketReplay
    );

    assert_eq!(engine.metrics.interop_packets_received, 1);
    assert!(engine.metrics.interop_rejected_headers >= 2);
    assert_eq!(engine.clients[&client].latest_height, 1);
}
