//! Versioned public/read RPC surface.
//!
//! Privileged routes belong on VALIDATOR_RPC / ADMIN_RPC planes.

use std::sync::Mutex;

use serde_json::{json, Value};
use sunrey_node::LocalNode;
use sunrey_protocol::{environment_for_network, observe, FinalitySource, TransactionFinality};

use crate::{block_by_height, status_json, submit, tx_lookup, wallet_account, wallet_fee_estimate};

pub fn dispatch_v1(
    node: &Mutex<LocalNode>,
    method: &str,
    path: &str,
    query: &str,
    body: &str,
) -> Option<(&'static str, Value)> {
    let route = path.split('?').next().unwrap_or(path);
    match (method, route) {
        ("GET", "/v1/chain/status")
        | ("GET", "/v1/network/status")
        | ("GET", "/v1/network/phase") => Some(network_status(node)),
        ("GET", "/v1/health") | ("GET", "/v1/ready") => Some((
            "200 OK",
            json!({"ok": true, "environment": "simulation", "plane": "PUBLIC_RPC"}),
        )),
        ("GET", "/v1/chain/blocks") => Some(latest_block(node)),
        (method, path) if path.starts_with("/v1/chain/blocks/") => {
            let _ = method;
            Some(block_by_height(node, &path["/v1/chain/blocks/".len()..]))
        }
        ("GET", "/v1/transactions") => {
            Some(("200 OK", json!({"items": [], "note": "query by /v1/transactions/{id}"})))
        }
        ("GET", path) if path.starts_with("/v1/transactions/") => {
            Some(tx_with_finality(node, &path["/v1/transactions/".len()..]))
        }
        ("POST", "/v1/transactions") => Some(submit(node, body)),
        ("GET", path) if path.starts_with("/v1/accounts/") => {
            Some(wallet_account(node, &path["/v1/accounts/".len()..]))
        }
        ("GET", "/v1/assets") => Some(assets_json()),
        ("GET", "/v1/fees/estimate") => {
            Some(wallet_fee_estimate(node, &format!("/wallet/fee-estimate?{query}")))
        }
        ("GET", "/v1/validators") => Some(validators_json(node)),
        ("GET", "/v1/validator/status") => Some(validator_status(node)),
        ("GET", "/v1/metrics") => Some(metrics_json(node)),
        ("GET", "/v1/explorer") => Some(("200 OK", explorer_projection(node))),
        _ if route.starts_with("/v1/") => {
            Some(("404 Not Found", json!({"error": "NOT_FOUND", "api": "v1"})))
        }
        _ => None,
    }
}

fn network_status(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    let (status, mut payload) = status_json(node);
    if let Some(obj) = payload.as_object_mut() {
        let network_id = obj.get("network_id").and_then(Value::as_str).unwrap_or("");
        let environment =
            environment_for_network(network_id).map(|env| env.as_str()).unwrap_or("LOCAL");
        obj.insert("apiVersion".into(), json!("v1"));
        obj.insert("networkEnvironment".into(), json!(environment));
        obj.insert("mainnetActive".into(), json!(false));
        obj.insert("productionNetworkEnabled".into(), json!(false));
        obj.insert(
            "finality".into(),
            json!({
                "model": "BFT_COMMIT_CERTIFICATE",
                "localObservationIsNotFinality": true,
                "statuses": [
                    TransactionFinality::Pending.as_str(),
                    TransactionFinality::Included.as_str(),
                    TransactionFinality::Finalized.as_str(),
                    TransactionFinality::Failed.as_str(),
                ],
            }),
        );
    }
    (status, payload)
}

fn latest_block(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    let height = match node.lock() {
        Ok(guard) => guard.status().height,
        Err(_) => return ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    };
    if height == 0 {
        return ("200 OK", json!({"height": 0, "items": [], "environment": "simulation"}));
    }
    block_by_height(node, &height.to_string())
}

fn tx_with_finality(node: &Mutex<LocalNode>, id: &str) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => {
            if guard.queue_contains(id) {
                let observed = observe(id, FinalitySource::Mempool, None);
                return (
                    "200 OK",
                    json!({
                        "tx_id": id,
                        "status": observed.status.as_str(),
                        "source": observed.source.as_str(),
                        "local_observation_is_not_finality": observed.local_observation_is_not_finality,
                    }),
                );
            }
        }
        Err(_) => return ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
    let (status, mut payload) = tx_lookup(node, id);
    if status.starts_with('2') {
        if let Some(obj) = payload.as_object_mut() {
            let height = obj.get("height").and_then(Value::as_u64);
            let observed = observe(id, FinalitySource::LocalBlockObservation, height);
            obj.insert("status".into(), json!(observed.status.as_str()));
            obj.insert("source".into(), json!(observed.source.as_str()));
            obj.insert(
                "local_observation_is_not_finality".into(),
                json!(observed.local_observation_is_not_finality),
            );
            obj.insert(
                "note".into(),
                json!("INCLUDED is a local observation; FINALIZED requires a commit certificate"),
            );
        }
    }
    (status, payload)
}

fn assets_json() -> (&'static str, Value) {
    (
        "200 OK",
        json!({
            "assets": [
                {"id": "SUNREY_COIN", "tickerStatus": "NOT_ASSIGNED"},
                {"id": "MOONREY_COIN", "tickerStatus": "NOT_ASSIGNED"},
            ],
            "environment": "simulation",
        }),
    )
}

fn validators_json(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => (
            "200 OK",
            json!({
                "network_id": guard.status().network_id,
                "producer": guard.status().producer,
                "items": [],
                "note": "validator set is protocol-owned; this is a public read projection",
            }),
        ),
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn validator_status(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    let (status, mut payload) = status_json(node);
    if let Some(obj) = payload.as_object_mut() {
        obj.insert("plane".into(), json!("VALIDATOR_RPC"));
    }
    (status, payload)
}

fn metrics_json(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => {
            let status = guard.status();
            (
                "200 OK",
                json!({
                    "block_height": status.height,
                    "mempool_size": status.queue_len,
                    "network_id": status.network_id,
                    "environment": "simulation",
                    "secrets_exported": false,
                }),
            )
        }
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

pub fn explorer_projection(node: &Mutex<LocalNode>) -> Value {
    match node.lock() {
        Ok(guard) => {
            let status = guard.status();
            json!({
                "blocks": {"height": status.height, "latest_block_id": status.latest_block_id},
                "network": {
                    "network_id": status.network_id,
                    "chain_id": status.chain_id,
                    "environment": status.environment,
                },
                "authoritative": false,
                "note": "explorer is a rebuildable projection",
            })
        }
        Err(_) => json!({"error": "NOT_READY"}),
    }
}
