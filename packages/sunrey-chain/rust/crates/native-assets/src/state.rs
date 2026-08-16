use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sunrey_protocol::{
    decode_string, decode_u128, decode_u32, decode_u64, encode_string, encode_u32, encode_u64,
};

use crate::authority::{ECONOMIC_UNIT_LABEL_DEVELOPMENT, ECONOMIC_UNIT_LABEL_TEST};
use crate::error::AssetError;
use crate::quantity::AssetQuantity;
use crate::registry::{NativeAssetId, NativeAssetRegistry};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LockStatus {
    Locked,
    Released,
    Expired,
}

impl LockStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Locked => "LOCKED",
            Self::Released => "RELEASED",
            Self::Expired => "EXPIRED",
        }
    }

    pub fn parse(value: &str) -> Result<Self, AssetError> {
        match value {
            "LOCKED" => Ok(Self::Locked),
            "RELEASED" => Ok(Self::Released),
            "EXPIRED" => Ok(Self::Expired),
            _ => Err(AssetError::SchemaInvalid),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LockPurpose {
    ExchangeOrder,
    Escrow,
    Fee,
    ResourcePurchase,
    MachineCommerce,
    Settlement,
}

impl LockPurpose {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ExchangeOrder => "EXCHANGE_ORDER",
            Self::Escrow => "ESCROW",
            Self::Fee => "FEE",
            Self::ResourcePurchase => "RESOURCE_PURCHASE",
            Self::MachineCommerce => "MACHINE_COMMERCE",
            Self::Settlement => "SETTLEMENT",
        }
    }

    pub fn parse(value: &str) -> Result<Self, AssetError> {
        match value {
            "EXCHANGE_ORDER" => Ok(Self::ExchangeOrder),
            "ESCROW" => Ok(Self::Escrow),
            "FEE" => Ok(Self::Fee),
            "RESOURCE_PURCHASE" => Ok(Self::ResourcePurchase),
            "MACHINE_COMMERCE" => Ok(Self::MachineCommerce),
            "SETTLEMENT" => Ok(Self::Settlement),
            _ => Err(AssetError::SchemaInvalid),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetSupplyState {
    pub asset_id: NativeAssetId,
    pub issued: u128,
    pub burned: u128,
    pub circulating: u128,
    pub locked: u128,
    pub economic_unit_label: String,
}

impl AssetSupplyState {
    pub fn zero(asset_id: NativeAssetId) -> Self {
        Self {
            asset_id,
            issued: 0,
            burned: 0,
            circulating: 0,
            locked: 0,
            economic_unit_label: ECONOMIC_UNIT_LABEL_DEVELOPMENT.to_string(),
        }
    }

    pub fn reconcile(&self) -> Result<(), AssetError> {
        let left = self.issued.checked_sub(self.burned).ok_or(AssetError::SupplyInconsistency)?;
        let right =
            self.circulating.checked_add(self.locked).ok_or(AssetError::SupplyInconsistency)?;
        if left != right {
            return Err(AssetError::SupplyInconsistency);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetHolding {
    pub actor_id: String,
    pub asset_id: NativeAssetId,
    pub available: u128,
    pub locked: u128,
}

impl AssetHolding {
    pub fn total(&self) -> Result<u128, AssetError> {
        self.available.checked_add(self.locked).ok_or(AssetError::Overflow)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetLock {
    pub lock_id: String,
    pub owner: String,
    pub asset_id: NativeAssetId,
    pub quantity: u128,
    pub purpose: LockPurpose,
    pub created_height: u64,
    pub expiration_height: Option<u64>,
    pub authorized_releaser: String,
    pub status: LockStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetIssuanceRecord {
    pub record_id: String,
    pub authorization_id: String,
    pub asset_id: NativeAssetId,
    pub recipient: String,
    pub quantity: u128,
    pub height: u64,
    pub issuer: String,
    pub economic_unit_label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetBurnRecord {
    pub record_id: String,
    pub asset_id: NativeAssetId,
    pub holder: String,
    pub quantity: u128,
    pub height: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetTransferRecord {
    pub record_id: String,
    pub asset_id: NativeAssetId,
    pub sender: String,
    pub recipient: String,
    pub quantity: u128,
    pub height: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NativeAssetLedger {
    pub registry: NativeAssetRegistry,
    pub supplies: BTreeMap<NativeAssetId, AssetSupplyState>,
    pub holdings: BTreeMap<(String, NativeAssetId), AssetHolding>,
    pub locks: BTreeMap<String, AssetLock>,
    pub issuances: BTreeMap<String, AssetIssuanceRecord>,
    pub burns: BTreeMap<String, AssetBurnRecord>,
    pub transfers: BTreeMap<String, AssetTransferRecord>,
    pub used_authorizations: BTreeMap<String, String>,
}

impl Default for NativeAssetLedger {
    fn default() -> Self {
        Self::development()
    }
}

impl NativeAssetLedger {
    pub fn development() -> Self {
        let registry = NativeAssetRegistry::development();
        let mut supplies = BTreeMap::new();
        for id in NativeAssetId::all() {
            supplies.insert(id, AssetSupplyState::zero(id));
        }
        Self {
            registry,
            supplies,
            holdings: BTreeMap::new(),
            locks: BTreeMap::new(),
            issuances: BTreeMap::new(),
            burns: BTreeMap::new(),
            transfers: BTreeMap::new(),
            used_authorizations: BTreeMap::new(),
        }
    }

    pub fn holding(&self, actor: &str, asset: NativeAssetId) -> AssetHolding {
        self.holdings.get(&(actor.to_string(), asset)).cloned().unwrap_or(AssetHolding {
            actor_id: actor.to_string(),
            asset_id: asset,
            available: 0,
            locked: 0,
        })
    }

    pub fn available(&self, actor: &str, asset: NativeAssetId) -> u128 {
        self.holding(actor, asset).available
    }

    pub fn set_holding(&mut self, holding: AssetHolding) {
        if holding.available == 0 && holding.locked == 0 {
            self.holdings.remove(&(holding.actor_id.clone(), holding.asset_id));
        } else {
            self.holdings.insert((holding.actor_id.clone(), holding.asset_id), holding);
        }
    }

    pub fn credit_available(
        &mut self,
        actor: &str,
        asset: NativeAssetId,
        amount: u128,
    ) -> Result<(), AssetError> {
        let mut holding = self.holding(actor, asset);
        holding.available = holding.available.checked_add(amount).ok_or(AssetError::Overflow)?;
        if holding.available > AssetQuantity::MAX {
            return Err(AssetError::Overflow);
        }
        self.set_holding(holding);
        Ok(())
    }

    pub fn debit_available(
        &mut self,
        actor: &str,
        asset: NativeAssetId,
        amount: u128,
    ) -> Result<(), AssetError> {
        let mut holding = self.holding(actor, asset);
        if holding.available < amount {
            if holding.locked > 0 && holding.available + holding.locked >= amount {
                return Err(AssetError::AssetLocked);
            }
            return Err(AssetError::InsufficientAsset);
        }
        holding.available -= amount;
        self.set_holding(holding);
        Ok(())
    }

    pub fn supply(&self, asset: NativeAssetId) -> AssetSupplyState {
        self.supplies.get(&asset).cloned().unwrap_or_else(|| AssetSupplyState::zero(asset))
    }

    pub fn reconcile_all(&self) -> Result<(), AssetError> {
        for asset in NativeAssetId::all() {
            let supply = self.supply(asset);
            supply.reconcile()?;
            let mut held_available = 0u128;
            let mut held_locked = 0u128;
            for holding in self.holdings.values() {
                if holding.asset_id == asset {
                    held_available = held_available
                        .checked_add(holding.available)
                        .ok_or(AssetError::Overflow)?;
                    held_locked =
                        held_locked.checked_add(holding.locked).ok_or(AssetError::Overflow)?;
                }
            }
            let mut lock_sum = 0u128;
            for lock in self.locks.values() {
                if lock.asset_id == asset && lock.status == LockStatus::Locked {
                    lock_sum = lock_sum.checked_add(lock.quantity).ok_or(AssetError::Overflow)?;
                }
            }
            if held_available != supply.circulating
                || held_locked != supply.locked
                || lock_sum != supply.locked
            {
                return Err(AssetError::SupplyInconsistency);
            }
        }
        Ok(())
    }

    pub fn canonical_bytes(&self) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(&self.registry.encode());
        encode_u32(&mut out, self.supplies.len() as u32);
        for supply in self.supplies.values() {
            encode_string(&mut out, supply.asset_id.as_str());
            encode_u128_local(&mut out, supply.issued);
            encode_u128_local(&mut out, supply.burned);
            encode_u128_local(&mut out, supply.circulating);
            encode_u128_local(&mut out, supply.locked);
            encode_string(&mut out, &supply.economic_unit_label);
        }
        encode_u32(&mut out, self.holdings.len() as u32);
        for holding in self.holdings.values() {
            encode_string(&mut out, &holding.actor_id);
            encode_string(&mut out, holding.asset_id.as_str());
            encode_u128_local(&mut out, holding.available);
            encode_u128_local(&mut out, holding.locked);
        }
        encode_u32(&mut out, self.locks.len() as u32);
        for lock in self.locks.values() {
            encode_string(&mut out, &lock.lock_id);
            encode_string(&mut out, &lock.owner);
            encode_string(&mut out, lock.asset_id.as_str());
            encode_u128_local(&mut out, lock.quantity);
            encode_string(&mut out, lock.purpose.as_str());
            encode_u64(&mut out, lock.created_height);
            match lock.expiration_height {
                Some(h) => {
                    encode_u32(&mut out, 1);
                    encode_u64(&mut out, h);
                }
                None => encode_u32(&mut out, 0),
            }
            encode_string(&mut out, &lock.authorized_releaser);
            encode_string(&mut out, lock.status.as_str());
        }
        encode_u32(&mut out, self.used_authorizations.len() as u32);
        for (auth, record) in &self.used_authorizations {
            encode_string(&mut out, auth);
            encode_string(&mut out, record);
        }
        encode_u32(&mut out, self.issuances.len() as u32);
        for rec in self.issuances.values() {
            encode_string(&mut out, &rec.record_id);
            encode_string(&mut out, &rec.authorization_id);
            encode_string(&mut out, rec.asset_id.as_str());
            encode_string(&mut out, &rec.recipient);
            encode_u128_local(&mut out, rec.quantity);
            encode_u64(&mut out, rec.height);
            encode_string(&mut out, &rec.issuer);
            encode_string(&mut out, &rec.economic_unit_label);
        }
        encode_u32(&mut out, self.burns.len() as u32);
        for rec in self.burns.values() {
            encode_string(&mut out, &rec.record_id);
            encode_string(&mut out, rec.asset_id.as_str());
            encode_string(&mut out, &rec.holder);
            encode_u128_local(&mut out, rec.quantity);
            encode_u64(&mut out, rec.height);
        }
        encode_u32(&mut out, self.transfers.len() as u32);
        for rec in self.transfers.values() {
            encode_string(&mut out, &rec.record_id);
            encode_string(&mut out, rec.asset_id.as_str());
            encode_string(&mut out, &rec.sender);
            encode_string(&mut out, &rec.recipient);
            encode_u128_local(&mut out, rec.quantity);
            encode_u64(&mut out, rec.height);
        }
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, AssetError> {
        use crate::registry::{decode_definition, NativeAssetRegistry, REGISTRY_SCHEMA_VERSION};
        let mut input = bytes;
        let schema_version = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let asset_count = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)? as usize;
        let mut assets = BTreeMap::new();
        for _ in 0..asset_count {
            let def = decode_definition(&mut input)?;
            assets.insert(def.asset_id, def);
        }
        let registry = NativeAssetRegistry { schema_version, assets };
        if registry.schema_version != REGISTRY_SCHEMA_VERSION {
            return Err(AssetError::SchemaInvalid);
        }
        let supply_count = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)? as usize;
        let mut supplies = BTreeMap::new();
        for _ in 0..supply_count {
            let asset_id = NativeAssetId::parse(
                &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
            )?;
            supplies.insert(
                asset_id,
                AssetSupplyState {
                    asset_id,
                    issued: decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                    burned: decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                    circulating: decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                    locked: decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                    economic_unit_label: decode_string(&mut input)
                        .map_err(|_| AssetError::DecodeFailed)?,
                },
            );
        }
        let holding_count = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)? as usize;
        let mut holdings = BTreeMap::new();
        for _ in 0..holding_count {
            let actor_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let asset_id = NativeAssetId::parse(
                &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
            )?;
            let holding = AssetHolding {
                actor_id: actor_id.clone(),
                asset_id,
                available: decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                locked: decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?,
            };
            holdings.insert((actor_id, asset_id), holding);
        }
        let lock_count = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)? as usize;
        let mut locks = BTreeMap::new();
        for _ in 0..lock_count {
            let lock_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let owner = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let asset_id = NativeAssetId::parse(
                &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
            )?;
            let quantity = decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let purpose = crate::state::LockPurpose::parse(
                &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
            )?;
            let created_height = decode_u64(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let expiration_height = crate::state::decode_optional_u64(&mut input)?;
            let authorized_releaser =
                decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let status = LockStatus::parse(
                &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
            )?;
            locks.insert(
                lock_id.clone(),
                AssetLock {
                    lock_id,
                    owner,
                    asset_id,
                    quantity,
                    purpose,
                    created_height,
                    expiration_height,
                    authorized_releaser,
                    status,
                },
            );
        }
        let used_count = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)? as usize;
        let mut used_authorizations = BTreeMap::new();
        for _ in 0..used_count {
            let auth = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let record = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            used_authorizations.insert(auth, record);
        }
        let iss_count = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)? as usize;
        let mut issuances = BTreeMap::new();
        for _ in 0..iss_count {
            let record_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let rec = AssetIssuanceRecord {
                record_id: record_id.clone(),
                authorization_id: decode_string(&mut input)
                    .map_err(|_| AssetError::DecodeFailed)?,
                asset_id: NativeAssetId::parse(
                    &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                )?,
                recipient: decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                quantity: decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                height: decode_u64(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                issuer: decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                economic_unit_label: decode_string(&mut input)
                    .map_err(|_| AssetError::DecodeFailed)?,
            };
            issuances.insert(record_id, rec);
        }
        let burn_count = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)? as usize;
        let mut burns = BTreeMap::new();
        for _ in 0..burn_count {
            let record_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let rec = AssetBurnRecord {
                record_id: record_id.clone(),
                asset_id: NativeAssetId::parse(
                    &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                )?,
                holder: decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                quantity: decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                height: decode_u64(&mut input).map_err(|_| AssetError::DecodeFailed)?,
            };
            burns.insert(record_id, rec);
        }
        let xfer_count = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)? as usize;
        let mut transfers = BTreeMap::new();
        for _ in 0..xfer_count {
            let record_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let rec = AssetTransferRecord {
                record_id: record_id.clone(),
                asset_id: NativeAssetId::parse(
                    &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                )?,
                sender: decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                recipient: decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                quantity: decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?,
                height: decode_u64(&mut input).map_err(|_| AssetError::DecodeFailed)?,
            };
            transfers.insert(record_id, rec);
        }
        if !input.is_empty() {
            return Err(AssetError::SchemaInvalid);
        }
        Ok(Self {
            registry,
            supplies,
            holdings,
            locks,
            issuances,
            burns,
            transfers,
            used_authorizations,
        })
    }

    pub fn holdings_for(&self, actor: &str) -> Vec<AssetHolding> {
        self.holdings.values().filter(|h| h.actor_id == actor).cloned().collect()
    }

    pub fn locks_for(&self, actor: &str) -> Vec<AssetLock> {
        self.locks.values().filter(|l| l.owner == actor).cloned().collect()
    }

    pub fn public_supply(&self, asset: NativeAssetId) -> serde_json::Value {
        let s = self.supply(asset);
        serde_json::json!({
            "asset_id": asset.as_str(),
            "ticker_status": "NOT_ASSIGNED",
            "issued": s.issued.to_string(),
            "burned": s.burned.to_string(),
            "circulating": s.circulating.to_string(),
            "locked": s.locked.to_string(),
            "economic_unit_label": s.economic_unit_label,
            "authority": "NATIVE_BLOCKCHAIN_AUTHORITY",
            "application_supply_imported": false,
        })
    }
}

fn encode_u128_local(out: &mut Vec<u8>, value: u128) {
    sunrey_protocol::encode_u128(out, value);
}

pub fn decode_optional_u64(input: &mut &[u8]) -> Result<Option<u64>, AssetError> {
    let flag = decode_u32(input).map_err(|_| AssetError::DecodeFailed)?;
    match flag {
        0 => Ok(None),
        1 => Ok(Some(decode_u64(input).map_err(|_| AssetError::DecodeFailed)?)),
        _ => Err(AssetError::SchemaInvalid),
    }
}

pub fn test_unit_label() -> &'static str {
    ECONOMIC_UNIT_LABEL_TEST
}
