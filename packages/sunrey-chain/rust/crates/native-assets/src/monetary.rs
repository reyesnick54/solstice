//! Dual-native-asset monetary constitution types.
//!
//! This module does not create a second ledger. Production quantities
//! remain UNCONFIGURED. Tickers remain NOT_ASSIGNED.

use serde::{Deserialize, Serialize};

use crate::registry::{NativeAssetId, TICKER_STATUS_NOT_ASSIGNED};

pub const MONETARY_POLICY_VERSION: &str = "sunrey.monetary.constitution.v1";
pub const PRODUCTION_PARAMETER_UNCONFIGURED: &str = "UNCONFIGURED";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MonetaryPolicyState {
    Draft,
    DevelopmentActive,
    TestnetActive,
    ProductionCandidate,
    Superseded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SupplyClass {
    GenesisAllocated,
    IssuedPostGenesis,
    Circulating,
    Locked,
    Escrowed,
    FeeReserved,
    Burned,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MonetarySupplyIdentity {
    pub asset_id: NativeAssetId,
    pub genesis_allocated: u128,
    pub issued_post_genesis: u128,
    pub burned: u128,
    pub circulating: u128,
    pub locked: u128,
    pub escrowed: u128,
    pub fee_reserved: u128,
}

impl MonetarySupplyIdentity {
    pub fn expected_total(&self) -> Option<u128> {
        self.genesis_allocated.checked_add(self.issued_post_genesis)?.checked_sub(self.burned)
    }

    pub fn observed_total(&self) -> Option<u128> {
        self.circulating
            .checked_add(self.locked)?
            .checked_add(self.escrowed)?
            .checked_add(self.fee_reserved)
    }

    pub fn reconciles(&self) -> bool {
        match (self.expected_total(), self.observed_total()) {
            (Some(expected), Some(observed)) => expected == observed,
            _ => false,
        }
    }
}

pub fn ticker_unassigned() -> &'static str {
    TICKER_STATUS_NOT_ASSIGNED
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supply_identity_holds_and_rejects_hidden_plug() {
        let ok = MonetarySupplyIdentity {
            asset_id: NativeAssetId::SunReyCoin,
            genesis_allocated: 0,
            issued_post_genesis: 100,
            burned: 10,
            circulating: 70,
            locked: 15,
            escrowed: 5,
            fee_reserved: 0,
        };
        assert!(ok.reconciles());
        let hidden = MonetarySupplyIdentity { circulating: 71, ..ok };
        assert!(!hidden.reconciles());
    }

    #[test]
    fn production_values_remain_unconfigured() {
        assert_eq!(PRODUCTION_PARAMETER_UNCONFIGURED, "UNCONFIGURED");
        assert_eq!(ticker_unassigned(), "NOT_ASSIGNED");
        assert_eq!(MONETARY_POLICY_VERSION, "sunrey.monetary.constitution.v1");
    }
}
