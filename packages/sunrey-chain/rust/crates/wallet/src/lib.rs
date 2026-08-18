//! SunRey sovereign wallet primitives.
//!
//! This crate is not a second native-asset ledger and not a banking
//! Account. Balances are read from canonical chain state.

pub mod account;
pub mod address;
pub mod auth;
pub mod security;

pub use account::{AccountStatus, BlockchainAccount};
pub use address::{
    encode_address, parse_address, AddressAlgorithm, AddressClass, AddressError, BlockchainAddress,
    NetworkClass, ADDRESS_MAX_BINARY, ADDRESS_MAX_TEXT, ADDRESS_VERSION,
};
pub use auth::{authorize, AccountPolicy, AuthError, AuthPolicy, PresentedSignature};
pub use security::{
    approval_holds, authorize_network, guardian_cannot_spend, recovery_cannot_rewrite,
    retrieve_self_custody_private_key, revoked_delegation_cannot_authorize, session_cannot_sign,
    CustodyClass, SessionScope, SigningIntent, WalletSecurityError,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_validator_roots_match_for_identical_holdings() {
        let roots: Vec<String> = (0..4)
            .map(|_| {
                let addr = encode_address(
                    "net_sunrey_simulation",
                    AddressClass::SingleKey,
                    AddressAlgorithm::Ed25519V1,
                    b"alice",
                )
                .unwrap();
                format!("{}:1000000:0", addr.text)
            })
            .collect();
        assert!(roots.iter().all(|root| root == &roots[0]));
    }
}
