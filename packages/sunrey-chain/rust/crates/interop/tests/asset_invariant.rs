use sunrey_interop::asset::{InteropAssetLedger, DEV_INTEROP_TEST_ASSET};
use sunrey_interop::engine::{
    amount_payload, development_fixture, make_packet, open_dev_path, packet_state_key,
};
use sunrey_interop::error::InteropError;
use sunrey_interop::foreign::ExternalDevChain;
use sunrey_interop::registry::{EXTERNAL_DEV_CHAIN_ID, SUNREY_CHAIN_ID};
use sunrey_interop::relayer::IsolatedRelayer;
use sunrey_interop::types::{ChannelOrdering, ChannelType};

#[test]
fn dev_interop_test_asset_supply_invariant() {
    let mut foreign = ExternalDevChain::genesis();
    let mut engine = development_fixture(
        foreign.latest_header().unwrap(),
        foreign.latest_proof().unwrap(),
        foreign.validator_public_keys(),
    )
    .unwrap();
    let client = engine.clients.keys().next().cloned().unwrap();
    let relayer = IsolatedRelayer::new("relayer-a");
    let (_, src, dst) = open_dev_path(
        &mut engine,
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        ChannelType::AssetTransferReserved,
        ChannelOrdering::Ordered,
    )
    .unwrap();

    engine.escrow_dev_asset(250).unwrap();
    engine.assets.invariant().unwrap();
    assert_eq!(engine.assets.circulating, 1_000_000 - 250);
    assert_eq!(engine.assets.escrowed, 250);

    let packet = make_packet(
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        &src,
        &dst,
        0,
        ChannelType::AssetTransferReserved,
        amount_payload(250),
        20,
    );
    foreign.put(packet_state_key(&packet), packet.encode());
    let (header, proof) = foreign.finalize_next().unwrap();
    engine.submit_header_update(&client, header, proof, &relayer).unwrap();
    let membership = foreign.membership(&packet_state_key(&packet)).unwrap();
    let ack = engine.recv_packet(&client, packet.clone(), &membership, 1, &relayer).unwrap();
    engine.assets.invariant().unwrap();
    assert_eq!(engine.assets.authorized_remote, 250);
    assert_eq!(engine.assets.escrowed, 0);
    assert!(!ack.is_empty());
    assert_eq!(engine.assets.asset_id, DEV_INTEROP_TEST_ASSET);
}

#[test]
fn timeout_recovers_escrow() {
    let mut ledger = InteropAssetLedger::development(500);
    ledger.escrow(80).unwrap();
    ledger.timeout_recover(80).unwrap();
    ledger.invariant().unwrap();
    assert_eq!(ledger.circulating, 500);
    assert_eq!(ledger.escrowed, 0);
}

#[test]
fn production_assets_unavailable() {
    assert_eq!(
        InteropAssetLedger::refuse_fiat("MOONREY_COIN").unwrap_err(),
        InteropError::ProductionAssetUnavailable
    );
}
