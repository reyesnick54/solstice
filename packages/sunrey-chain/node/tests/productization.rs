use sunrey_chain_node::chain::{Genesis, DEV_CHAIN_ID, DEV_NETWORK_ID};
use sunrey_chain_node::mempool::{Mempool, MempoolConfig};
use sunrey_chain_node::network_identity::{
    aliases_are_stable, assert_handshake_network, known_dev_identities, node_environment,
};
use sunrey_protocol::{NetworkEnvironment, TESTNET_1_CHAIN_ID, TESTNET_1_NETWORK_ID};

#[test]
fn p2p_identities_are_explicit_and_stable() {
    assert!(aliases_are_stable());
    assert_eq!(
        node_environment(DEV_NETWORK_ID).unwrap(),
        NetworkEnvironment::Devnet
    );
    let known = known_dev_identities();
    assert_eq!(known.len(), 3);
    assert_eq!(Genesis::development().network_id, DEV_NETWORK_ID);
    assert_eq!(Genesis::development().chain_id, DEV_CHAIN_ID);
}

#[test]
fn handshake_rejects_cross_network_replay() {
    assert!(
        assert_handshake_network(DEV_NETWORK_ID, DEV_CHAIN_ID, DEV_NETWORK_ID, DEV_CHAIN_ID)
            .is_ok()
    );
    assert!(assert_handshake_network(
        DEV_NETWORK_ID,
        DEV_CHAIN_ID,
        TESTNET_1_NETWORK_ID,
        TESTNET_1_CHAIN_ID
    )
    .is_err());
}

#[test]
fn mempool_capacity_protects_against_spam() {
    let pool = Mempool::new(MempoolConfig {
        max_count: 2,
        max_bytes: 4_096,
        max_per_actor: 1,
        max_tx_bytes: 1_024,
    });
    assert_eq!(pool.count(), 0);
    assert!(pool.bytes() < 4_096);
}
