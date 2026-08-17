//! Chunk 73 — FeePolicyV2 adaptive resource price (Rust twin).
//!
//! Historic FeeSchedule remains v1. This module does not reinterpret
//! historical transactions. Integer arithmetic only.

use serde::{Deserialize, Serialize};

use sunrey_protocol::RejectReason;

use crate::{FeeAsset, BPS_DENOM};

pub const WEIGHT_PRICE_SCALE: u128 = 1;
pub const UTIL_BPS: u128 = 10_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SignatureClass {
    Classical,
    Hybrid,
    Pq,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ResourceUsageV2 {
    pub tx_bytes: u128,
    pub sig_classical: u128,
    pub sig_hybrid: u128,
    pub sig_pq: u128,
    pub state_read: u128,
    pub state_write: u128,
    pub proof_verify: u128,
    pub oracle_verify: u128,
    pub exchange_dvp_leg: u128,
    pub interop_proof: u128,
    pub other: u128,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceWeightSchedule {
    pub version: u32,
    pub tx_bytes: u128,
    pub sig_classical: u128,
    pub sig_hybrid: u128,
    pub sig_pq: u128,
    pub state_read: u128,
    pub state_write: u128,
    pub proof_verify: u128,
    pub oracle_verify: u128,
    pub exchange_dvp_leg: u128,
    pub interop_proof: u128,
    pub other: u128,
}

impl ResourceWeightSchedule {
    pub fn development() -> Self {
        Self {
            version: 1,
            tx_bytes: 1,
            sig_classical: 20,
            sig_hybrid: 80,
            sig_pq: 200,
            state_read: 3,
            state_write: 5,
            proof_verify: 25,
            oracle_verify: 40,
            exchange_dvp_leg: 75,
            interop_proof: 150,
            other: 2,
        }
    }

    pub fn weighted(&self, usage: ResourceUsageV2) -> Result<u128, RejectReason> {
        let parts = [
            usage.tx_bytes.checked_mul(self.tx_bytes),
            usage.sig_classical.checked_mul(self.sig_classical),
            usage.sig_hybrid.checked_mul(self.sig_hybrid),
            usage.sig_pq.checked_mul(self.sig_pq),
            usage.state_read.checked_mul(self.state_read),
            usage.state_write.checked_mul(self.state_write),
            usage.proof_verify.checked_mul(self.proof_verify),
            usage.oracle_verify.checked_mul(self.oracle_verify),
            usage.exchange_dvp_leg.checked_mul(self.exchange_dvp_leg),
            usage.interop_proof.checked_mul(self.interop_proof),
            usage.other.checked_mul(self.other),
        ];
        let mut total = 0u128;
        for part in parts {
            let value = part.ok_or(RejectReason::StatefulInvalid)?;
            total = total.checked_add(value).ok_or(RejectReason::StatefulInvalid)?;
        }
        Ok(total)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AdaptivePriceBounds {
    pub min_base_price: u128,
    pub max_base_price: u128,
    pub max_one_block_adjustment: u128,
    pub target_utilization_bps: u128,
    pub block_resource_limit: u128,
    pub adjustment_denominator: u128,
}

impl AdaptivePriceBounds {
    pub fn development() -> Self {
        Self {
            min_base_price: 1,
            max_base_price: 10_000,
            max_one_block_adjustment: 250,
            target_utilization_bps: 5_000,
            block_resource_limit: 2_000_000,
            adjustment_denominator: 8,
        }
    }

    pub fn target_usage(&self) -> u128 {
        self.block_resource_limit.saturating_mul(self.target_utilization_bps) / UTIL_BPS
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BaseResourcePriceState {
    pub height: u64,
    pub base_resource_price: u128,
    pub previous_usage: u128,
}

impl BaseResourcePriceState {
    pub fn initial(bounds: &AdaptivePriceBounds) -> Self {
        Self { height: 0, base_resource_price: 100.min(bounds.max_base_price).max(bounds.min_base_price), previous_usage: 0 }
    }

    pub fn next(&self, previous_usage: u128, bounds: &AdaptivePriceBounds, height: u64) -> Self {
        let target = bounds.target_usage().max(1);
        let price = self.base_resource_price;
        let next = if previous_usage >= target {
            let raw = price.saturating_mul(previous_usage - target) / target.saturating_mul(bounds.adjustment_denominator);
            let adj = raw.min(bounds.max_one_block_adjustment);
            price.saturating_add(adj).min(bounds.max_base_price)
        } else {
            let raw = price.saturating_mul(target - previous_usage) / target.saturating_mul(bounds.adjustment_denominator);
            let adj = raw.min(bounds.max_one_block_adjustment);
            price.saturating_sub(adj).max(bounds.min_base_price)
        };
        Self { height, base_resource_price: next, previous_usage }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeePolicyV2 {
    pub version: u32,
    pub minimum_fee: u128,
    pub priority_enabled: bool,
    pub moonrey_fee_enabled: bool,
    pub production_parameters_configured: bool,
    pub weights: ResourceWeightSchedule,
    pub bounds: AdaptivePriceBounds,
}

impl FeePolicyV2 {
    pub fn development() -> Self {
        Self {
            version: 2,
            minimum_fee: 100,
            priority_enabled: true,
            moonrey_fee_enabled: false,
            production_parameters_configured: false,
            weights: ResourceWeightSchedule::development(),
            bounds: AdaptivePriceBounds::development(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeeQuoteV2 {
    pub policy_version: u32,
    pub weighted_usage: u128,
    pub base_resource_price: u128,
    pub base_charge: u128,
    pub priority_fee: u128,
    pub estimated_total: u128,
    pub fee_asset: FeeAsset,
    pub maximum_authorized_fee: u128,
    pub informational: bool,
}

pub fn quote_fee_v2(
    policy: &FeePolicyV2,
    usage: ResourceUsageV2,
    base_price: u128,
    asset: FeeAsset,
    max_fee: u128,
    priority: u128,
    priority_authorized: bool,
) -> Result<FeeQuoteV2, RejectReason> {
    if asset == FeeAsset::MoonreyCoin && !policy.moonrey_fee_enabled {
        return Err(RejectReason::UnsupportedFeeAsset);
    }
    if priority > 0 && !priority_authorized {
        return Err(RejectReason::StatefulInvalid);
    }
    let weighted = policy.weights.weighted(usage)?;
    let base_charge = weighted.checked_mul(base_price).ok_or(RejectReason::StatefulInvalid)? / WEIGHT_PRICE_SCALE;
    let priority_fee = if policy.priority_enabled && priority_authorized { priority } else { 0 };
    let estimated = base_charge.checked_add(priority_fee).ok_or(RejectReason::StatefulInvalid)?;
    let required = estimated.max(policy.minimum_fee);
    if max_fee < policy.minimum_fee || required > max_fee {
        return Err(RejectReason::StatefulInvalid);
    }
    Ok(FeeQuoteV2 {
        policy_version: 2,
        weighted_usage: weighted,
        base_resource_price: base_price,
        base_charge,
        priority_fee,
        estimated_total: required,
        fee_asset: asset,
        maximum_authorized_fee: max_fee,
        informational: true,
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeeDispositionV2 {
    pub charged: u128,
    pub validator_reward: u128,
    pub burned: u128,
    pub treasury: u128,
}

impl FeeDispositionV2 {
    pub fn dispose(charged: u128, validator_bps: u128, burn_bps: u128) -> Self {
        let validator_reward = charged.saturating_mul(validator_bps) / BPS_DENOM;
        let burned = charged.saturating_mul(burn_bps) / BPS_DENOM;
        let treasury = charged.saturating_sub(validator_reward.saturating_add(burned));
        Self { charged, validator_reward, burned, treasury }
    }

    pub fn reconciles(&self) -> bool {
        self.validator_reward.saturating_add(self.burned).saturating_add(self.treasury) == self.charged
    }
}

pub fn usage_v2(bytes: u128, sigs: u128, class: SignatureClass) -> ResourceUsageV2 {
    ResourceUsageV2 {
        tx_bytes: bytes,
        sig_classical: if matches!(class, SignatureClass::Classical) { sigs } else { 0 },
        sig_hybrid: if matches!(class, SignatureClass::Hybrid) { sigs } else { 0 },
        sig_pq: if matches!(class, SignatureClass::Pq) { sigs } else { 0 },
        state_read: 2,
        state_write: 2,
        other: 100,
        ..ResourceUsageV2::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn price_stays_in_bounds_and_is_deterministic() {
        let bounds = AdaptivePriceBounds::development();
        let start = BaseResourcePriceState::initial(&bounds);
        let a = start.next(1_800_000, &bounds, 1);
        let b = start.next(1_800_000, &bounds, 1);
        assert_eq!(a.base_resource_price, b.base_resource_price);
        assert!(a.base_resource_price >= bounds.min_base_price);
        assert!(a.base_resource_price <= bounds.max_base_price);
    }

    #[test]
    fn quote_respects_max_fee_and_rejects_moonrey() {
        let policy = FeePolicyV2::development();
        let usage = usage_v2(240, 1, SignatureClass::Classical);
        let ok = quote_fee_v2(&policy, usage, 100, FeeAsset::SunreyCoin, 50_000, 0, false).unwrap();
        assert!(ok.estimated_total <= ok.maximum_authorized_fee);
        assert!(ok.informational);
        assert!(quote_fee_v2(&policy, usage, 100, FeeAsset::MoonreyCoin, 50_000, 0, false).is_err());
        assert!(quote_fee_v2(&policy, usage, 100, FeeAsset::SunreyCoin, 10, 0, false).is_err());
        assert!(quote_fee_v2(&policy, usage, 100, FeeAsset::SunreyCoin, 50_000, 80, false).is_err());
    }

    #[test]
    fn disposition_is_exact_and_cannot_mint() {
        let split = FeeDispositionV2::dispose(1_000, 5_000, 2_500);
        assert!(split.reconciles());
        assert_eq!(split.validator_reward + split.burned + split.treasury, 1_000);
    }

    #[test]
    fn pq_classification_is_deterministic() {
        let left = usage_v2(240, 2, SignatureClass::Pq);
        let right = usage_v2(240, 2, SignatureClass::Pq);
        assert_eq!(left, right);
        assert_eq!(left.sig_pq, 2);
        assert_eq!(left.sig_classical, 0);
    }
}
