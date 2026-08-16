use serde::{Deserialize, Serialize};

use crate::error::InteropError;

pub const DEV_INTEROP_TEST_ASSET: &str = "DEV_INTEROP_TEST_ASSET";
pub const SUNREY_COIN: &str = "SUNREY_COIN";
pub const MOONREY_COIN: &str = "MOONREY_COIN";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TransferModel {
    EscrowThenRepresent,
}

impl TransferModel {
    pub fn as_str(self) -> &'static str {
        "ESCROW_THEN_REPRESENT"
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteropAssetLedger {
    pub asset_id: String,
    pub defined_total: u128,
    pub circulating: u128,
    pub escrowed: u128,
    pub authorized_remote: u128,
    pub model: TransferModel,
    pub allowlisted: bool,
}

impl InteropAssetLedger {
    pub fn development(total: u128) -> Self {
        Self {
            asset_id: DEV_INTEROP_TEST_ASSET.to_string(),
            defined_total: total,
            circulating: total,
            escrowed: 0,
            authorized_remote: 0,
            model: TransferModel::EscrowThenRepresent,
            allowlisted: true,
        }
    }

    pub fn invariant(&self) -> Result<(), InteropError> {
        let sum = self
            .circulating
            .checked_add(self.escrowed)
            .and_then(|v| v.checked_add(self.authorized_remote))
            .ok_or(InteropError::SupplyInvariantViolated)?;
        if sum != self.defined_total {
            return Err(InteropError::SupplyInvariantViolated);
        }
        Ok(())
    }

    pub fn refuse_fiat(asset: &str) -> Result<(), InteropError> {
        if asset.starts_with(DEV_INTEROP_TEST_ASSET) {
            return Ok(());
        }
        match asset {
            "USD" | "EUR" | "GBP" | "FIAT" | "WRAPPED_USD" | "WUSD" => {
                Err(InteropError::WrappedFiatForbidden)
            }
            SUNREY_COIN | MOONREY_COIN => Err(InteropError::ProductionAssetUnavailable),
            _ => Err(InteropError::CapabilityDenied),
        }
    }

    pub fn escrow(&mut self, amount: u128) -> Result<(), InteropError> {
        Self::refuse_fiat(&self.asset_id)?;
        if !self.allowlisted {
            return Err(InteropError::CapabilityDenied);
        }
        if self.circulating < amount {
            return Err(InteropError::SupplyInvariantViolated);
        }
        self.circulating -= amount;
        self.escrowed += amount;
        self.invariant()
    }

    pub fn represent_remote(&mut self, amount: u128) -> Result<(), InteropError> {
        if self.escrowed < amount {
            return Err(InteropError::SupplyInvariantViolated);
        }
        self.escrowed -= amount;
        self.authorized_remote += amount;
        self.invariant()
    }

    pub fn timeout_recover(&mut self, amount: u128) -> Result<(), InteropError> {
        if self.escrowed < amount {
            return Err(InteropError::SupplyInvariantViolated);
        }
        self.escrowed -= amount;
        self.circulating += amount;
        self.invariant()
    }

    pub fn snapshot(&self) -> serde_json::Value {
        serde_json::json!({
            "asset_id": self.asset_id,
            "defined_total": self.defined_total.to_string(),
            "circulating": self.circulating.to_string(),
            "escrowed": self.escrowed.to_string(),
            "authorized_remote": self.authorized_remote.to_string(),
            "model": self.model.as_str(),
            "invariant": "circulating + escrowed + authorized_remote = defined_total",
        })
    }
}
