//! BlockchainAccount metadata. Native balances remain chain state.

use serde::{Deserialize, Serialize};

use crate::address::BlockchainAddress;
use crate::auth::AccountPolicy;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AccountStatus {
    Active,
    RecoveryPending,
    SecurityRestricted,
    KeyRotationPending,
    Revoked,
}

#[derive(Debug, Clone)]
pub struct BlockchainAccount {
    pub account_id: String,
    pub address: BlockchainAddress,
    pub owner_actor_id: String,
    pub nonce: u64,
    pub status: AccountStatus,
    pub policy: AccountPolicy,
    pub created_height: u64,
}

impl BlockchainAccount {
    pub fn may_sign_new(&self) -> bool {
        matches!(self.status, AccountStatus::Active | AccountStatus::KeyRotationPending)
    }
}
