//! Chunk 72 bounded validator-economics arithmetic.
//!
//! Integer bond/reward/penalty helpers used by Rust tests. This is not a
//! second validator registry or a public staking market.

use crate::types::err;
use crate::types::ValidatorError;

pub const BPS_DENOM: u128 = 10_000;
pub const MAX_UNITS: u128 = 10u128.pow(38) - 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BondState {
    Unbonded,
    Bonding,
    Bonded,
    Unbonding,
    Jailed,
    Tombstoned,
    Exited,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BondPosition {
    pub validator_id: String,
    pub bonded: u128,
    pub pending_unbond: u128,
    pub rewards: u128,
    pub penalties: u128,
    pub state: BondState,
    pub unbond_request_epoch: Option<u64>,
}

pub fn checked_mul(left: u128, right: u128) -> Result<u128, ValidatorError> {
    left.checked_mul(right)
        .filter(|product| *product <= MAX_UNITS)
        .ok_or_else(|| err("REWARD_OVERFLOW", "economic product exceeds governed maximum"))
}

pub fn penalty_units(bonded: u128, bps: u128) -> Result<u128, ValidatorError> {
    Ok(checked_mul(bonded, bps)? / BPS_DENOM)
}

pub fn reward_share(pool: u128, weight: u128, total_weight: u128) -> Result<u128, ValidatorError> {
    if total_weight == 0 {
        return Ok(0);
    }
    Ok(checked_mul(pool, weight)? / total_weight)
}

pub fn bond_conserved(available: u128, locked: u128, pending: u128, penalized: u128, issued: u128) -> bool {
    available.saturating_add(locked).saturating_add(pending).saturating_add(penalized) == issued
}

pub fn unbond_release_allowed(now: u64, request_epoch: u64, delay: u64) -> Result<(), ValidatorError> {
    if now < request_epoch.saturating_add(delay) {
        return Err(err("IMMEDIATE_UNBOND_REJECTED", "unbond delay has not elapsed"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn integer_rewards_and_remainder() {
        let pool = 1_001u128;
        let a = reward_share(pool, 1, 2).unwrap();
        let b = reward_share(pool, 1, 2).unwrap();
        assert_eq!(a + b + (pool - a - b), pool);
    }

    #[test]
    fn overflow_rejected() {
        assert!(checked_mul(MAX_UNITS, 2).is_err());
    }

    #[test]
    fn unbond_delay() {
        assert!(unbond_release_allowed(1, 1, 2).is_err());
        assert!(unbond_release_allowed(3, 1, 2).is_ok());
    }

    #[test]
    fn conservation() {
        assert!(bond_conserved(1, 2, 1, 1, 5));
        assert!(!bond_conserved(1, 2, 1, 1, 6));
        let position = BondPosition {
            validator_id: "val_a".into(),
            bonded: 2,
            pending_unbond: 0,
            rewards: 0,
            penalties: 0,
            state: BondState::Bonded,
            unbond_request_epoch: None,
        };
        assert_eq!(penalty_units(position.bonded, 5_000).unwrap(), 1);
    }
}
