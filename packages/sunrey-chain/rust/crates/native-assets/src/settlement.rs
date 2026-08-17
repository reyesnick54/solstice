//! Atomic native-chain exchange settlement (delivery-versus-payment).
//!
//! Matching stays off-chain. This module applies reserved native-asset
//! legs atomically under a signed exchange settlement authority.
//! Either every leg commits or none do. Not a second exchange ledger.

use serde::{Deserialize, Serialize};
use sunrey_protocol::{
    decode_string, decode_u32, decode_u64, encode_string, encode_u32, encode_u64,
};

use crate::crypto_policy::{AssetCrypto, CryptoPolicy};
use crate::error::AssetError;
use crate::registry::NativeAssetId;
use crate::state::{ExchangeSettlementRecord, LockStatus, NativeAssetLedger};

pub const EXCHANGE_SETTLEMENT_TAG: &str = "ExchangeSettlementV1";
pub const EXCHANGE_SETTLEMENT_AUTH_TAG: &str = "ExchangeSettlementAuthV1";
pub const EXCHANGE_SETTLEMENT_ISSUER: &str = "sunrey.exchange.settlement.authority";
pub const EXCHANGE_SETTLEMENT_POLICY: &str = "sunrey.exchange.settlement.policy.v1";
pub const SETTLEMENT_TX_VERSION: u32 = 1;

pub const MAX_BATCH_TRADES: u32 = 64;
pub const MAX_BATCH_BYTES: u32 = 65_536;
pub const MAX_BATCH_EXECUTION_UNITS: u32 = 10_000;
pub const MAX_BATCH_LEGS: u32 = 256;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SettlementLegKind {
    Base,
    Quote,
    TradingFee,
    NetworkFee,
}

