//! Chunk 96 wallet authorization safety helpers.
//!
//! Application authentication is not native signing authority.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CustodyClass {
    SelfCustody,
    AssistedSelfCustody,
    InstitutionalCustody,
    MachineControlled,
    DelegatedAgent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionScope {
    ReadOnly,
    TransactionPreview,
    TransactionApproval,
    Trading,
    ProfileManagement,
    RecoveryAdmin,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SigningIntent {
    pub transaction_hash: String,
    pub destination: String,
    pub quantity: u128,
    pub asset: String,
    pub network: String,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum WalletSecurityError {
    #[error("wrong network cannot authorize")]
    WrongNetwork,
    #[error("changed transaction invalidates approval")]
    TamperedIntent,
    #[error("revoked delegation cannot authorize")]
    RevokedDelegation,
    #[error("guardian cannot spend")]
    GuardianCannotSpend,
    #[error("recovery cannot rewrite finalized state")]
    RecoveryRewrite,
    #[error("application login is not native signing authority")]
    SessionIsNotSigning,
    #[error("testnet key cannot authorize production")]
    TestnetKeyProduction,
    #[error("server cannot retrieve a self-custody private key")]
    SelfCustodyKeyUnavailable,
}

pub fn session_cannot_sign(_scope: SessionScope) -> Result<(), WalletSecurityError> {
    Err(WalletSecurityError::SessionIsNotSigning)
}

pub fn guardian_cannot_spend() -> Result<(), WalletSecurityError> {
    Err(WalletSecurityError::GuardianCannotSpend)
}

pub fn retrieve_self_custody_private_key() -> Result<(), WalletSecurityError> {
    Err(WalletSecurityError::SelfCustodyKeyUnavailable)
}

pub fn authorize_network(
    wallet_network: &str,
    key_network: &str,
) -> Result<(), WalletSecurityError> {
    let test_key = key_network.contains("test") || key_network.contains("rehearsal");
    let production = wallet_network.contains("production") || wallet_network.contains("mainnet");
    if test_key && production {
        return Err(WalletSecurityError::TestnetKeyProduction);
    }
    if wallet_network != key_network {
        return Err(WalletSecurityError::WrongNetwork);
    }
    Ok(())
}

pub fn approval_holds(
    approved: &SigningIntent,
    candidate: &SigningIntent,
) -> Result<(), WalletSecurityError> {
    if approved != candidate {
        return Err(WalletSecurityError::TamperedIntent);
    }
    Ok(())
}

pub fn revoked_delegation_cannot_authorize(revoked: bool) -> Result<(), WalletSecurityError> {
    if revoked {
        return Err(WalletSecurityError::RevokedDelegation);
    }
    Ok(())
}

pub fn recovery_cannot_rewrite(finalized: bool) -> Result<(), WalletSecurityError> {
    if finalized {
        return Err(WalletSecurityError::RecoveryRewrite);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safety_properties() {
        assert_eq!(
            session_cannot_sign(SessionScope::ReadOnly),
            Err(WalletSecurityError::SessionIsNotSigning)
        );
        assert_eq!(guardian_cannot_spend(), Err(WalletSecurityError::GuardianCannotSpend));
        assert_eq!(
            retrieve_self_custody_private_key(),
            Err(WalletSecurityError::SelfCustodyKeyUnavailable)
        );
        assert_eq!(
            authorize_network("net_sunrey_reserved_production", "net_sunrey_testnet_1"),
            Err(WalletSecurityError::TestnetKeyProduction)
        );
        let intent = SigningIntent {
            transaction_hash: "aa".into(),
            destination: "bob".into(),
            quantity: 1,
            asset: "SUNREY_COIN".into(),
            network: "net_sunrey_simulation".into(),
        };
        let mut tampered = intent.clone();
        tampered.quantity = 99;
        assert_eq!(approval_holds(&intent, &tampered), Err(WalletSecurityError::TamperedIntent));
        assert_eq!(
            revoked_delegation_cannot_authorize(true),
            Err(WalletSecurityError::RevokedDelegation)
        );
        assert_eq!(recovery_cannot_rewrite(true), Err(WalletSecurityError::RecoveryRewrite));
        assert_eq!(CustodyClass::SelfCustody, CustodyClass::SelfCustody);
    }
}
