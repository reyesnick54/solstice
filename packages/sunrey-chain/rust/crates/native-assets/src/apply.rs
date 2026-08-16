use crate::authority::ECONOMIC_UNIT_LABEL_DEVELOPMENT;
use crate::crypto_policy::{AssetCrypto, CryptoPolicy};
use crate::error::AssetError;
use crate::faucet::{require_faucet_environment, FAUCET_ACTOR};
use crate::issuance::{
    DevelopmentMoonReyIssuanceAuthority, DevelopmentSunReyIssuanceAuthority,
    EconomicAuthorizationArtifact, IssuanceAuthorization, IssuanceVerifyCtx,
    MoonReyIssuanceAuthorityPort, SunReyNativeIssuanceAuthority, DEVELOPMENT_FAUCET_POLICY,
};
use crate::policy::AssetPolicy;
use crate::quantity::AssetQuantity;
use crate::registry::NativeAssetId;
use crate::state::{
    AssetBurnRecord, AssetIssuanceRecord, AssetLock, AssetTransferRecord, LockStatus,
    NativeAssetLedger,
};
use crate::transaction::{NativeAssetOp, NativeAssetPayload};

pub struct ApplyContext<'a> {
    pub height: u64,
    pub network_id: &'a str,
    pub chain_id: &'a str,
    pub environment: &'a str,
    pub production_network_enabled: bool,
    pub protocol_version: u32,
    pub crypto: &'a dyn AssetCrypto,
    pub crypto_policy: &'a CryptoPolicy,
    pub authorization: Option<&'a IssuanceAuthorization>,
}

pub fn apply_native_asset(
    ledger: &mut NativeAssetLedger,
    payload: &NativeAssetPayload,
    ctx: &ApplyContext<'_>,
) -> Result<(), AssetError> {
    AssetPolicy::operation_available(payload.op, ctx.protocol_version).require()?;
    ledger.registry.require_active(payload.asset_id, ctx.height)?;
    let result = match payload.op {
        NativeAssetOp::Transfer => apply_transfer(ledger, payload, ctx),
        NativeAssetOp::Issue => apply_issue(ledger, payload, ctx),
        NativeAssetOp::Burn => apply_burn(ledger, payload, ctx),
        NativeAssetOp::Lock => apply_lock(ledger, payload, ctx),
        NativeAssetOp::Unlock => apply_unlock(ledger, payload, ctx),
    };
    if result.is_ok() {
        ledger.reconcile_all()?;
    }
    result
}

fn apply_transfer(
    ledger: &mut NativeAssetLedger,
    payload: &NativeAssetPayload,
    ctx: &ApplyContext<'_>,
) -> Result<(), AssetError> {
    AssetPolicy::can_transfer(ledger, &payload.actor_id, payload, ctx.height).require()?;
    let qty = payload.quantity()?;
    ledger.debit_available(&payload.actor_id, qty.asset_id, qty.scaled_units)?;
    ledger.credit_available(&payload.counterparty, qty.asset_id, qty.scaled_units)?;
    let record_id = format!("xfr-{}-{}", ctx.height, payload.actor_id);
    ledger.transfers.insert(
        record_id.clone(),
        AssetTransferRecord {
            record_id,
            asset_id: qty.asset_id,
            sender: payload.actor_id.clone(),
            recipient: payload.counterparty.clone(),
            quantity: qty.scaled_units,
            height: ctx.height,
        },
    );
    Ok(())
}

