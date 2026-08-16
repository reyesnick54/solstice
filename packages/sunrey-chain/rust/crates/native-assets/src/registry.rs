use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sunrey_protocol::{
    decode_string, decode_u128, decode_u32, decode_u64, encode_string, encode_u128, encode_u32,
    encode_u64,
};

use crate::error::AssetError;

pub const TICKER_STATUS_NOT_ASSIGNED: &str = "NOT_ASSIGNED";
pub const ASSET_PRECISION: u8 = 6;
/// Maximum scaled units: 10^38 - 1 (compatible with ProtocolQuantity).
pub const MAX_ASSET_QUANTITY: u128 = 99_999_999_999_999_999_999_999_999_999_999_999_999;
pub const REGISTRY_SCHEMA_VERSION: u32 = 1;
pub const METADATA_SCHEMA_VERSION: u32 = 1;
pub const CREATION_PROTOCOL_VERSION: &str = "1";

pub const SUNREY_COIN_ID: &str = "SUNREY_COIN";
pub const MOONREY_COIN_ID: &str = "MOONREY_COIN";
pub const SUNREY_COIN_DISPLAY: &str = "SunRey Coin";
pub const MOONREY_COIN_DISPLAY: &str = "MoonRey Coin";

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum NativeAssetId {
    SunReyCoin,
    MoonReyCoin,
}

