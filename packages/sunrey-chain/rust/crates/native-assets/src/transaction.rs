use serde::{Deserialize, Serialize};
use sunrey_protocol::{
    decode_string, decode_u32, decode_u64, encode_string, encode_u32, encode_u64,
};

use crate::error::AssetError;
use crate::quantity::AssetQuantity;
use crate::registry::NativeAssetId;
use crate::state::LockPurpose;

pub const NATIVE_ASSET_PAYLOAD_TAG: &str = "NativeAssetV1";
pub const NATIVE_ASSET_TX_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum NativeAssetOp {
    Transfer,
    Issue,
    Burn,
    Lock,
    Unlock,
}

impl NativeAssetOp {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Transfer => "NATIVE_ASSET_TRANSFER",
            Self::Issue => "NATIVE_ASSET_ISSUE",
            Self::Burn => "NATIVE_ASSET_BURN",
            Self::Lock => "NATIVE_ASSET_LOCK",
            Self::Unlock => "NATIVE_ASSET_UNLOCK",
        }
    }

    pub fn parse(value: &str) -> Result<Self, AssetError> {
        match value {
            "NATIVE_ASSET_TRANSFER" | "TRANSFER" => Ok(Self::Transfer),
            "NATIVE_ASSET_ISSUE" | "ISSUE" => Ok(Self::Issue),
            "NATIVE_ASSET_BURN" | "BURN" => Ok(Self::Burn),
            "NATIVE_ASSET_LOCK" | "LOCK" => Ok(Self::Lock),
            "NATIVE_ASSET_UNLOCK" | "UNLOCK" => Ok(Self::Unlock),
            _ => Err(AssetError::SchemaInvalid),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NativeAssetPayload {
    pub version: u32,
    pub op: NativeAssetOp,
    pub actor_id: String,
    pub asset_id: NativeAssetId,
    pub quantity: u128,
    pub counterparty: String,
    pub lock_id: String,
    pub lock_purpose: Option<LockPurpose>,
    pub expiration_height: Option<u64>,
    pub authorized_releaser: String,
    pub authorization_id: String,
    pub issuance_policy: String,
    pub proof_reference: String,
    pub economic_unit_label: String,
}

impl NativeAssetPayload {
    pub fn transfer(
        actor_id: impl Into<String>,
        recipient: impl Into<String>,
        quantity: AssetQuantity,
    ) -> Self {
        Self {
            version: NATIVE_ASSET_TX_VERSION,
            op: NativeAssetOp::Transfer,
            actor_id: actor_id.into(),
            asset_id: quantity.asset_id,
            quantity: quantity.scaled_units,
            counterparty: recipient.into(),
            lock_id: String::new(),
            lock_purpose: None,
            expiration_height: None,
            authorized_releaser: String::new(),
            authorization_id: String::new(),
            issuance_policy: String::new(),
            proof_reference: String::new(),
            economic_unit_label: String::new(),
        }
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, NATIVE_ASSET_PAYLOAD_TAG);
        encode_u32(&mut out, self.version);
        encode_string(&mut out, self.op.as_str());
        encode_string(&mut out, &self.actor_id);
        encode_string(&mut out, self.asset_id.as_str());
        sunrey_protocol::encode_u128(&mut out, self.quantity);
        encode_string(&mut out, &self.counterparty);
        encode_string(&mut out, &self.lock_id);
        match self.lock_purpose {
            Some(purpose) => {
                encode_u32(&mut out, 1);
                encode_string(&mut out, purpose.as_str());
            }
            None => encode_u32(&mut out, 0),
        }
        match self.expiration_height {
            Some(height) => {
                encode_u32(&mut out, 1);
                encode_u64(&mut out, height);
            }
            None => encode_u32(&mut out, 0),
        }
        encode_string(&mut out, &self.authorized_releaser);
        encode_string(&mut out, &self.authorization_id);
        encode_string(&mut out, &self.issuance_policy);
        encode_string(&mut out, &self.proof_reference);
        encode_string(&mut out, &self.economic_unit_label);
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, AssetError> {
        let (payload, rest) = Self::decode_prefix(bytes)?;
        if !rest.is_empty() {
            return Err(AssetError::SchemaInvalid);
        }
        Ok(payload)
    }

    pub fn decode_prefix(bytes: &[u8]) -> Result<(Self, &[u8]), AssetError> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        if tag != NATIVE_ASSET_PAYLOAD_TAG {
            return Err(AssetError::SchemaInvalid);
        }
        let version = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        if version != NATIVE_ASSET_TX_VERSION {
            return Err(AssetError::SchemaInvalid);
        }
        let op = NativeAssetOp::parse(
            &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
        )?;
        let actor_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let asset_id = NativeAssetId::parse(
            &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
        )?;
        let quantity =
            sunrey_protocol::decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let counterparty = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let lock_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let purpose_flag = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let lock_purpose = match purpose_flag {
            0 => None,
            1 => Some(LockPurpose::parse(
                &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
            )?),
            _ => return Err(AssetError::SchemaInvalid),
        };
        let exp_flag = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let expiration_height = match exp_flag {
            0 => None,
            1 => Some(decode_u64(&mut input).map_err(|_| AssetError::DecodeFailed)?),
            _ => return Err(AssetError::SchemaInvalid),
        };
        let authorized_releaser =
            decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let authorization_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let issuance_policy = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let proof_reference = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let economic_unit_label =
            decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        if quantity > AssetQuantity::MAX {
            return Err(AssetError::QuantityExceedsMaximum);
        }
        Ok((
            Self {
                version,
                op,
                actor_id,
                asset_id,
                quantity,
                counterparty,
                lock_id,
                lock_purpose,
                expiration_height,
                authorized_releaser,
                authorization_id,
                issuance_policy,
                proof_reference,
                economic_unit_label,
            },
            input,
        ))
    }

    pub fn looks_like(bytes: &[u8]) -> bool {
        let mut input = bytes;
        decode_string(&mut input).ok().is_some_and(|tag| tag == NATIVE_ASSET_PAYLOAD_TAG)
    }

    pub fn quantity(&self) -> Result<AssetQuantity, AssetError> {
        AssetQuantity::new(self.asset_id, self.quantity)
    }
}