fn apply_issue(
    ledger: &mut NativeAssetLedger,
    payload: &NativeAssetPayload,
    ctx: &ApplyContext<'_>,
) -> Result<(), AssetError> {
    let auth = ctx.authorization.ok_or(AssetError::UnauthorizedIssuance)?;
    if auth.authorization_id != payload.authorization_id {
        return Err(AssetError::UnauthorizedIssuance);
    }
    if ledger.used_authorizations.contains_key(&auth.authorization_id) {
        return Err(AssetError::IssuanceReplay);
    }
    if auth.asset_id != payload.asset_id
        || auth.recipient != payload.counterparty
        || auth.quantity != payload.quantity
    {
        return Err(AssetError::UnauthorizedIssuance);
    }
    if payload.issuance_policy == DEVELOPMENT_FAUCET_POLICY || payload.actor_id == FAUCET_ACTOR {
        require_faucet_environment(
            ctx.environment,
            ctx.production_network_enabled,
            ctx.network_id,
        )?;
    }
    match payload.asset_id {
        NativeAssetId::SunReyCoin => {
            DevelopmentSunReyIssuanceAuthority.verify(
                auth,
                &IssuanceVerifyCtx {
                    crypto: ctx.crypto,
                    policy: ctx.crypto_policy,
                    height: ctx.height,
                    network_id: ctx.network_id,
                    chain_id: ctx.chain_id,
                },
            )?;
        }
        NativeAssetId::MoonReyCoin => {
            let artifact = EconomicAuthorizationArtifact {
                artifact_id: auth.authorization_id.clone(),
                schema_id: "sunrey.moonrey.economic_auth.dev.v1".to_string(),
                proof_reference: payload.proof_reference.clone(),
                labeled_test: payload.issuance_policy == DEVELOPMENT_FAUCET_POLICY
                    || payload.economic_unit_label == crate::authority::ECONOMIC_UNIT_LABEL_TEST
                    || payload.economic_unit_label == ECONOMIC_UNIT_LABEL_DEVELOPMENT,
            };
            DevelopmentMoonReyIssuanceAuthority.verify_economic_authorization(
                auth,
                &artifact,
                &IssuanceVerifyCtx {
                    crypto: ctx.crypto,
                    policy: ctx.crypto_policy,
                    height: ctx.height,
                    network_id: ctx.network_id,
                    chain_id: ctx.chain_id,
                },
            )?;
        }
    }
    AssetPolicy::can_issue(ledger, payload, ctx.height, true).require()?;
    let qty = AssetQuantity::new(payload.asset_id, payload.quantity)?;
    let mut supply = ledger.supply(qty.asset_id);
    supply.issued = supply.issued.checked_add(qty.scaled_units).ok_or(AssetError::Overflow)?;
    supply.circulating =
        supply.circulating.checked_add(qty.scaled_units).ok_or(AssetError::Overflow)?;
    if !payload.economic_unit_label.is_empty() {
        supply.economic_unit_label = payload.economic_unit_label.clone();
    }
    ledger.supplies.insert(qty.asset_id, supply);
    ledger.credit_available(&payload.counterparty, qty.asset_id, qty.scaled_units)?;
    let record_id = format!("iss-{}", auth.authorization_id);
    ledger.used_authorizations.insert(auth.authorization_id.clone(), record_id.clone());
    ledger.issuances.insert(
        record_id.clone(),
        AssetIssuanceRecord {
            record_id,
            authorization_id: auth.authorization_id.clone(),
            asset_id: qty.asset_id,
            recipient: payload.counterparty.clone(),
            quantity: qty.scaled_units,
            height: ctx.height,
            issuer: auth.issuer.clone(),
            economic_unit_label: if payload.economic_unit_label.is_empty() {
                ECONOMIC_UNIT_LABEL_DEVELOPMENT.to_string()
            } else {
                payload.economic_unit_label.clone()
            },
        },
    );
    Ok(())
}

fn apply_burn(
    ledger: &mut NativeAssetLedger,
    payload: &NativeAssetPayload,
    ctx: &ApplyContext<'_>,
) -> Result<(), AssetError> {
    AssetPolicy::can_burn(ledger, payload, ctx.height).require()?;
    let qty = payload.quantity()?;
    ledger.debit_available(&payload.actor_id, qty.asset_id, qty.scaled_units)?;
    let mut supply = ledger.supply(qty.asset_id);
    supply.burned = supply.burned.checked_add(qty.scaled_units).ok_or(AssetError::Overflow)?;
    supply.circulating =
        supply.circulating.checked_sub(qty.scaled_units).ok_or(AssetError::SupplyInconsistency)?;
    ledger.supplies.insert(qty.asset_id, supply);
    let record_id = format!("brn-{}-{}", ctx.height, payload.actor_id);
    ledger.burns.insert(
        record_id.clone(),
        AssetBurnRecord {
            record_id,
            asset_id: qty.asset_id,
            holder: payload.actor_id.clone(),
            quantity: qty.scaled_units,
            height: ctx.height,
        },
    );
    Ok(())
}

