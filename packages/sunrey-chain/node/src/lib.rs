//! SunRey development node internals: authenticated P2P, mempool, gossip,
//! and locally verified state sync.
//!
//! Networking has no authority to mint assets, post journals, issue
//! Execution Authority, modify KYC/Consent/Risk, alter CryptoSuite policy,
//! modify governance, or change validator voting power.

pub mod chain;
pub mod codec;
pub mod crypto;
pub mod demo;
pub mod error;
pub mod fork;
pub mod handshake;
pub mod identity;
pub mod mempool;
pub mod messages;
pub mod metrics;
pub mod node;
pub mod operator;
pub mod peer;
pub mod transport;

pub use chain::{Genesis, Transaction, DEV_CHAIN_ID, DEV_NETWORK_ID};
pub use crypto::{KeyDomain, CRYPTO_SUITE_ID};
pub use demo::{run_required_devnet_demo, DemoReport};
pub use error::{HandshakeRejectReason, NodeError};
pub use identity::{NodeId, PeerAddress, PeerIdentity, PeerPublicKey, PeerSession};
pub use node::{DevelopmentNode, NodeConfig, NodeEvent};

#[cfg(test)]
mod boundary_tests {
    use super::*;

    #[test]
    fn networking_has_no_forbidden_authority() {
        for err in demo::refuse_security_boundary() {
            assert!(matches!(err, NodeError::Forbidden(_)));
        }
        assert!(crypto::refuse_validator_vote()
            .to_string()
            .contains("cannot sign validator"));
    }
}
