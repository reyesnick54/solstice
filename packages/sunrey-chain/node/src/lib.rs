//! SunRey development node internals: authenticated P2P, mempool, gossip,
//! and locally verified state sync.
//!
//! Networking has no authority to mint assets, post journals, issue
//! Execution Authority, modify KYC/Consent/Risk, alter CryptoSuite policy,
//! modify governance, or change validator voting power.

pub mod accountability;
pub mod chain;
pub mod cli;
pub mod codec;
pub mod consensus;
pub mod consensus_vote;
pub mod crypto;
pub mod demo;
pub mod error;
pub mod evidence;
pub mod evidence_pool;
pub mod fork;
pub mod handshake;
pub mod identity;
pub mod machine;
pub mod mempool;
pub mod messages;
pub mod metrics;
pub mod native_assets;
pub mod node;
pub mod operator;
pub mod peer;
pub mod transport;
pub mod validator;
pub mod validator_demo;
pub mod validators;

pub use chain::{Genesis, Transaction, DEV_CHAIN_ID, DEV_NETWORK_ID};
pub use consensus::{CommitCertificate, FourValidatorFixture, ValidatorSet};
pub use crypto::{KeyDomain, CRYPTO_SUITE_ID};
pub use demo::{
    run_accountability_demo, run_required_devnet_demo, AccountabilityDemoReport, DemoReport,
};
pub use error::{HandshakeRejectReason, NodeError};
pub use identity::{NodeId, PeerAddress, PeerIdentity, PeerPublicKey, PeerSession};
pub use node::{ConsensusNodeConfig, DevelopmentNode, NodeConfig, NodeEvent};
pub use validator_demo::{
    run_four_validator_devnet, run_native_asset_devnet, FourValidatorReport,
    NativeAssetDevnetReport,
};

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
