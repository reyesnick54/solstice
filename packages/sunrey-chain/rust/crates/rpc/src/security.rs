//! RPC plane separation, rate limits, and request hardening.
//!
//! Privileged validator/admin methods are never public.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

pub const MAX_REQUEST_BYTES: usize = 65_536;
pub const DEFAULT_RATE_PER_WINDOW: u32 = 32;
pub const DEFAULT_WINDOW_MS: u64 = 1_000;
pub const DEFAULT_MAX_PATH_LEN: usize = 512;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RpcPlane {
    Public,
    Validator,
    Admin,
    SimulationCombined,
}

impl RpcPlane {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Public => "PUBLIC_RPC",
            Self::Validator => "VALIDATOR_RPC",
            Self::Admin => "ADMIN_RPC",
            Self::SimulationCombined => "SIMULATION_COMBINED_RPC",
        }
    }

    pub fn exposes_admin(self) -> bool {
        matches!(self, Self::Admin | Self::SimulationCombined)
    }

    pub fn exposes_validator(self) -> bool {
        matches!(self, Self::Validator | Self::Admin | Self::SimulationCombined)
    }

    pub fn public_bind_only(self) -> bool {
        self == Self::Public
    }
}

#[derive(Debug, Clone)]
pub struct RpcSecurityConfig {
    pub plane: RpcPlane,
    pub rate_per_window: u32,
    pub window_ms: u64,
    pub max_request_bytes: usize,
    pub max_path_len: usize,
    pub cors_origins: Vec<String>,
    pub allow_unauthenticated_admin: bool,
}

impl RpcSecurityConfig {
    pub fn for_plane(plane: RpcPlane) -> Self {
        Self {
            plane,
            rate_per_window: DEFAULT_RATE_PER_WINDOW,
            window_ms: DEFAULT_WINDOW_MS,
            max_request_bytes: MAX_REQUEST_BYTES,
            max_path_len: DEFAULT_MAX_PATH_LEN,
            cors_origins: if plane == RpcPlane::Public {
                vec!["https://explorer.sunrey.test".into()]
            } else {
                Vec::new()
            },
            allow_unauthenticated_admin: plane == RpcPlane::SimulationCombined,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct RateLimiter {
    hits: HashMap<String, (u64, u32)>,
    pub accepted: u64,
    pub rejected: u64,
}

impl RateLimiter {
    pub fn allow(&mut self, key: &str, now_ms: u64, limit: u32, window_ms: u64) -> bool {
        let entry = self.hits.entry(key.to_string()).or_insert((now_ms, 0));
        if now_ms.saturating_sub(entry.0) >= window_ms {
            *entry = (now_ms, 0);
        }
        if entry.1 >= limit {
            self.rejected += 1;
            return false;
        }
        entry.1 += 1;
        self.accepted += 1;
        true
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

pub fn next_request_id(counter: u64) -> String {
    format!("req_{}_{counter}", now_ms())
}

pub fn method_allowed(plane: RpcPlane, method: &str, path: &str) -> bool {
    if path.len() > DEFAULT_MAX_PATH_LEN {
        return false;
    }
    if method == "OPTIONS" {
        return plane == RpcPlane::Public || plane == RpcPlane::SimulationCombined;
    }
    if path.starts_with("/admin") || path.contains("produce-block") {
        return plane.exposes_admin();
    }
    if path.starts_with("/v1/validator") || path.starts_with("/validator") {
        return plane.exposes_validator();
    }
    if path.starts_with("/v1/") || path == "/health" || path == "/ready" || path == "/status" {
        return true;
    }
    matches!(plane, RpcPlane::SimulationCombined | RpcPlane::Validator | RpcPlane::Admin)
}

pub fn cors_header(config: &RpcSecurityConfig, origin: Option<&str>) -> Option<String> {
    let origin = origin?;
    if config.cors_origins.iter().any(|allowed| allowed == origin) {
        Some(origin.to_string())
    } else {
        None
    }
}

pub const PUBLIC_METHODS: &[&str] = &[
    "GET /v1/chain/status",
    "GET /v1/network/status",
    "GET /v1/chain/blocks",
    "GET /v1/transactions",
    "GET /v1/accounts",
    "GET /v1/assets",
    "GET /v1/fees/estimate",
    "GET /v1/validators",
    "POST /v1/transactions",
];

pub const FORBIDDEN_PUBLIC_METHODS: &[&str] = &[
    "POST /admin/produce-block",
    "GET /v1/validator/admin",
    "POST /v1/validator/sign",
    "POST /validator/unsafe-reset",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_plane_hides_admin() {
        assert!(!method_allowed(RpcPlane::Public, "POST", "/admin/produce-block"));
        assert!(!method_allowed(RpcPlane::Public, "GET", "/v1/validator/admin"));
        assert!(method_allowed(RpcPlane::Public, "GET", "/v1/chain/status"));
        assert!(method_allowed(RpcPlane::Admin, "POST", "/admin/produce-block"));
    }

    #[test]
    fn rate_limiter_rejects_flood() {
        let mut limiter = RateLimiter::default();
        for _ in 0..32 {
            assert!(limiter.allow("127.0.0.1", 1_000, 32, 1_000));
        }
        assert!(!limiter.allow("127.0.0.1", 1_000, 32, 1_000));
        assert_eq!(limiter.rejected, 1);
    }
}