impl NativeAssetId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SunReyCoin => SUNREY_COIN_ID,
            Self::MoonReyCoin => MOONREY_COIN_ID,
        }
    }

    pub fn display_name(self) -> &'static str {
        match self {
            Self::SunReyCoin => SUNREY_COIN_DISPLAY,
            Self::MoonReyCoin => MOONREY_COIN_DISPLAY,
        }
    }

    pub fn parse(value: &str) -> Result<Self, AssetError> {
        match value {
            SUNREY_COIN_ID => Ok(Self::SunReyCoin),
            MOONREY_COIN_ID => Ok(Self::MoonReyCoin),
            _ => Err(AssetError::AssetUnknown),
        }
    }

    pub fn all() -> [Self; 2] {
        [Self::SunReyCoin, Self::MoonReyCoin]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AssetClass {
    FungibleNativeAsset,
}

impl AssetClass {
    pub fn as_str(self) -> &'static str {
        "FUNGIBLE_NATIVE_ASSET"
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AssetStatus {
    Active,
    Disabled,
}

impl AssetStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "ACTIVE",
            Self::Disabled => "DISABLED",
        }
    }

    pub fn parse(value: &str) -> Result<Self, AssetError> {
        match value {
            "ACTIVE" => Ok(Self::Active),
            "DISABLED" => Ok(Self::Disabled),
            _ => Err(AssetError::SchemaInvalid),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FeeEligibility {
    EligibleAfterChunk42,
    NotEligible,
}

impl FeeEligibility {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::EligibleAfterChunk42 => "ELIGIBLE_AFTER_CHUNK_42",
            Self::NotEligible => "NOT_ELIGIBLE",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NativeAssetDefinition {
    pub asset_id: NativeAssetId,
    pub display_name: String,
    pub asset_class: AssetClass,
    pub precision: u8,
    pub maximum_quantity: u128,
    pub issuance_policy_id: String,
    pub transfer_policy_id: String,
    pub burn_policy_id: String,
    pub fee_eligibility: FeeEligibility,
    pub governance_policy_reference: String,
    pub creation_protocol_version: String,
    pub activation_height: u64,
    pub status: AssetStatus,
    pub metadata_schema_version: u32,
    pub ticker_status: String,
}

impl NativeAssetDefinition {
    pub fn encode(&self, out: &mut Vec<u8>) {
        encode_string(out, self.asset_id.as_str());
        encode_string(out, &self.display_name);
        encode_string(out, self.asset_class.as_str());
        encode_u32(out, u32::from(self.precision));
        encode_u128(out, self.maximum_quantity);
        encode_string(out, &self.issuance_policy_id);
        encode_string(out, &self.transfer_policy_id);
        encode_string(out, &self.burn_policy_id);
        encode_string(out, self.fee_eligibility.as_str());
        encode_string(out, &self.governance_policy_reference);
        encode_string(out, &self.creation_protocol_version);
        encode_u64(out, self.activation_height);
        encode_string(out, self.status.as_str());
        encode_u32(out, self.metadata_schema_version);
        encode_string(out, &self.ticker_status);
    }
}

fn sunrey_definition() -> NativeAssetDefinition {
    NativeAssetDefinition {
        asset_id: NativeAssetId::SunReyCoin,
        display_name: SUNREY_COIN_DISPLAY.to_string(),
        asset_class: AssetClass::FungibleNativeAsset,
        precision: ASSET_PRECISION,
        maximum_quantity: MAX_ASSET_QUANTITY,
        issuance_policy_id: "sunrey.issuance.sunrey_coin.v1".to_string(),
        transfer_policy_id: "sunrey.transfer.sunrey_coin.v1".to_string(),
        burn_policy_id: "sunrey.burn.sunrey_coin.v1".to_string(),
        fee_eligibility: FeeEligibility::EligibleAfterChunk42,
        governance_policy_reference: "gov.native.sunrey_coin.v1".to_string(),
        creation_protocol_version: CREATION_PROTOCOL_VERSION.to_string(),
        activation_height: 0,
        status: AssetStatus::Active,
        metadata_schema_version: METADATA_SCHEMA_VERSION,
        ticker_status: TICKER_STATUS_NOT_ASSIGNED.to_string(),
    }
}

fn moonrey_definition() -> NativeAssetDefinition {
    NativeAssetDefinition {
        asset_id: NativeAssetId::MoonReyCoin,
        display_name: MOONREY_COIN_DISPLAY.to_string(),
        asset_class: AssetClass::FungibleNativeAsset,
        precision: ASSET_PRECISION,
        maximum_quantity: MAX_ASSET_QUANTITY,
        issuance_policy_id: "sunrey.issuance.moonrey_coin.v1".to_string(),
        transfer_policy_id: "sunrey.transfer.moonrey_coin.v1".to_string(),
        burn_policy_id: "sunrey.burn.moonrey_coin.v1".to_string(),
        fee_eligibility: FeeEligibility::NotEligible,
        governance_policy_reference: "gov.native.moonrey_coin.v1".to_string(),
        creation_protocol_version: CREATION_PROTOCOL_VERSION.to_string(),
        activation_height: 0,
        status: AssetStatus::Active,
        metadata_schema_version: METADATA_SCHEMA_VERSION,
        ticker_status: TICKER_STATUS_NOT_ASSIGNED.to_string(),
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NativeAssetRegistry {
    pub schema_version: u32,
    pub assets: BTreeMap<NativeAssetId, NativeAssetDefinition>,
}

impl NativeAssetRegistry {
    pub fn development() -> Self {
        let mut assets = BTreeMap::new();
        assets.insert(NativeAssetId::SunReyCoin, sunrey_definition());
        assets.insert(NativeAssetId::MoonReyCoin, moonrey_definition());
        Self { schema_version: REGISTRY_SCHEMA_VERSION, assets }
    }

    pub fn get(&self, asset_id: NativeAssetId) -> Result<&NativeAssetDefinition, AssetError> {
        self.assets.get(&asset_id).ok_or(AssetError::AssetUnknown)
    }

    pub fn require_active(
        &self,
        asset_id: NativeAssetId,
        height: u64,
    ) -> Result<&NativeAssetDefinition, AssetError> {
        let def = self.get(asset_id)?;
        if def.status != AssetStatus::Active {
            return Err(AssetError::AssetInactive);
        }
        if height < def.activation_height {
            return Err(AssetError::AssetInactive);
        }
        if def.ticker_status != TICKER_STATUS_NOT_ASSIGNED {
            return Err(AssetError::SchemaInvalid);
        }
        Ok(def)
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_u32(&mut out, self.schema_version);
        encode_u32(&mut out, self.assets.len() as u32);
        for def in self.assets.values() {
            def.encode(&mut out);
        }
        out
    }

    pub fn list_public(&self) -> serde_json::Value {
        let items: Vec<serde_json::Value> = self
            .assets
            .values()
            .map(|def| {
                serde_json::json!({
                    "asset_id": def.asset_id.as_str(),
                    "display_name": def.display_name,
                    "asset_class": def.asset_class.as_str(),
                    "precision": def.precision,
                    "maximum_quantity": def.maximum_quantity.to_string(),
                    "ticker_status": def.ticker_status,
                    "status": def.status.as_str(),
                    "fee_eligibility": def.fee_eligibility.as_str(),
                    "activation_height": def.activation_height,
                    "creation_protocol_version": def.creation_protocol_version,
                    "metadata_schema_version": def.metadata_schema_version,
                })
            })
            .collect();
        serde_json::json!({
            "schema_version": self.schema_version,
            "assets": items,
        })
    }
}

pub fn decode_definition(input: &mut &[u8]) -> Result<NativeAssetDefinition, AssetError> {
    let asset_id =
        NativeAssetId::parse(&decode_string(input).map_err(|_| AssetError::DecodeFailed)?)?;
    let display_name = decode_string(input).map_err(|_| AssetError::DecodeFailed)?;
    let class = decode_string(input).map_err(|_| AssetError::DecodeFailed)?;
    if class != AssetClass::FungibleNativeAsset.as_str() {
        return Err(AssetError::SchemaInvalid);
    }
    let precision = decode_u32(input).map_err(|_| AssetError::DecodeFailed)? as u8;
    let maximum_quantity = decode_u128(input).map_err(|_| AssetError::DecodeFailed)?;
    let issuance_policy_id = decode_string(input).map_err(|_| AssetError::DecodeFailed)?;
    let transfer_policy_id = decode_string(input).map_err(|_| AssetError::DecodeFailed)?;
    let burn_policy_id = decode_string(input).map_err(|_| AssetError::DecodeFailed)?;
    let fee = decode_string(input).map_err(|_| AssetError::DecodeFailed)?;
    let fee_eligibility = match fee.as_str() {
        "ELIGIBLE_AFTER_CHUNK_42" => FeeEligibility::EligibleAfterChunk42,
        "NOT_ELIGIBLE" => FeeEligibility::NotEligible,
        _ => return Err(AssetError::SchemaInvalid),
    };
    let governance_policy_reference = decode_string(input).map_err(|_| AssetError::DecodeFailed)?;
    let creation_protocol_version = decode_string(input).map_err(|_| AssetError::DecodeFailed)?;
    let activation_height = decode_u64(input).map_err(|_| AssetError::DecodeFailed)?;
    let status = AssetStatus::parse(&decode_string(input).map_err(|_| AssetError::DecodeFailed)?)?;
    let metadata_schema_version = decode_u32(input).map_err(|_| AssetError::DecodeFailed)?;
    let ticker_status = decode_string(input).map_err(|_| AssetError::DecodeFailed)?;
    if ticker_status != TICKER_STATUS_NOT_ASSIGNED {
        return Err(AssetError::SchemaInvalid);
    }
    Ok(NativeAssetDefinition {
        asset_id,
        display_name,
        asset_class: AssetClass::FungibleNativeAsset,
        precision,
        maximum_quantity,
        issuance_policy_id,
        transfer_policy_id,
        burn_policy_id,
        fee_eligibility,
        governance_policy_reference,
        creation_protocol_version,
        activation_height,
        status,
        metadata_schema_version,
        ticker_status,
    })
}
