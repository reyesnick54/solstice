//! Allowlist-based network isolation for interop services.

use serde::{Deserialize, Serialize};

use crate::error::InteropError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteropNetworkPolicy {
    pub allowed_external_rpc_endpoints: Vec<String>,
    pub allowed_sunrey_ingress_endpoints: Vec<String>,
    pub denied_destinations: Vec<String>,
    pub allow_database_access: bool,
    pub allow_admin_api_access: bool,
    pub allow_secret_store_access: bool,
    pub allow_validator_key_access: bool,
    pub allow_unrelated_providers: bool,
}

impl Default for InteropNetworkPolicy {
    fn default() -> Self {
        Self {
            allowed_external_rpc_endpoints: vec!["fixture://external-dev-rpc".into()],
            allowed_sunrey_ingress_endpoints: vec!["https://interop-ingress.sunrey.test/v1".into()],
            denied_destinations: vec![
                "postgres://*".into(),
                "https://admin.sunrey.internal/*".into(),
                "https://vault.sunrey.internal/*".into(),
            ],
            allow_database_access: false,
            allow_admin_api_access: false,
            allow_secret_store_access: false,
            allow_validator_key_access: false,
            allow_unrelated_providers: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InteropServiceRole {
    Watcher,
    Relayer,
    ValidatorNode,
}

impl InteropServiceRole {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Watcher => "WATCHER",
            Self::Relayer => "RELAYER",
            Self::ValidatorNode => "VALIDATOR_NODE",
        }
    }
}

pub fn egress_allowed(
    policy: &InteropNetworkPolicy,
    role: InteropServiceRole,
    destination: &str,
) -> bool {
    if policy.denied_destinations.iter().any(|d| pattern_match(d, destination)) {
        return false;
    }
    match role {
        InteropServiceRole::Watcher => {
            policy.allowed_external_rpc_endpoints.iter().any(|e| pattern_match(e, destination))
        }
        InteropServiceRole::Relayer => {
            policy.allowed_sunrey_ingress_endpoints.iter().any(|e| pattern_match(e, destination))
        }
        InteropServiceRole::ValidatorNode => false,
    }
}

pub fn require_egress(
    policy: &InteropNetworkPolicy,
    role: InteropServiceRole,
    destination: &str,
) -> Result<(), InteropError> {
    if !egress_allowed(policy, role, destination) {
        return Err(InteropError::NetworkEgressDenied);
    }
    if role != InteropServiceRole::ValidatorNode
        && (destination.contains("validator-key") || destination.contains("consensus-key"))
    {
        return Err(InteropError::NetworkEgressDenied);
    }
    if !policy.allow_database_access && destination.starts_with("postgres://") {
        return Err(InteropError::NetworkEgressDenied);
    }
    if !policy.allow_admin_api_access && destination.contains("/admin") {
        return Err(InteropError::NetworkEgressDenied);
    }
    if !policy.allow_secret_store_access && destination.contains("vault") {
        return Err(InteropError::NetworkEgressDenied);
    }
    if !policy.allow_validator_key_access
        && destination.contains("validator")
        && destination.contains("key")
    {
        return Err(InteropError::NetworkEgressDenied);
    }
    Ok(())
}

fn pattern_match(pattern: &str, value: &str) -> bool {
    if let Some(prefix) = pattern.strip_suffix("/*") {
        value.starts_with(prefix)
    } else if let Some(prefix) = pattern.strip_suffix('*') {
        value.starts_with(prefix)
    } else {
        pattern == value
    }
}
