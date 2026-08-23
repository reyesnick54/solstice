//! Productized network identity for the P2P development node.
//!
//! Aliases keep existing genesis hashes stable.

use sunrey_protocol::{
    environment_for_network, reject_cross_network_replay, NetworkEnvironment, DEVNET_CHAIN_ID,
    DEVNET_NETWORK_ID, LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, TESTNET_1_CHAIN_ID,
    TESTNET_1_NETWORK_ID,
};

use crate::chain::{DEV_CHAIN_ID, DEV_NETWORK_ID};
use crate::error::{HandshakeRejectReason, NodeError, NodeResult};

pub fn node_environment(network_id: &str) -> NodeResult<NetworkEnvironment> {
    environment_for_network(network_id).map_err(|_| NodeError::HandshakeRejected {
        reason: HandshakeRejectReason::NetworkMismatch,
    })
}

pub fn assert_handshake_network(
    local_network: &str,
    local_chain: &str,
    peer_network: &str,
    peer_chain: &str,
) -> NodeResult<()> {
    reject_cross_network_replay(peer_network, peer_chain, local_network, local_chain).map_err(
        |_| NodeError::HandshakeRejected {
            reason: HandshakeRejectReason::NetworkMismatch,
        },
    )
}

pub fn known_dev_identities() -> [(&'static str, &'static str, NetworkEnvironment); 3] {
    [
        (DEV_NETWORK_ID, DEV_CHAIN_ID, NetworkEnvironment::Devnet),
        (
            LOCAL_DEV_NETWORK_ID,
            LOCAL_DEV_CHAIN_ID,
            NetworkEnvironment::Local,
        ),
        (
            TESTNET_1_NETWORK_ID,
            TESTNET_1_CHAIN_ID,
            NetworkEnvironment::Testnet,
        ),
    ]
}

pub fn aliases_are_stable() -> bool {
    DEV_NETWORK_ID == DEVNET_NETWORK_ID && DEV_CHAIN_ID == DEVNET_CHAIN_ID
}
