//! Interop circuit breakers and bounded pause authority.
//!
//! No single administrative key bypasses consensus rules.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::error::InteropError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteropCircuitBreakers {
    pub global_paused: bool,
    pub paused_networks: BTreeSet<String>,
    pub paused_assets: BTreeSet<String>,
    pub rate_limit_per_window: u64,
    pub value_limit_minor: u128,
    pub message_count_limit: u64,
    pub anomaly_threshold: u64,
    pub window_message_count: u64,
    pub window_value_minor: u128,
    pub consecutive_anomalies: u64,
    pub audit_log: Vec<String>,
}

impl Default for InteropCircuitBreakers {
    fn default() -> Self {
        Self {
            global_paused: false,
            paused_networks: BTreeSet::new(),
            paused_assets: BTreeSet::new(),
            rate_limit_per_window: 64,
            value_limit_minor: 1_000_000,
            message_count_limit: 1_024,
            anomaly_threshold: 8,
            window_message_count: 0,
            window_value_minor: 0,
            consecutive_anomalies: 0,
            audit_log: Vec::new(),
        }
    }
}

impl InteropCircuitBreakers {
    pub fn pause_global(&mut self, actor: &str, reason: &str) {
        self.global_paused = true;
        self.audit_log.push(format!("GLOBAL_PAUSE actor={actor} reason={reason}"));
    }

    pub fn pause_network(&mut self, network_id: &str, actor: &str, reason: &str) {
        self.paused_networks.insert(network_id.to_string());
        self.audit_log
            .push(format!("NETWORK_PAUSE network={network_id} actor={actor} reason={reason}"));
    }

    pub fn pause_asset(&mut self, asset_id: &str, actor: &str, reason: &str) {
        self.paused_assets.insert(asset_id.to_string());
        self.audit_log.push(format!("ASSET_PAUSE asset={asset_id} actor={actor} reason={reason}"));
    }

    pub fn emergency_disable(&mut self, actor: &str, reason: &str) {
        self.global_paused = true;
        self.audit_log.push(format!("EMERGENCY_DISABLE actor={actor} reason={reason}"));
    }

    pub fn guard_message(
        &mut self,
        network_id: &str,
        asset_id: Option<&str>,
        value_minor: u128,
    ) -> Result<(), InteropError> {
        if self.global_paused {
            return Err(InteropError::GlobalInteropPaused);
        }
        if self.paused_networks.contains(network_id) {
            return Err(InteropError::NetworkPaused);
        }
        if let Some(asset) = asset_id {
            if self.paused_assets.contains(asset) {
                return Err(InteropError::AssetPaused);
            }
        }
        if value_minor > self.value_limit_minor {
            return Err(InteropError::ValueLimitExceeded);
        }
        if self.window_message_count >= self.message_count_limit {
            return Err(InteropError::MessageCountLimitExceeded);
        }
        if self.window_message_count >= self.rate_limit_per_window {
            return Err(InteropError::RateLimited);
        }
        if self.window_value_minor.saturating_add(value_minor) > self.value_limit_minor {
            return Err(InteropError::ValueLimitExceeded);
        }
        self.window_message_count += 1;
        self.window_value_minor = self.window_value_minor.saturating_add(value_minor);
        Ok(())
    }

    pub fn record_anomaly(&mut self, detail: &str) -> Result<(), InteropError> {
        self.consecutive_anomalies += 1;
        self.audit_log.push(format!("ANOMALY detail={detail}"));
        if self.consecutive_anomalies >= self.anomaly_threshold {
            self.global_paused = true;
            return Err(InteropError::AnomalyThresholdExceeded);
        }
        Ok(())
    }

    pub fn reset_window(&mut self) {
        self.window_message_count = 0;
        self.window_value_minor = 0;
        self.consecutive_anomalies = 0;
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PauseAuthorityRegistry {
    pub authorized_actors: BTreeMap<String, Vec<String>>,
}

impl PauseAuthorityRegistry {
    pub fn may_pause(&self, actor: &str, scope: &str) -> bool {
        self.authorized_actors
            .get(actor)
            .map(|scopes| scopes.iter().any(|s| s == scope || s == "GLOBAL"))
            .unwrap_or(false)
    }
}
