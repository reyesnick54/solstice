use crate::authority::ECONOMIC_UNIT_LABEL_DEVELOPMENT;
use crate::error::AssetError;
use crate::issuance::{DEVELOPMENT_FAUCET_POLICY, DEV_FAUCET_ISSUER};
use crate::quantity::AssetQuantity;
use crate::registry::NativeAssetId;
use crate::transaction::{NativeAssetOp, NativeAssetPayload};

pub const FAUCET_ACTOR: &str = "dev.faucet";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FaucetRequest {
    pub asset_id: NativeAssetId,
    pub recipient: String,
    pub quantity: u128,
    pub authorization_id: String,
}

pub fn faucet_permitted(
    environment: &str,
    production_network_enabled: bool,
    network_id: &str,
) -> bool {
    if production_network_enabled {
        return false;
    }
    let env_ok = environment == "simulation" || environment == "development";
    let net_ok = network_id.contains("dev")
        || network_id.contains("simulation")
        || network_id.contains("testnet");
    env_ok && net_ok
}

pub fn require_faucet_environment(
    environment: &str,
    production_network_enabled: bool,
    network_id: &str,
) -> Result<(), AssetError> {
    if faucet_permitted(environment, production_network_enabled, network_id) {
        Ok(())
    } else {
        Err(AssetError::FaucetForbidden)
    }
}

pub fn faucet_payload(request: &FaucetRequest) -> Result<NativeAssetPayload, AssetError> {
    let quantity = AssetQuantity::new(request.asset_id, request.quantity)?;
    if quantity.is_zero() {
        return Err(AssetError::QuantityZero);
    }
    Ok(NativeAssetPayload {
        version: crate::transaction::NATIVE_ASSET_TX_VERSION,
        op: NativeAssetOp::Issue,
        actor_id: FAUCET_ACTOR.to_string(),
        asset_id: request.asset_id,
        quantity: request.quantity,
        counterparty: request.recipient.clone(),
        lock_id: String::new(),
        lock_purpose: None,
        expiration_height: None,
        authorized_releaser: String::new(),
        authorization_id: request.authorization_id.clone(),
        issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
        proof_reference: format!("faucet:{}", request.authorization_id),
        economic_unit_label: ECONOMIC_UNIT_LABEL_DEVELOPMENT.to_string(),
    })
}

pub fn faucet_notice() -> serde_json::Value {
    serde_json::json!({
        "environment": "development/simulation",
        "issuer": DEV_FAUCET_ISSUER,
        "actor": FAUCET_ACTOR,
        "economic_unit_label": ECONOMIC_UNIT_LABEL_DEVELOPMENT,
        "production_networks": "forbidden",
        "application_supply_imported": false,
        "warning": "Development faucet only. Issued units are DEVELOPMENT_ECONOMIC_UNIT and are not application SunRey Coin balances.",
    })
}
