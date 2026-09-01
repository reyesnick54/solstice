//! RPC method classification for interop components.
//!
//! Interop relayers and watchers receive the minimum required subset only.

use crate::error::InteropError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RpcMethodClass {
    ReadOnly,
    Submission,
    Admin,
    Validator,
    Dangerous,
}

pub fn classify_rpc_method(method: &str, path: &str) -> RpcMethodClass {
    let key = format!("{method} {path}");
    if FORBIDDEN_INTEROP_METHODS.iter().any(|m| key.contains(m)) {
        return RpcMethodClass::Dangerous;
    }
    if path.contains("/admin") || path.contains("produce-block") || path.contains("unsafe-reset") {
        return RpcMethodClass::Admin;
    }
    if path.contains("/validator") && (method == "POST" || path.contains("sign")) {
        return RpcMethodClass::Validator;
    }
    if method == "POST" && path.contains("/transactions") {
        return RpcMethodClass::Submission;
    }
    if method == "GET" {
        return RpcMethodClass::ReadOnly;
    }
    RpcMethodClass::Dangerous
}

pub const INTEROP_RELAYER_ALLOWED: &[RpcMethodClass] =
    &[RpcMethodClass::ReadOnly, RpcMethodClass::Submission];

pub const INTEROP_WATCHER_ALLOWED: &[RpcMethodClass] = &[RpcMethodClass::ReadOnly];

pub const FORBIDDEN_INTEROP_METHODS: &[&str] = &[
    "POST /admin",
    "POST /v1/validator/sign",
    "GET /v1/validator/admin",
    "POST /validator/unsafe-reset",
    "produce-block",
];

pub fn interop_may_call(role: &str, method: &str, path: &str) -> Result<(), InteropError> {
    let class = classify_rpc_method(method, path);
    let allowed = match role {
        "RELAYER" => INTEROP_RELAYER_ALLOWED,
        "WATCHER" => INTEROP_WATCHER_ALLOWED,
        _ => return Err(InteropError::RpcMethodForbidden),
    };
    if matches!(
        class,
        RpcMethodClass::Dangerous | RpcMethodClass::Admin | RpcMethodClass::Validator
    ) {
        return Err(InteropError::RpcMethodForbidden);
    }
    if allowed.contains(&class) {
        Ok(())
    } else {
        Err(InteropError::RpcMethodForbidden)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relayer_cannot_reach_admin_rpc() {
        assert_eq!(
            interop_may_call("RELAYER", "POST", "/admin/produce-block").unwrap_err(),
            InteropError::RpcMethodForbidden
        );
    }

    #[test]
    fn watcher_cannot_submit_transactions() {
        assert_eq!(
            interop_may_call("WATCHER", "POST", "/v1/transactions").unwrap_err(),
            InteropError::RpcMethodForbidden
        );
    }

    #[test]
    fn relayer_may_read_chain_status() {
        interop_may_call("RELAYER", "GET", "/v1/chain/status").unwrap();
    }
}
