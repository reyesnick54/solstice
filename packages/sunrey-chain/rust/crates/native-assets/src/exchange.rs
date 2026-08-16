use serde::{Deserialize, Serialize};

use crate::apply::{apply_native_asset, ApplyContext};
use crate::error::AssetError;
use crate::quantity::AssetQuantity;
use crate::registry::NativeAssetId;
use crate::state::{LockPurpose, NativeAssetLedger};
use crate::transaction::{NativeAssetOp, NativeAssetPayload};

/// Canonical native-asset settlement port for SunRey Exchange.
/// Does not replace the current ledger-backed CoinPort.
pub trait NativeAssetSettlementPort {
    fn hold(&mut self, input: SettlementHold) -> Result<String, AssetError>;
    fn release(&mut self, lock_id: &str, actor_id: &str) -> Result<(), AssetError>;
    fn transfer(&mut self, input: SettlementTransfer) -> Result<(), AssetError>;
    fn atomic_delivery_versus_payment(&mut self, _input: SettlementDvp) -> Result<(), AssetError> {
        Err(AssetError::PolicyDenied)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SettlementHold {
    pub lock_id: String,
    pub owner: String,
    pub quantity: AssetQuantity,
    pub purpose: LockPurpose,
    pub authorized_releaser: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SettlementTransfer {
    pub sender: String,
    pub recipient: String,
    pub quantity: AssetQuantity,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SettlementDvp {
    pub asset_sender: String,
    pub asset_recipient: String,
    pub asset_quantity: AssetQuantity,
    pub contra_asset: NativeAssetId,
    pub contra_quantity: u128,
}

/// In-process adapter over native chain state. Not the application CoinPort.
pub struct NativeAssetSettlementAdapter<'a> {
    pub ledger: &'a mut NativeAssetLedger,
    pub ctx: &'a ApplyContext<'a>,
}

impl NativeAssetSettlementPort for NativeAssetSettlementAdapter<'_> {
    fn hold(&mut self, input: SettlementHold) -> Result<String, AssetError> {
        let lock_id = input.lock_id.clone();
        let payload = NativeAssetPayload {
            version: crate::transaction::NATIVE_ASSET_TX_VERSION,
            op: NativeAssetOp::Lock,
            actor_id: input.owner,
            asset_id: input.quantity.asset_id,
            quantity: input.quantity.scaled_units,
            counterparty: String::new(),
            lock_id: lock_id.clone(),
            lock_purpose: Some(input.purpose),
            expiration_height: None,
            authorized_releaser: input.authorized_releaser,
            authorization_id: String::new(),
            issuance_policy: String::new(),
            proof_reference: String::new(),
            economic_unit_label: String::new(),
        };
        apply_native_asset(self.ledger, &payload, self.ctx)?;
        Ok(lock_id)
    }

    fn release(&mut self, lock_id: &str, actor_id: &str) -> Result<(), AssetError> {
        let lock = self.ledger.locks.get(lock_id).cloned().ok_or(AssetError::LockNotFound)?;
        let payload = NativeAssetPayload {
            version: crate::transaction::NATIVE_ASSET_TX_VERSION,
            op: NativeAssetOp::Unlock,
            actor_id: actor_id.to_string(),
            asset_id: lock.asset_id,
            quantity: lock.quantity,
            counterparty: String::new(),
            lock_id: lock_id.to_string(),
            lock_purpose: Some(lock.purpose),
            expiration_height: lock.expiration_height,
            authorized_releaser: lock.authorized_releaser,
            authorization_id: String::new(),
            issuance_policy: String::new(),
            proof_reference: String::new(),
            economic_unit_label: String::new(),
        };
        apply_native_asset(self.ledger, &payload, self.ctx)
    }

    fn transfer(&mut self, input: SettlementTransfer) -> Result<(), AssetError> {
        let payload = NativeAssetPayload::transfer(input.sender, input.recipient, input.quantity);
        apply_native_asset(self.ledger, &payload, self.ctx)
    }
}
