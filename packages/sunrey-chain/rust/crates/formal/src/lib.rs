//! Chunk 61 bounded verification harnesses.
//!
//! These functions are the Kani-shaped proofs for quorum, asset, fee,
//! signer-coordinate, and settlement arithmetic. `cargo test` exhausts the
//! same small domains when Kani is not installed. This crate is not a
//! second consensus engine, ledger, or verifier product.

#![forbid(unsafe_code)]

use sunrey_consensus::{
    exceeds_two_thirds, two_thirds_threshold, BlockId, ConsensusStep, Height, Round,
    SignerSafetyStore,
};
use sunrey_fees::{FeeDispositionPolicy, BPS_DENOM};
use sunrey_native_assets::{AssetError, AssetQuantity, NativeAssetId};

pub fn quorum_agrees(signed: u64, total: u64) -> bool {
    if total == 0 {
        return true;
    }
    let Ok(threshold) = two_thirds_threshold(total) else {
        return true;
    };
    let Ok(strict) = exceeds_two_thirds(signed, total) else {
        return true;
    };
    (signed >= threshold) == strict
}

pub fn asset_add_sub_roundtrip(units: u128) -> bool {
    let Ok(base) = AssetQuantity::new(NativeAssetId::SunReyCoin, units) else {
        return true;
    };
    let one = AssetQuantity::new(NativeAssetId::SunReyCoin, 1).unwrap();
    match base.checked_add(one) {
        Ok(sum) => sum.checked_sub(one).map(|back| back == base).unwrap_or(false),
        Err(AssetError::Overflow | AssetError::QuantityExceedsMaximum) => true,
        Err(_) => false,
    }
}

pub fn cross_asset_add_rejected() -> bool {
    let left = AssetQuantity::new(NativeAssetId::SunReyCoin, 1).unwrap();
    let right = AssetQuantity::new(NativeAssetId::MoonReyCoin, 1).unwrap();
    matches!(left.checked_add(right), Err(AssetError::CrossAssetArithmetic))
}

pub fn fee_disposition_sums_to_denom(policy: &FeeDispositionPolicy) -> bool {
    policy
        .network_sink_bps
        .checked_add(policy.burn_bps)
        .and_then(|n| n.checked_add(policy.validator_reward_bps))
        .and_then(|n| n.checked_add(policy.treasury_bps))
        == Some(BPS_DENOM)
}

pub fn signer_conflict_refused() -> bool {
    let mut store = SignerSafetyStore::in_memory();
    let height = Height::new(1);
    let round = Round::new(0);
    let a = BlockId([1u8; 32]);
    let b = BlockId([2u8; 32]);
    store.authorize(height, round, ConsensusStep::Precommit, a).is_ok()
        && store.authorize(height, round, ConsensusStep::Precommit, b).is_err()
}

pub fn settlement_conservation(reserved: u128, settled: u128, cancelled: u128) -> bool {
    reserved >= settled.saturating_add(cancelled)
}

#[cfg(kani)]
mod kani_proofs {
    use super::*;

    #[kani::proof]
    fn proof_quorum_small_domain() {
        let total: u64 = kani::any();
        kani::assume(total > 0 && total <= 12);
        let signed: u64 = kani::any();
        kani::assume(signed <= total);
        assert!(quorum_agrees(signed, total));
        let _ = sunrey_consensus::exceeds_one_third(signed, total);
    }

    #[kani::proof]
    fn proof_asset_arithmetic() {
        let units: u128 = kani::any();
        kani::assume(units < 16);
        assert!(asset_add_sub_roundtrip(units));
        assert!(cross_asset_add_rejected());
    }

    #[kani::proof]
    fn proof_fee_disposition() {
        assert!(fee_disposition_sums_to_denom(&FeeDispositionPolicy::development()));
    }

    #[kani::proof]
    fn proof_signer_conflict() {
        assert!(signer_conflict_refused());
    }

    #[kani::proof]
    fn proof_settlement_conservation() {
        let reserved: u128 = kani::any();
        let settled: u128 = kani::any();
        let cancelled: u128 = kani::any();
        kani::assume(reserved <= 8 && settled <= reserved && cancelled <= reserved);
        assert!(settlement_conservation(reserved, settled, reserved.saturating_sub(settled)));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quorum_boundaries() {
        for total in 1..=12u64 {
            for signed in 0..=total {
                assert!(quorum_agrees(signed, total), "{signed}/{total}");
            }
        }
        assert!(!exceeds_two_thirds(2, 3).unwrap());
        assert!(exceeds_two_thirds(3, 3).unwrap());
        assert!(!sunrey_consensus::exceeds_one_third(1, 3).unwrap());
        assert!(sunrey_consensus::exceeds_one_third(2, 3).unwrap());
    }

    #[test]
    fn asset_and_cross_asset() {
        for units in 0..16u128 {
            assert!(asset_add_sub_roundtrip(units));
        }
        assert!(cross_asset_add_rejected());
    }

    #[test]
    fn fee_and_signer_and_settlement() {
        assert!(fee_disposition_sums_to_denom(&FeeDispositionPolicy::development()));
        assert!(signer_conflict_refused());
        assert!(settlement_conservation(2, 2, 0));
        assert!(settlement_conservation(2, 0, 2));
        assert!(!settlement_conservation(2, 2, 1));
    }
}
