use serde::{Deserialize, Serialize};
use sunrey_protocol::{decode_string, decode_u128, encode_string, encode_u128};

use crate::error::AssetError;
use crate::registry::{NativeAssetId, ASSET_PRECISION, MAX_ASSET_QUANTITY};

/// Protocol-native integer quantity. Never floating-point.
/// Compatible with application `AssetQuantity` semantics: bigint scaled units,
/// explicit asset id, checked arithmetic, no implicit cross-asset math.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetQuantity {
    pub asset_id: NativeAssetId,
    pub scaled_units: u128,
}

impl AssetQuantity {
    pub const PRECISION: u8 = ASSET_PRECISION;
    pub const MAX: u128 = MAX_ASSET_QUANTITY;

    pub fn new(asset_id: NativeAssetId, scaled_units: u128) -> Result<Self, AssetError> {
        if scaled_units > Self::MAX {
            return Err(AssetError::QuantityExceedsMaximum);
        }
        Ok(Self { asset_id, scaled_units })
    }

    pub fn zero(asset_id: NativeAssetId) -> Self {
        Self { asset_id, scaled_units: 0 }
    }

    pub fn checked_add(self, other: Self) -> Result<Self, AssetError> {
        if self.asset_id != other.asset_id {
            return Err(AssetError::CrossAssetArithmetic);
        }
        let sum = self.scaled_units.checked_add(other.scaled_units).ok_or(AssetError::Overflow)?;
        if sum > Self::MAX {
            return Err(AssetError::Overflow);
        }
        Ok(Self { asset_id: self.asset_id, scaled_units: sum })
    }

    pub fn checked_sub(self, other: Self) -> Result<Self, AssetError> {
        if self.asset_id != other.asset_id {
            return Err(AssetError::CrossAssetArithmetic);
        }
        let diff = self.scaled_units.checked_sub(other.scaled_units).ok_or(AssetError::Overflow)?;
        Ok(Self { asset_id: self.asset_id, scaled_units: diff })
    }

    pub fn checked_mul(self, factor: u128) -> Result<Self, AssetError> {
        let product = self.scaled_units.checked_mul(factor).ok_or(AssetError::Overflow)?;
        if product > Self::MAX {
            return Err(AssetError::Overflow);
        }
        Ok(Self { asset_id: self.asset_id, scaled_units: product })
    }

    pub fn is_zero(self) -> bool {
        self.scaled_units == 0
    }

    pub fn encode(self, out: &mut Vec<u8>) {
        encode_string(out, self.asset_id.as_str());
        encode_u128(out, self.scaled_units);
    }

    pub fn decode(input: &mut &[u8]) -> Result<Self, AssetError> {
        let asset_id =
            NativeAssetId::parse(&decode_string(input).map_err(|_| AssetError::DecodeFailed)?)?;
        let scaled_units = decode_u128(input).map_err(|_| AssetError::DecodeFailed)?;
        Self::new(asset_id, scaled_units)
    }

    pub fn canonical_json(&self) -> serde_json::Value {
        serde_json::json!({
            "asset_id": self.asset_id.as_str(),
            "scaled_units": self.scaled_units.to_string(),
            "precision": Self::PRECISION,
        })
    }
}
