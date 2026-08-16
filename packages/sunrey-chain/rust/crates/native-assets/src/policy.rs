use serde::{Deserialize, Serialize};

use crate::error::AssetError;
use crate::registry::{FeeEligibility, NativeAssetId};
use crate::state::NativeAssetLedger;
use crate::transaction::{NativeAssetOp, NativeAssetPayload};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PolicyReason {
    AssetActive,
    AssetInactive,
    TransferAllowed,
    TransferDenied,
    IssuanceAllowed,
    IssuanceDenied,
    LockAllowed,
    LockDenied,
    BurnAllowed,
    BurnDenied,
    FeeNotYetIntegrated,
    FeeIntegrated,
    FeeNotEligible,
    OperationAvailable,
    OperationUnavailable,
    ProtocolVersionUnsupported,
}

impl PolicyReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::AssetActive => "ASSET_ACTIVE",
            Self::AssetInactive => "ASSET_INACTIVE",
            Self::TransferAllowed => "TRANSFER_ALLOWED",
            Self::TransferDenied => "TRANSFER_DENIED",
            Self::IssuanceAllowed => "ISSUANCE_ALLOWED",
            Self::IssuanceDenied => "ISSUANCE_DENIED",
            Self::LockAllowed => "LOCK_ALLOWED",
            Self::LockDenied => "LOCK_DENIED",
            Self::BurnAllowed => "BURN_ALLOWED",
            Self::BurnDenied => "BURN_DENIED",
            Self::FeeNotYetIntegrated => "FEE_NOT_YET_INTEGRATED",
            Self::FeeIntegrated => "FEE_INTEGRATED",
            Self::FeeNotEligible => "FEE_NOT_ELIGIBLE",
            Self::OperationAvailable => "OPERATION_AVAILABLE",
            Self::OperationUnavailable => "OPERATION_UNAVAILABLE",
            Self::ProtocolVersionUnsupported => "PROTOCOL_VERSION_UNSUPPORTED",
        }
    }

    pub fn allowed(self) -> bool {
        matches!(
            self,
            Self::AssetActive
                | Self::TransferAllowed
                | Self::IssuanceAllowed
                | Self::LockAllowed
                | Self::BurnAllowed
                | Self::FeeNotYetIntegrated
                | Self::FeeIntegrated
                | Self::OperationAvailable
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PolicyDecision {
    pub allowed: bool,
    pub reason: PolicyReason,
}

impl PolicyDecision {
    pub fn allow(reason: PolicyReason) -> Self {
        Self { allowed: true, reason }
    }

    pub fn deny(reason: PolicyReason) -> Self {
        Self { allowed: false, reason }
    }

    pub fn require(self) -> Result<PolicyReason, AssetError> {
        if self.allowed {
            Ok(self.reason)
        } else {
            Err(AssetError::PolicyDenied)
        }
    }
}

pub struct AssetPolicy;

impl AssetPolicy {
    pub fn asset_active(
        ledger: &NativeAssetLedger,
        asset: NativeAssetId,
        height: u64,
    ) -> PolicyDecision {
        match ledger.registry.require_active(asset, height) {
            Ok(_) => PolicyDecision::allow(PolicyReason::AssetActive),
            Err(_) => PolicyDecision::deny(PolicyReason::AssetInactive),
        }
    }

    pub fn can_transfer(
        ledger: &NativeAssetLedger,
        actor: &str,
        payload: &NativeAssetPayload,
        height: u64,
    ) -> PolicyDecision {
        if !Self::asset_active(ledger, payload.asset_id, height).allowed {
            return PolicyDecision::deny(PolicyReason::AssetInactive);
        }
        if actor.is_empty() || payload.counterparty.is_empty() || actor == payload.counterparty {
            return PolicyDecision::deny(PolicyReason::TransferDenied);
        }
        if payload.quantity == 0 {
            return PolicyDecision::deny(PolicyReason::TransferDenied);
        }
        PolicyDecision::allow(PolicyReason::TransferAllowed)
    }

    pub fn can_issue(
        ledger: &NativeAssetLedger,
        payload: &NativeAssetPayload,
        height: u64,
        authorized: bool,
    ) -> PolicyDecision {
        if !Self::asset_active(ledger, payload.asset_id, height).allowed {
            return PolicyDecision::deny(PolicyReason::AssetInactive);
        }
        if !authorized {
            return PolicyDecision::deny(PolicyReason::IssuanceDenied);
        }
        if payload.quantity == 0 || payload.counterparty.is_empty() {
            return PolicyDecision::deny(PolicyReason::IssuanceDenied);
        }
        PolicyDecision::allow(PolicyReason::IssuanceAllowed)
    }

    pub fn can_lock(
        ledger: &NativeAssetLedger,
        payload: &NativeAssetPayload,
        height: u64,
    ) -> PolicyDecision {
        if !Self::asset_active(ledger, payload.asset_id, height).allowed {
            return PolicyDecision::deny(PolicyReason::AssetInactive);
        }
        if payload.quantity == 0 || payload.lock_id.is_empty() || payload.lock_purpose.is_none() {
            return PolicyDecision::deny(PolicyReason::LockDenied);
        }
        PolicyDecision::allow(PolicyReason::LockAllowed)
    }

    pub fn can_burn(
        ledger: &NativeAssetLedger,
        payload: &NativeAssetPayload,
        height: u64,
    ) -> PolicyDecision {
        if !Self::asset_active(ledger, payload.asset_id, height).allowed {
            return PolicyDecision::deny(PolicyReason::AssetInactive);
        }
        if payload.quantity == 0 {
            return PolicyDecision::deny(PolicyReason::BurnDenied);
        }
        PolicyDecision::allow(PolicyReason::BurnAllowed)
    }

    pub fn can_use_as_fee(ledger: &NativeAssetLedger, asset: NativeAssetId) -> PolicyDecision {
        match ledger.registry.get(asset) {
            Ok(def) => match def.fee_eligibility {
                FeeEligibility::EligibleAfterChunk42 => {
                    PolicyDecision::allow(PolicyReason::FeeIntegrated)
                }
                FeeEligibility::NotEligible => PolicyDecision::deny(PolicyReason::FeeNotEligible),
            },
            Err(_) => PolicyDecision::deny(PolicyReason::AssetInactive),
        }
    }

    pub fn operation_available(op: NativeAssetOp, protocol_version: u32) -> PolicyDecision {
        if protocol_version < 1 {
            return PolicyDecision::deny(PolicyReason::ProtocolVersionUnsupported);
        }
        match op {
            NativeAssetOp::Transfer
            | NativeAssetOp::Issue
            | NativeAssetOp::Burn
            | NativeAssetOp::Lock
            | NativeAssetOp::Unlock => PolicyDecision::allow(PolicyReason::OperationAvailable),
        }
    }
}