impl SettlementLegKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Base => "BASE",
            Self::Quote => "QUOTE",
            Self::TradingFee => "TRADING_FEE",
            Self::NetworkFee => "NETWORK_FEE",
        }
    }

    pub fn parse(value: &str) -> Result<Self, AssetError> {
        match value {
            "BASE" => Ok(Self::Base),
            "QUOTE" => Ok(Self::Quote),
            "TRADING_FEE" => Ok(Self::TradingFee),
            "NETWORK_FEE" => Ok(Self::NetworkFee),
            _ => Err(AssetError::SchemaInvalid),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SettlementSource {
    Available,
    Lock { lock_id: String },
}

impl SettlementSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Available => "AVAILABLE",
            Self::Lock { .. } => "LOCK",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SettlementLeg {
    pub asset_id: NativeAssetId,
    pub from: String,
    pub to: String,
    pub quantity: u128,
    pub source: SettlementSource,
    pub kind: SettlementLegKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExchangeSettlementAuthority {
    pub settlement_id: String,
    pub issuer: String,
    pub policy_version: String,
    pub network_id: String,
    pub chain_id: String,
    pub nonce: u64,
    pub expiration_height: u64,
    pub suite_id: String,
    pub algorithm_id: String,
    pub public_key: Vec<u8>,
    pub signature: Vec<u8>,
}

impl ExchangeSettlementAuthority {
    pub fn unsigned_bytes(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, EXCHANGE_SETTLEMENT_AUTH_TAG);
        encode_string(&mut out, &self.settlement_id);
        encode_string(&mut out, &self.issuer);
        encode_string(&mut out, &self.policy_version);
        encode_string(&mut out, &self.network_id);
        encode_string(&mut out, &self.chain_id);
        encode_u64(&mut out, self.nonce);
        encode_u64(&mut out, self.expiration_height);
        out
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = self.unsigned_bytes();
        encode_string(&mut out, &self.suite_id);
        encode_string(&mut out, &self.algorithm_id);
        sunrey_protocol::encode_bytes(&mut out, &self.public_key);
        sunrey_protocol::encode_bytes(&mut out, &self.signature);
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<(Self, &[u8]), AssetError> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        if tag != EXCHANGE_SETTLEMENT_AUTH_TAG {
            return Err(AssetError::SchemaInvalid);
        }
        let settlement_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let issuer = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let policy_version = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let network_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let chain_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let nonce = decode_u64(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let expiration_height = decode_u64(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let suite_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let algorithm_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let public_key =
            sunrey_protocol::decode_bytes(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let signature =
            sunrey_protocol::decode_bytes(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        Ok((
            Self {
                settlement_id,
                issuer,
                policy_version,
                network_id,
                chain_id,
                nonce,
                expiration_height,
                suite_id,
                algorithm_id,
                public_key,
                signature,
            },
            input,
        ))
    }

    pub fn verify(
        &self,
        crypto: &dyn AssetCrypto,
        policy: &CryptoPolicy,
        ctx_network: &str,
        ctx_chain: &str,
        height: u64,
        settlement_id: &str,
    ) -> Result<(), AssetError> {
        if self.issuer != EXCHANGE_SETTLEMENT_ISSUER {
            return Err(AssetError::WrongAuthority);
        }
        if self.policy_version != EXCHANGE_SETTLEMENT_POLICY {
            return Err(AssetError::PolicyDenied);
        }
        if self.settlement_id != settlement_id {
            return Err(AssetError::UnauthorizedSettlement);
        }
        if self.network_id != ctx_network {
            return Err(AssetError::WrongNetwork);
        }
        if self.chain_id != ctx_chain {
            return Err(AssetError::WrongChain);
        }
        if height > self.expiration_height {
            return Err(AssetError::AuthorizationExpired);
        }
        if self.suite_id != crypto.suite_id() || self.suite_id != policy.suite_id {
            return Err(AssetError::InvalidCryptoSuite);
        }
        if self.algorithm_id != crypto.algorithm_id() {
            return Err(AssetError::InvalidCryptoSuite);
        }
        crypto.verify(&self.public_key, &self.unsigned_bytes(), &self.signature)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExchangeSettlementPayload {
    pub version: u32,
    pub settlement_id: String,
    pub trade_ids: Vec<String>,
    pub buyer: String,
    pub seller: String,
    pub base_asset: NativeAssetId,
    pub base_quantity: u128,
    pub quote_asset: NativeAssetId,
    pub quote_quantity: u128,
    pub reservation_refs: Vec<String>,
    pub expiration_height: u64,
    pub policy_version: String,
    pub network_id: String,
    pub chain_id: String,
    pub nonce: u64,
    pub legs: Vec<SettlementLeg>,
    pub authority: ExchangeSettlementAuthority,
}

impl ExchangeSettlementPayload {
    pub fn looks_like(bytes: &[u8]) -> bool {
        let mut input = bytes;
        decode_string(&mut input).ok().is_some_and(|tag| tag == EXCHANGE_SETTLEMENT_TAG)
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, EXCHANGE_SETTLEMENT_TAG);
        encode_u32(&mut out, self.version);
        encode_string(&mut out, &self.settlement_id);
        encode_u32(&mut out, self.trade_ids.len() as u32);
        for id in &self.trade_ids {
            encode_string(&mut out, id);
        }
        encode_string(&mut out, &self.buyer);
        encode_string(&mut out, &self.seller);
        encode_string(&mut out, self.base_asset.as_str());
        sunrey_protocol::encode_u128(&mut out, self.base_quantity);
        encode_string(&mut out, self.quote_asset.as_str());
        sunrey_protocol::encode_u128(&mut out, self.quote_quantity);
        encode_u32(&mut out, self.reservation_refs.len() as u32);
        for r in &self.reservation_refs {
            encode_string(&mut out, r);
        }
        encode_u64(&mut out, self.expiration_height);
        encode_string(&mut out, &self.policy_version);
        encode_string(&mut out, &self.network_id);
        encode_string(&mut out, &self.chain_id);
        encode_u64(&mut out, self.nonce);
        encode_u32(&mut out, self.legs.len() as u32);
        for leg in &self.legs {
            encode_string(&mut out, leg.asset_id.as_str());
            encode_string(&mut out, &leg.from);
            encode_string(&mut out, &leg.to);
            sunrey_protocol::encode_u128(&mut out, leg.quantity);
            match &leg.source {
                SettlementSource::Available => {
                    encode_string(&mut out, "AVAILABLE");
                    encode_string(&mut out, "");
                }
                SettlementSource::Lock { lock_id } => {
                    encode_string(&mut out, "LOCK");
                    encode_string(&mut out, lock_id);
                }
            }
            encode_string(&mut out, leg.kind.as_str());
        }
        out.extend_from_slice(&self.authority.encode());
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
        if tag != EXCHANGE_SETTLEMENT_TAG {
            return Err(AssetError::SchemaInvalid);
        }
        let version = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        if version != SETTLEMENT_TX_VERSION {
            return Err(AssetError::SchemaInvalid);
        }
        let settlement_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let trade_count = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)? as usize;
        let mut trade_ids = Vec::with_capacity(trade_count);
        for _ in 0..trade_count {
            trade_ids.push(decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?);
        }
        let buyer = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let seller = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let base_asset = NativeAssetId::parse(
            &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
        )?;
        let base_quantity =
            sunrey_protocol::decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let quote_asset = NativeAssetId::parse(
            &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
        )?;
        let quote_quantity =
            sunrey_protocol::decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let res_count = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)? as usize;
        let mut reservation_refs = Vec::with_capacity(res_count);
        for _ in 0..res_count {
            reservation_refs.push(decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?);
        }
        let expiration_height = decode_u64(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let policy_version = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let network_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let chain_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let nonce = decode_u64(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let leg_count = decode_u32(&mut input).map_err(|_| AssetError::DecodeFailed)? as usize;
        let mut legs = Vec::with_capacity(leg_count);
        for _ in 0..leg_count {
            let asset_id = NativeAssetId::parse(
                &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
            )?;
            let from = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let to = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let quantity =
                sunrey_protocol::decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let source_kind = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let lock_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
            let source = match source_kind.as_str() {
                "AVAILABLE" => SettlementSource::Available,
                "LOCK" => SettlementSource::Lock { lock_id },
                _ => return Err(AssetError::SchemaInvalid),
            };
            let kind = SettlementLegKind::parse(
                &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
            )?;
            legs.push(SettlementLeg { asset_id, from, to, quantity, source, kind });
        }
        let (authority, rest) = ExchangeSettlementAuthority::decode(input)?;
        Ok((
            Self {
                version,
                settlement_id,
                trade_ids,
                buyer,
                seller,
                base_asset,
                base_quantity,
                quote_quantity,
                quote_asset,
                reservation_refs,
                expiration_height,
                policy_version,
                network_id,
                chain_id,
                nonce,
                legs,
                authority,
            },
            rest,
        ))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BatchMode {
    AtomicAll,
    IndividuallyAtomic,
}

impl BatchMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::AtomicAll => "ATOMIC_ALL",
            Self::IndividuallyAtomic => "INDIVIDUALLY_ATOMIC",
        }
    }

    pub fn parse(value: &str) -> Result<Self, AssetError> {
        match value {
            "ATOMIC_ALL" => Ok(Self::AtomicAll),
            "INDIVIDUALLY_ATOMIC" => Ok(Self::IndividuallyAtomic),
            _ => Err(AssetError::SchemaInvalid),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SettlementBatch {
    pub batch_id: String,
    pub mode: BatchMode,
    pub settlements: Vec<ExchangeSettlementPayload>,
}

pub struct SettlementApplyContext<'a> {
    pub height: u64,
    pub network_id: &'a str,
    pub chain_id: &'a str,
    pub crypto: &'a dyn AssetCrypto,
    pub crypto_policy: &'a CryptoPolicy,
}

fn validate_payload(
    payload: &ExchangeSettlementPayload,
    ctx: &SettlementApplyContext<'_>,
) -> Result<(), AssetError> {
    if payload.buyer.is_empty()
        || payload.seller.is_empty()
        || payload.buyer == payload.seller
        || payload.settlement_id.is_empty()
        || payload.trade_ids.is_empty()
        || payload.legs.is_empty()
    {
        return Err(AssetError::StatelessInvalid);
    }
    if payload.base_asset == payload.quote_asset {
        return Err(AssetError::WrongAsset);
    }
    if payload.base_quantity == 0 || payload.quote_quantity == 0 {
        return Err(AssetError::QuantityZero);
    }
    if payload.network_id != ctx.network_id {
        return Err(AssetError::WrongNetwork);
    }
    if payload.chain_id != ctx.chain_id {
        return Err(AssetError::WrongChain);
    }
    if payload.policy_version != EXCHANGE_SETTLEMENT_POLICY {
        return Err(AssetError::PolicyDenied);
    }
    if ctx.height > payload.expiration_height {
        return Err(AssetError::AuthorizationExpired);
    }
    payload.authority.verify(
        ctx.crypto,
        ctx.crypto_policy,
        ctx.network_id,
        ctx.chain_id,
        ctx.height,
        &payload.settlement_id,
    )?;
    let mut base_out = 0u128;
    let mut quote_out = 0u128;
    for leg in &payload.legs {
        if leg.quantity == 0 || leg.from.is_empty() || leg.to.is_empty() || leg.from == leg.to {
            return Err(AssetError::StatelessInvalid);
        }
        match leg.kind {
            SettlementLegKind::Base => {
                if leg.asset_id != payload.base_asset {
                    return Err(AssetError::WrongAsset);
                }
                if leg.from != payload.seller || leg.to != payload.buyer {
                    return Err(AssetError::UnauthorizedSettlement);
                }
                base_out = base_out.checked_add(leg.quantity).ok_or(AssetError::Overflow)?;
            }
            SettlementLegKind::Quote => {
                if leg.asset_id != payload.quote_asset {
                    return Err(AssetError::WrongAsset);
                }
                if leg.from != payload.buyer || leg.to != payload.seller {
                    return Err(AssetError::UnauthorizedSettlement);
                }
                quote_out = quote_out.checked_add(leg.quantity).ok_or(AssetError::Overflow)?;
            }
            SettlementLegKind::TradingFee | SettlementLegKind::NetworkFee => {
                if leg.asset_id != payload.base_asset && leg.asset_id != payload.quote_asset {
                    return Err(AssetError::WrongAsset);
                }
            }
        }
        if let SettlementSource::Lock { lock_id } = &leg.source {
            if !payload.reservation_refs.iter().any(|r| r == lock_id) {
                return Err(AssetError::ReservationMismatch);
            }
        }
    }
    if base_out != payload.base_quantity || quote_out != payload.quote_quantity {
        return Err(AssetError::UnauthorizedSettlement);
    }
    Ok(())
}

fn consume_lock(
    ledger: &mut NativeAssetLedger,
    lock_id: &str,
    expected_owner: &str,
    asset: NativeAssetId,
    quantity: u128,
) -> Result<(), AssetError> {
    let mut lock = ledger.locks.get(lock_id).cloned().ok_or(AssetError::LockNotFound)?;
    if lock.status != LockStatus::Locked {
        return Err(AssetError::StatefulInvalid);
    }
    if lock.owner != expected_owner {
        return Err(AssetError::LockNotOwned);
    }
    if lock.asset_id != asset {
        return Err(AssetError::WrongAsset);
    }
    if lock.quantity < quantity {
        return Err(AssetError::InsufficientReservation);
    }
    let mut holding = ledger.holding(&lock.owner, lock.asset_id);
    if holding.locked < quantity {
        return Err(AssetError::SupplyInconsistency);
    }
    holding.locked -= quantity;
    ledger.set_holding(holding);
    let mut supply = ledger.supply(lock.asset_id);
    supply.locked = supply.locked.checked_sub(quantity).ok_or(AssetError::SupplyInconsistency)?;
    supply.circulating = supply.circulating.checked_add(quantity).ok_or(AssetError::Overflow)?;
    ledger.supplies.insert(lock.asset_id, supply);
    lock.quantity -= quantity;
    if lock.quantity == 0 {
        lock.status = LockStatus::Released;
    }
    ledger.locks.insert(lock.lock_id.clone(), lock);
    Ok(())
}

fn apply_leg(ledger: &mut NativeAssetLedger, leg: &SettlementLeg) -> Result<(), AssetError> {
    match &leg.source {
        SettlementSource::Available => {
            ledger.debit_available(&leg.from, leg.asset_id, leg.quantity)?;
        }
        SettlementSource::Lock { lock_id } => {
            consume_lock(ledger, lock_id, &leg.from, leg.asset_id, leg.quantity)?;
        }
    }
    ledger.credit_available(&leg.to, leg.asset_id, leg.quantity)
}

fn apply_settlement_inner(
    ledger: &mut NativeAssetLedger,
    payload: &ExchangeSettlementPayload,
    ctx: &SettlementApplyContext<'_>,
) -> Result<(), AssetError> {
    validate_payload(payload, ctx)?;
    if ledger.used_settlements.contains_key(&payload.settlement_id) {
        return Err(AssetError::SettlementReplay);
    }
    if ledger
        .used_settlement_nonces
        .contains_key(&(payload.authority.issuer.clone(), payload.nonce))
    {
        return Err(AssetError::SettlementReplay);
    }
    for trade_id in &payload.trade_ids {
        if ledger.settled_trades.contains_key(trade_id) {
            return Err(AssetError::TradeAlreadySettled);
        }
    }
    ledger.require_exchange_authority(&payload.authority.issuer, &payload.authority.public_key)?;
    for leg in &payload.legs {
        apply_leg(ledger, leg)?;
    }
    ledger.used_settlements.insert(payload.settlement_id.clone(), payload.trade_ids.join(","));
    ledger
        .used_settlement_nonces
        .insert((payload.authority.issuer.clone(), payload.nonce), payload.settlement_id.clone());
    for trade_id in &payload.trade_ids {
        ledger.settled_trades.insert(trade_id.clone(), payload.base_quantity);
    }
    ledger.settlement_records.insert(
        payload.settlement_id.clone(),
        ExchangeSettlementRecord {
            settlement_id: payload.settlement_id.clone(),
            trade_ids: payload.trade_ids.clone(),
            height: ctx.height,
        },
    );
    ledger.reconcile_all()
}

/// Apply one exchange settlement. The original ledger is unchanged on error.
pub fn apply_exchange_settlement(
    ledger: &mut NativeAssetLedger,
    payload: &ExchangeSettlementPayload,
    ctx: &SettlementApplyContext<'_>,
) -> Result<(), AssetError> {
    let mut candidate = ledger.clone();
    apply_settlement_inner(&mut candidate, payload, ctx)?;
    *ledger = candidate;
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BatchApplyResult {
    pub applied: Vec<String>,
    pub rejected: Vec<(String, String)>,
}

pub fn apply_settlement_batch(
    ledger: &mut NativeAssetLedger,
    batch: &SettlementBatch,
    ctx: &SettlementApplyContext<'_>,
) -> Result<BatchApplyResult, AssetError> {
    if batch.settlements.len() as u32 > MAX_BATCH_TRADES {
        return Err(AssetError::BatchLimitExceeded);
    }
    let total_legs: u32 = batch.settlements.iter().map(|s| s.legs.len() as u32).sum();
    if total_legs > MAX_BATCH_LEGS {
        return Err(AssetError::BatchLimitExceeded);
    }
    let encoded_len: u32 = batch.settlements.iter().map(|s| s.encode().len() as u32).sum();
    if encoded_len > MAX_BATCH_BYTES {
        return Err(AssetError::BatchLimitExceeded);
    }
    let execution_units =
        total_legs.saturating_mul(8).saturating_add(batch.settlements.len() as u32);
    if execution_units > MAX_BATCH_EXECUTION_UNITS {
        return Err(AssetError::BatchLimitExceeded);
    }
    match batch.mode {
        BatchMode::AtomicAll => {
            let mut candidate = ledger.clone();
            let mut applied = Vec::new();
            for settlement in &batch.settlements {
                apply_settlement_inner(&mut candidate, settlement, ctx)?;
                applied.push(settlement.settlement_id.clone());
            }
            *ledger = candidate;
            Ok(BatchApplyResult { applied, rejected: Vec::new() })
        }
        BatchMode::IndividuallyAtomic => {
            let mut applied = Vec::new();
            let mut rejected = Vec::new();
            for settlement in &batch.settlements {
                match apply_exchange_settlement(ledger, settlement, ctx) {
                    Ok(()) => applied.push(settlement.settlement_id.clone()),
                    Err(err) => {
                        rejected.push((settlement.settlement_id.clone(), err.as_str().to_string()))
                    }
                }
            }
            Ok(BatchApplyResult { applied, rejected })
        }
    }
}