fn apply_lock(
    ledger: &mut NativeAssetLedger,
    payload: &NativeAssetPayload,
    ctx: &ApplyContext<'_>,
) -> Result<(), AssetError> {
    AssetPolicy::can_lock(ledger, payload, ctx.height).require()?;
    if ledger.locks.contains_key(&payload.lock_id) {
        return Err(AssetError::StatefulInvalid);
    }
    let qty = payload.quantity()?;
    ledger.debit_available(&payload.actor_id, qty.asset_id, qty.scaled_units)?;
    let mut holding = ledger.holding(&payload.actor_id, qty.asset_id);
    holding.locked = holding.locked.checked_add(qty.scaled_units).ok_or(AssetError::Overflow)?;
    ledger.set_holding(holding);
    let mut supply = ledger.supply(qty.asset_id);
    supply.circulating =
        supply.circulating.checked_sub(qty.scaled_units).ok_or(AssetError::SupplyInconsistency)?;
    supply.locked = supply.locked.checked_add(qty.scaled_units).ok_or(AssetError::Overflow)?;
    ledger.supplies.insert(qty.asset_id, supply);
    let releaser = if payload.authorized_releaser.is_empty() {
        payload.actor_id.clone()
    } else {
        payload.authorized_releaser.clone()
    };
    ledger.locks.insert(
        payload.lock_id.clone(),
        AssetLock {
            lock_id: payload.lock_id.clone(),
            owner: payload.actor_id.clone(),
            asset_id: qty.asset_id,
            quantity: qty.scaled_units,
            purpose: payload.lock_purpose.ok_or(AssetError::StatelessInvalid)?,
            created_height: ctx.height,
            expiration_height: payload.expiration_height,
            authorized_releaser: releaser,
            status: LockStatus::Locked,
        },
    );
    Ok(())
}

fn apply_unlock(
    ledger: &mut NativeAssetLedger,
    payload: &NativeAssetPayload,
    ctx: &ApplyContext<'_>,
) -> Result<(), AssetError> {
    let lock = ledger.locks.get(&payload.lock_id).cloned().ok_or(AssetError::LockNotFound)?;
    if lock.status != LockStatus::Locked {
        return Err(AssetError::StatefulInvalid);
    }
    if payload.actor_id != lock.authorized_releaser && payload.actor_id != lock.owner {
        return Err(AssetError::LockNotOwned);
    }
    if lock.asset_id != payload.asset_id {
        return Err(AssetError::CrossAssetArithmetic);
    }
    let mut holding = ledger.holding(&lock.owner, lock.asset_id);
    if holding.locked < lock.quantity {
        return Err(AssetError::SupplyInconsistency);
    }
    holding.locked -= lock.quantity;
    holding.available = holding.available.checked_add(lock.quantity).ok_or(AssetError::Overflow)?;
    ledger.set_holding(holding);
    let mut supply = ledger.supply(lock.asset_id);
    supply.locked =
        supply.locked.checked_sub(lock.quantity).ok_or(AssetError::SupplyInconsistency)?;
    supply.circulating =
        supply.circulating.checked_add(lock.quantity).ok_or(AssetError::Overflow)?;
    ledger.supplies.insert(lock.asset_id, supply);
    let mut updated = lock;
    if updated.expiration_height.is_some_and(|exp| ctx.height > exp) {
        updated.status = LockStatus::Expired;
    } else {
        updated.status = LockStatus::Released;
    }
    ledger.locks.insert(updated.lock_id.clone(), updated);
    Ok(())
}
