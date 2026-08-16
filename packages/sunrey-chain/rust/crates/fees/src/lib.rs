//! Deterministic SunRey native fees and resource metering.
//!
//! Integer minor units only. No floating point. Not a fiat ledger debit.
//! Fee parameters change only at a height-activated governed upgrade.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sunrey_protocol::{decode_string, decode_u128, encode_string, encode_u128, RejectReason};

pub const PRIORITY_SCALE: u128 = 1_000_000;
pub const FEE_INTENT_TAG: &str = "FeeIntentV1";
pub const BPS_DENOM: u128 = 10_000;
pub const MAX_TX_EXECUTION_UNITS: u128 = 100_000;
pub const NETWORK_SINK_ACCOUNT: &str = "sunrey.fees.network_sink";
pub const BURN_ACCOUNT: &str = "sunrey.fees.burn";
pub const TREASURY_ACCOUNT: &str = "sunrey.fees.treasury";
pub const REWARD_POOL_ACCOUNT: &str = "sunrey.fees.validator_reward_pool";
pub const FAUCET_ACCOUNT: &str = "sunrey.fees.development_faucet";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FeeAsset {
    SunreyCoin,
    MoonreyCoin,
}

impl FeeAsset {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SunreyCoin => "SUNREY_COIN",
            Self::MoonreyCoin => "MOONREY_COIN",
        }
    }

    pub fn parse(value: &str) -> Result<Self, RejectReason> {
        match value {
            "SUNREY_COIN" => Ok(Self::SunreyCoin),
            "MOONREY_COIN" => Ok(Self::MoonreyCoin),
            _ => Err(RejectReason::UnsupportedFeeAsset),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FeeExemption {
    None,
    DevelopmentFaucet,
    DevelopmentProtocol,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProtocolOp {
    NativeTransfer,
    NativeIssuanceVerify,
    NativeLock,
    NativeUnlock,
    GovernanceSignatureVerify,
    ValidatorOperation,
    EvidenceVerification,
    OrdinaryStateRead,
    OrdinaryStateWrite,
    SystemSetObject,
    SystemNote,
    DevelopmentFaucet,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub compute: u128,
    pub state_read: u128,
    pub state_write: u128,
    pub tx_bytes: u128,
    pub sig_verify: u128,
    pub crypto_proof: u128,
}

impl ResourceUsage {
    pub fn total(self) -> u128 {
        self.compute
            + self.state_read
            + self.state_write
            + self.tx_bytes
            + self.sig_verify
            + self.crypto_proof
    }

    pub fn saturating_add(self, other: Self) -> Self {
        Self {
            compute: self.compute.saturating_add(other.compute),
            state_read: self.state_read.saturating_add(other.state_read),
            state_write: self.state_write.saturating_add(other.state_write),
            tx_bytes: self.tx_bytes.saturating_add(other.tx_bytes),
            sig_verify: self.sig_verify.saturating_add(other.sig_verify),
            crypto_proof: self.crypto_proof.saturating_add(other.crypto_proof),
        }
    }
}

pub fn cost_table(op: ProtocolOp) -> ResourceUsage {
    match op {
        ProtocolOp::NativeTransfer => ResourceUsage {
            compute: 100,
            state_read: 2,
            state_write: 2,
            ..ResourceUsage::default()
        },
        ProtocolOp::NativeIssuanceVerify => {
            ResourceUsage { compute: 50, state_read: 1, ..ResourceUsage::default() }
        }
        ProtocolOp::NativeLock | ProtocolOp::NativeUnlock => {
            ResourceUsage { compute: 80, state_read: 1, state_write: 1, ..ResourceUsage::default() }
        }
        ProtocolOp::GovernanceSignatureVerify => {
            ResourceUsage { compute: 40, sig_verify: 1, ..ResourceUsage::default() }
        }
        ProtocolOp::ValidatorOperation => ResourceUsage {
            compute: 120,
            state_read: 2,
            state_write: 1,
            ..ResourceUsage::default()
        },
        ProtocolOp::EvidenceVerification => ResourceUsage {
            compute: 90,
            state_read: 1,
            state_write: 1,
            crypto_proof: 1,
            ..ResourceUsage::default()
        },
        ProtocolOp::OrdinaryStateRead => {
            ResourceUsage { compute: 10, state_read: 1, ..ResourceUsage::default() }
        }
        ProtocolOp::OrdinaryStateWrite | ProtocolOp::SystemSetObject => {
            ResourceUsage { compute: 20, state_write: 1, ..ResourceUsage::default() }
        }
        ProtocolOp::SystemNote => {
            ResourceUsage { compute: 10, state_write: 1, ..ResourceUsage::default() }
        }
        ProtocolOp::DevelopmentFaucet => {
            ResourceUsage { compute: 30, state_write: 1, ..ResourceUsage::default() }
        }
    }
}

pub fn usage_for(op: ProtocolOp, encoded_bytes: u128, signature_count: u128) -> ResourceUsage {
    let mut usage = cost_table(op);
    usage.tx_bytes = encoded_bytes;
    usage.sig_verify = usage.sig_verify.saturating_add(signature_count);
    usage
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeeSchedule {
    pub version: u32,
    pub activation_height: u64,
    pub base_transaction_fee: u128,
    pub per_byte_fee: u128,
    pub compute_unit_fee: u128,
    pub state_read_fee: u128,
    pub state_write_fee: u128,
    pub signature_verify_fee: u128,
    pub cryptographic_proof_fee: u128,
    pub minimum_fee: u128,
}

impl FeeSchedule {
    pub fn development() -> Self {
        Self {
            version: 1,
            activation_height: 0,
            base_transaction_fee: 100,
            per_byte_fee: 1,
            compute_unit_fee: 2,
            state_read_fee: 3,
            state_write_fee: 5,
            signature_verify_fee: 20,
            cryptographic_proof_fee: 25,
            minimum_fee: 100,
        }
    }

    pub fn calculate(&self, usage: ResourceUsage) -> Result<u128, RejectReason> {
        let parts = [
            self.base_transaction_fee,
            self.per_byte_fee.checked_mul(usage.tx_bytes).ok_or(RejectReason::StatefulInvalid)?,
            self.compute_unit_fee
                .checked_mul(usage.compute)
                .ok_or(RejectReason::StatefulInvalid)?,
            self.state_read_fee
                .checked_mul(usage.state_read)
                .ok_or(RejectReason::StatefulInvalid)?,
            self.state_write_fee
                .checked_mul(usage.state_write)
                .ok_or(RejectReason::StatefulInvalid)?,
            self.signature_verify_fee
                .checked_mul(usage.sig_verify)
                .ok_or(RejectReason::StatefulInvalid)?,
            self.cryptographic_proof_fee
                .checked_mul(usage.crypto_proof)
                .ok_or(RejectReason::StatefulInvalid)?,
        ];
        parts
            .into_iter()
            .try_fold(0u128, |acc, part| acc.checked_add(part).ok_or(RejectReason::StatefulInvalid))
    }

    pub fn hash(&self) -> String {
        canonical_hash(&serde_json::json!({
            "domain": "sunrey.fees.schedule.v1",
            "version": self.version,
            "activation_height": self.activation_height,
            "base_transaction_fee": self.base_transaction_fee.to_string(),
            "per_byte_fee": self.per_byte_fee.to_string(),
            "compute_unit_fee": self.compute_unit_fee.to_string(),
            "state_read_fee": self.state_read_fee.to_string(),
            "state_write_fee": self.state_write_fee.to_string(),
            "signature_verify_fee": self.signature_verify_fee.to_string(),
            "cryptographic_proof_fee": self.cryptographic_proof_fee.to_string(),
            "minimum_fee": self.minimum_fee.to_string(),
        }))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeeAssetPolicy {
    pub version: u32,
    pub activation_height: u64,
    pub enabled: Vec<FeeAsset>,
    pub default_asset: FeeAsset,
}

impl FeeAssetPolicy {
    pub fn development() -> Self {
        Self {
            version: 1,
            activation_height: 0,
            enabled: vec![FeeAsset::SunreyCoin],
            default_asset: FeeAsset::SunreyCoin,
        }
    }

    pub fn enabled(&self, asset: FeeAsset) -> bool {
        self.enabled.contains(&asset)
    }

    pub fn hash(&self) -> String {
        canonical_hash(&serde_json::json!({
            "domain": "sunrey.fees.asset-policy.v1",
            "version": self.version,
            "enabled": self.enabled.iter().map(|a| a.as_str()).collect::<Vec<_>>(),
            "default": self.default_asset.as_str(),
        }))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeeDispositionPolicy {
    pub version: u32,
    pub activation_height: u64,
    pub network_sink_bps: u128,
    pub burn_bps: u128,
    pub validator_reward_bps: u128,
    pub treasury_bps: u128,
    pub proposer_share_bps: u128,
}

impl FeeDispositionPolicy {
    pub fn development() -> Self {
        Self {
            version: 1,
            activation_height: 0,
            network_sink_bps: 5_000,
            burn_bps: 2_500,
            validator_reward_bps: 2_500,
            treasury_bps: 0,
            proposer_share_bps: 4_000,
        }
    }

    pub fn dispose(&self, asset: FeeAsset, actual: u128) -> FeeDisposition {
        let burned = actual.saturating_mul(self.burn_bps) / BPS_DENOM;
        let rewards = actual.saturating_mul(self.validator_reward_bps) / BPS_DENOM;
        let treasury = actual.saturating_mul(self.treasury_bps) / BPS_DENOM;
        let network_sink = actual.saturating_sub(burned + rewards + treasury);
        FeeDisposition {
            asset,
            actual_fee: actual,
            network_sink,
            burned,
            validator_reward_pool: rewards,
            treasury,
        }
    }

    pub fn hash(&self) -> String {
        canonical_hash(&serde_json::json!({
            "domain": "sunrey.fees.disposition.v1",
            "version": self.version,
            "network_sink_bps": self.network_sink_bps.to_string(),
            "burn_bps": self.burn_bps.to_string(),
            "validator_reward_bps": self.validator_reward_bps.to_string(),
            "treasury_bps": self.treasury_bps.to_string(),
            "proposer_share_bps": self.proposer_share_bps.to_string(),
        }))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeeDisposition {
    pub asset: FeeAsset,
    pub actual_fee: u128,
    pub network_sink: u128,
    pub burned: u128,
    pub validator_reward_pool: u128,
    pub treasury: u128,
}

impl FeeDisposition {
    pub fn reconciles(&self) -> bool {
        self.network_sink + self.burned + self.validator_reward_pool + self.treasury
            == self.actual_fee
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockResourceLimits {
    pub version: u32,
    pub activation_height: u64,
    pub max_bytes: u128,
    pub max_execution_units: u128,
    pub max_state_writes: u128,
    pub max_signature_verify_units: u128,
}

impl BlockResourceLimits {
    pub fn development() -> Self {
        Self {
            version: 1,
            activation_height: 0,
            max_bytes: 512_000,
            max_execution_units: 2_000_000,
            max_state_writes: 8_192,
            max_signature_verify_units: 4_096,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeeIntent {
    pub max_fee: u128,
    pub max_execution_units: u128,
    pub fee_asset: FeeAsset,
    pub fee_payer: String,
}

impl FeeIntent {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, FEE_INTENT_TAG);
        encode_u128(&mut out, self.max_fee);
        encode_u128(&mut out, self.max_execution_units);
        encode_string(&mut out, self.fee_asset.as_str());
        encode_string(&mut out, &self.fee_payer);
        out
    }

    pub fn decode_prefix(bytes: &[u8]) -> Result<(Self, &[u8]), RejectReason> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        if tag != FEE_INTENT_TAG {
            return Err(RejectReason::SchemaInvalid);
        }
        let max_fee = decode_u128(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let max_execution_units =
            decode_u128(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let fee_asset =
            FeeAsset::parse(&decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?)?;
        let fee_payer = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        Ok((Self { max_fee, max_execution_units, fee_asset, fee_payer }, input))
    }

    pub fn into_budget(self, exemption: FeeExemption) -> ExecutionBudget {
        ExecutionBudget {
            max_execution_units: self.max_execution_units,
            max_fee: self.max_fee,
            fee_asset: self.fee_asset,
            fee_payer: self.fee_payer,
            exemption,
        }
    }
}

pub fn split_fee_intent(bytes: &[u8]) -> Result<(Option<FeeIntent>, &[u8]), RejectReason> {
    if bytes.is_empty() {
        return Ok((None, bytes));
    }
    let mut peek = bytes;
    match decode_string(&mut peek) {
        Ok(tag) if tag == FEE_INTENT_TAG => {
            let (intent, rest) = FeeIntent::decode_prefix(bytes)?;
            Ok((Some(intent), rest))
        }
        Ok(_) => Ok((None, bytes)),
        Err(_) => Err(RejectReason::DecodeFailed),
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExecutionBudget {
    pub max_execution_units: u128,
    pub max_fee: u128,
    pub fee_asset: FeeAsset,
    pub fee_payer: String,
    pub exemption: FeeExemption,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeeReceipt {
    pub transaction_id: String,
    pub payer: String,
    pub asset: FeeAsset,
    pub reserved_fee: u128,
    pub actual_fee: u128,
    pub released_fee: u128,
    pub resource_usage: ResourceUsage,
    pub fee_schedule_version: u32,
    pub disposition_policy_version: u32,
    pub block_height: u64,
    pub block_id: String,
    pub outcome: String,
    pub disposition: FeeDisposition,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Position {
    pub available: u128,
    pub reserved: u128,
    pub locked: u128,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FeeMetrics {
    pub execution_units: u128,
    pub block_execution_units: u128,
    pub fee_revenue_sunrey: u128,
    pub fee_burned: u128,
    pub fee_network_sink: u128,
    pub validator_reward_accrual: u128,
    pub transaction_fee_rejections: u128,
    pub out_of_execution_units: u128,
    pub block_resource_utilization: u128,
    pub mempool_fee_floor: u128,
}

pub struct ChargeInput<'a> {
    pub budget: &'a ExecutionBudget,
    pub usage: ResourceUsage,
    pub tx_id: &'a str,
    pub height: u64,
    pub block_id: &'a str,
    pub outcome: &'a str,
    pub proposer: &'a str,
    pub validators: &'a [(&'a str, u128)],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeEngine {
    pub schedule: FeeSchedule,
    pub asset_policy: FeeAssetPolicy,
    pub disposition: FeeDispositionPolicy,
    pub limits: BlockResourceLimits,
    pub accounts: BTreeMap<String, Position>,
    pub receipts: BTreeMap<String, FeeReceipt>,
    pub rewards: BTreeMap<String, u128>,
    pub metrics: FeeMetrics,
}

impl Default for FeeEngine {
    fn default() -> Self {
        Self::development()
    }
}

impl FeeEngine {
    pub fn development() -> Self {
        let schedule = FeeSchedule::development();
        Self {
            metrics: FeeMetrics {
                mempool_fee_floor: schedule.minimum_fee,
                ..FeeMetrics::default()
            },
            schedule,
            asset_policy: FeeAssetPolicy::development(),
            disposition: FeeDispositionPolicy::development(),
            limits: BlockResourceLimits::development(),
            accounts: BTreeMap::new(),
            receipts: BTreeMap::new(),
            rewards: BTreeMap::new(),
        }
    }

    fn key(account: &str, asset: FeeAsset) -> String {
        format!("{}:{}", account, asset.as_str())
    }

    fn slot(&mut self, account: &str, asset: FeeAsset) -> &mut Position {
        self.accounts.entry(Self::key(account, asset)).or_default()
    }

    pub fn position(&self, account: &str, asset: FeeAsset) -> Position {
        self.accounts.get(&Self::key(account, asset)).cloned().unwrap_or_default()
    }

    pub fn faucet(&mut self, account: &str, amount: u128) {
        self.slot(FAUCET_ACCOUNT, FeeAsset::SunreyCoin).available += amount;
        self.slot(FAUCET_ACCOUNT, FeeAsset::SunreyCoin).available -= amount;
        self.slot(account, FeeAsset::SunreyCoin).available += amount;
    }

    pub fn validate_admission(
        &mut self,
        budget: &ExecutionBudget,
        op: ProtocolOp,
        encoded_bytes: u128,
        sigs: u128,
        authenticated: bool,
    ) -> Result<(), RejectReason> {
        if matches!(
            budget.exemption,
            FeeExemption::DevelopmentFaucet | FeeExemption::DevelopmentProtocol
        ) {
            return Ok(());
        }
        if !authenticated {
            self.metrics.transaction_fee_rejections += 1;
            return Err(RejectReason::InvalidSignatureDescriptor);
        }
        if budget.max_execution_units == 0 || budget.max_execution_units > MAX_TX_EXECUTION_UNITS {
            self.metrics.transaction_fee_rejections += 1;
            return Err(RejectReason::SizeExceeded);
        }
        if !self.asset_policy.enabled(budget.fee_asset) {
            self.metrics.transaction_fee_rejections += 1;
            return Err(RejectReason::UnsupportedFeeAsset);
        }
        if budget.max_fee < self.schedule.minimum_fee {
            self.metrics.transaction_fee_rejections += 1;
            return Err(RejectReason::InsufficientFee);
        }
        let usage = usage_for(op, encoded_bytes, sigs);
        if usage.total() <= budget.max_execution_units {
            let estimate = self.schedule.calculate(usage)?;
            if budget.max_fee < estimate {
                self.metrics.transaction_fee_rejections += 1;
                return Err(RejectReason::InsufficientFee);
            }
        }
        let pos = self.position(&budget.fee_payer, budget.fee_asset);
        if pos.reserved < budget.max_fee && pos.available < budget.max_fee {
            self.metrics.transaction_fee_rejections += 1;
            return Err(RejectReason::InsufficientFee);
        }
        Ok(())
    }

    pub fn reserve(&mut self, budget: &ExecutionBudget) -> Result<(), RejectReason> {
        if !matches!(budget.exemption, FeeExemption::None) {
            return Ok(());
        }
        let slot = self.slot(&budget.fee_payer, budget.fee_asset);
        if slot.available < budget.max_fee {
            return Err(RejectReason::StatefulInvalid);
        }
        slot.available -= budget.max_fee;
        slot.reserved += budget.max_fee;
        Ok(())
    }

    pub fn release(&mut self, budget: &ExecutionBudget) -> Result<(), RejectReason> {
        if !matches!(budget.exemption, FeeExemption::None) {
            return Ok(());
        }
        let slot = self.slot(&budget.fee_payer, budget.fee_asset);
        if slot.reserved < budget.max_fee {
            return Err(RejectReason::StatefulInvalid);
        }
        slot.reserved -= budget.max_fee;
        slot.available += budget.max_fee;
        Ok(())
    }

    pub fn charge(&mut self, input: ChargeInput<'_>) -> Result<FeeReceipt, RejectReason> {
        let ChargeInput { budget, usage, tx_id, height, block_id, outcome, proposer, validators } =
            input;
        let computed = self.schedule.calculate(usage)?;
        let actual = if matches!(budget.exemption, FeeExemption::None) {
            computed.min(budget.max_fee)
        } else {
            0
        };
        let reserved =
            if matches!(budget.exemption, FeeExemption::None) { budget.max_fee } else { 0 };
        if matches!(budget.exemption, FeeExemption::None) {
            let slot = self.slot(&budget.fee_payer, budget.fee_asset);
            if slot.reserved < reserved {
                return Err(RejectReason::StatefulInvalid);
            }
            slot.reserved -= reserved;
            slot.available += reserved - actual;
        }
        let disposition = self.disposition.dispose(budget.fee_asset, actual);
        if !disposition.reconciles() {
            return Err(RejectReason::InvalidStateTransition);
        }
        self.slot(NETWORK_SINK_ACCOUNT, budget.fee_asset).available += disposition.network_sink;
        self.slot(BURN_ACCOUNT, budget.fee_asset).available += disposition.burned;
        self.slot(TREASURY_ACCOUNT, budget.fee_asset).available += disposition.treasury;
        self.slot(REWARD_POOL_ACCOUNT, budget.fee_asset).available +=
            disposition.validator_reward_pool;
        self.accrue(proposer, validators, disposition.validator_reward_pool);
        if outcome == "OUT_OF_EXECUTION_UNITS" {
            self.metrics.out_of_execution_units += 1;
        }
        self.metrics.execution_units += usage.total();
        self.metrics.block_execution_units += usage.total();
        self.metrics.fee_revenue_sunrey += actual;
        self.metrics.fee_burned += disposition.burned;
        self.metrics.fee_network_sink += disposition.network_sink;
        let receipt = FeeReceipt {
            transaction_id: tx_id.to_string(),
            payer: budget.fee_payer.clone(),
            asset: budget.fee_asset,
            reserved_fee: reserved,
            actual_fee: actual,
            released_fee: reserved - actual,
            resource_usage: usage,
            fee_schedule_version: self.schedule.version,
            disposition_policy_version: self.disposition.version,
            block_height: height,
            block_id: block_id.to_string(),
            outcome: outcome.to_string(),
            disposition,
        };
        self.receipts.insert(tx_id.to_string(), receipt.clone());
        Ok(receipt)
    }

    fn accrue(&mut self, proposer: &str, validators: &[(&str, u128)], pool: u128) {
        if pool == 0 || validators.is_empty() {
            return;
        }
        let proposer_share = pool.saturating_mul(self.disposition.proposer_share_bps) / BPS_DENOM;
        let remainder = pool - proposer_share;
        let total_power: u128 = validators.iter().map(|(_, p)| *p).sum();
        let mut allocated = 0u128;
        let mut ordered: Vec<_> = validators.to_vec();
        ordered.sort_by(|a, b| a.0.cmp(b.0));
        for (id, power) in &ordered {
            let share =
                if total_power == 0 { 0 } else { remainder.saturating_mul(*power) / total_power };
            allocated += share;
            let extra = if *id == proposer { proposer_share } else { 0 };
            *self.rewards.entry((*id).to_string()).or_default() += share + extra;
            self.metrics.validator_reward_accrual += share + extra;
        }
        let leftover = remainder.saturating_sub(allocated);
        *self.rewards.entry(proposer.to_string()).or_default() += leftover;
        self.metrics.validator_reward_accrual += leftover;
    }

    pub fn claim(&mut self, validator: &str) -> u128 {
        let amount = self.rewards.remove(validator).unwrap_or(0);
        self.slot(validator, FeeAsset::SunreyCoin).available += amount;
        amount
    }

    pub fn transfer(&mut self, from: &str, to: &str, amount: u128) -> Result<(), RejectReason> {
        let src = self.slot(from, FeeAsset::SunreyCoin);
        if src.available < amount {
            return Err(RejectReason::StatefulInvalid);
        }
        src.available -= amount;
        self.slot(to, FeeAsset::SunreyCoin).available += amount;
        Ok(())
    }

    pub fn activate_schedule(&mut self, height: u64, next: FeeSchedule) {
        if next.activation_height == height {
            self.schedule = next;
            self.metrics.mempool_fee_floor = self.schedule.minimum_fee;
        }
    }

    pub fn policy_json(&self) -> serde_json::Value {
        serde_json::json!({
            "environment": "simulation",
            "fee_schedule": self.schedule,
            "fee_schedule_hash": self.schedule.hash(),
            "asset_policy": self.asset_policy,
            "asset_policy_hash": self.asset_policy.hash(),
            "disposition": self.disposition,
            "disposition_hash": self.disposition.hash(),
            "block_limits": self.limits,
            "moonrey_fee_enabled": self.asset_policy.enabled(FeeAsset::MoonreyCoin),
        })
    }
}

pub fn effective_priority(max_fee: u128, max_units: u128) -> u128 {
    let units = if max_units == 0 { 1 } else { max_units };
    max_fee.saturating_mul(PRIORITY_SCALE) / units
}

pub fn canonical_hash(value: &serde_json::Value) -> String {
    let encoded = serde_json::to_vec(value).unwrap_or_default();
    hex::encode(Sha256::digest(encoded))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_usage_same_fee() {
        let schedule = FeeSchedule::development();
        let usage = usage_for(ProtocolOp::NativeTransfer, 240, 1);
        assert_eq!(schedule.calculate(usage).unwrap(), schedule.calculate(usage).unwrap());
        assert!(schedule.calculate(usage).unwrap() > schedule.minimum_fee);
    }

    #[test]
    fn reserve_charge_release_and_disposition() {
        let mut engine = FeeEngine::development();
        engine.faucet("alice", 50_000);
        let budget = ExecutionBudget {
            max_execution_units: 10_000,
            max_fee: 5_000,
            fee_asset: FeeAsset::SunreyCoin,
            fee_payer: "alice".into(),
            exemption: FeeExemption::None,
        };
        engine.validate_admission(&budget, ProtocolOp::NativeTransfer, 240, 1, true).unwrap();
        engine.reserve(&budget).unwrap();
        assert_eq!(engine.position("alice", FeeAsset::SunreyCoin).reserved, 5_000);
        let usage = usage_for(ProtocolOp::NativeTransfer, 240, 1);
        let receipt = engine
            .charge(ChargeInput {
                budget: &budget,
                usage,
                tx_id: "tx1",
                height: 1,
                block_id: "block1",
                outcome: "APPLIED",
                proposer: "val_a",
                validators: &[("val_a", 1), ("val_b", 1)],
            })
            .unwrap();
        assert_eq!(receipt.reserved_fee, receipt.actual_fee + receipt.released_fee);
        assert!(receipt.disposition.reconciles());
        assert_eq!(engine.position("alice", FeeAsset::SunreyCoin).reserved, 0);
        assert!(engine.rewards.get("val_a").copied().unwrap_or(0) > 0);
    }

    #[test]
    fn rejects_unsupported_asset_and_low_fee() {
        let mut engine = FeeEngine::development();
        engine.faucet("alice", 50_000);
        let moon = ExecutionBudget {
            max_execution_units: 10_000,
            max_fee: 5_000,
            fee_asset: FeeAsset::MoonreyCoin,
            fee_payer: "alice".into(),
            exemption: FeeExemption::None,
        };
        assert!(engine
            .validate_admission(&moon, ProtocolOp::NativeTransfer, 240, 1, true)
            .is_err());
        let low = ExecutionBudget {
            max_execution_units: 10_000,
            max_fee: 1,
            fee_asset: FeeAsset::SunreyCoin,
            fee_payer: "alice".into(),
            exemption: FeeExemption::None,
        };
        assert!(engine.validate_admission(&low, ProtocolOp::NativeTransfer, 240, 1, true).is_err());
    }

    #[test]
    fn schedule_activates_only_at_height() {
        let mut engine = FeeEngine::development();
        let mut next = FeeSchedule::development();
        next.version = 2;
        next.minimum_fee = 250;
        next.activation_height = 8;
        engine.activate_schedule(7, next.clone());
        assert_eq!(engine.schedule.minimum_fee, 100);
        engine.activate_schedule(8, next);
        assert_eq!(engine.schedule.minimum_fee, 250);
    }
}
