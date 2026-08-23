//! Local development HTTP API. Binds to loopback by default.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde_json::{json, Value};
use sunrey_node::{LocalNode, NODE_ROLE};
use sunrey_protocol::{hash_to_hex, transaction_id, BlockHeader, RejectReason};
use tracing::{info, warn};

mod security;
mod v1;

pub use security::{RpcPlane, RpcSecurityConfig, FORBIDDEN_PUBLIC_METHODS, PUBLIC_METHODS};

pub struct RpcServer {
    listener: TcpListener,
    node: Arc<Mutex<LocalNode>>,
    config: RpcSecurityConfig,
    limiter: Arc<Mutex<security::RateLimiter>>,
    request_ids: Arc<AtomicU64>,
}

impl RpcServer {
    pub fn bind(addr: &str, node: LocalNode) -> Result<Self, RejectReason> {
        Self::bind_plane(addr, node, RpcPlane::SimulationCombined)
    }

    pub fn bind_plane(addr: &str, node: LocalNode, plane: RpcPlane) -> Result<Self, RejectReason> {
        Self::bind_with_config(addr, node, RpcSecurityConfig::for_plane(plane))
    }

    pub fn bind_with_config(
        addr: &str,
        node: LocalNode,
        config: RpcSecurityConfig,
    ) -> Result<Self, RejectReason> {
        let listener = TcpListener::bind(addr).map_err(|_| RejectReason::PersistenceFailure)?;
        listener.set_nonblocking(false).ok();
        info!(
            event = "rpc_listen",
            addr,
            role = NODE_ROLE,
            plane = config.plane.as_str(),
            "local development API listening"
        );
        Ok(Self {
            listener,
            node: Arc::new(Mutex::new(node)),
            config,
            limiter: Arc::new(Mutex::new(security::RateLimiter::default())),
            request_ids: Arc::new(AtomicU64::new(1)),
        })
    }

    pub fn local_addr(&self) -> String {
        self.listener.local_addr().map(|addr| addr.to_string()).unwrap_or_default()
    }

    pub fn serve(&self) -> Result<(), RejectReason> {
        for stream in self.listener.incoming() {
            match stream {
                Ok(stream) => {
                    let node = Arc::clone(&self.node);
                    let config = self.config.clone();
                    let limiter = Arc::clone(&self.limiter);
                    let request_ids = Arc::clone(&self.request_ids);
                    thread::spawn(move || {
                        if let Err(err) =
                            handle_client(stream, &node, &config, &limiter, &request_ids)
                        {
                            warn!(event = "rpc_error", reason = err.as_str(), "request failed");
                        }
                    });
                }
                Err(_) => thread::sleep(Duration::from_millis(5)),
            }
        }
        Ok(())
    }
}

fn handle_client(
    mut stream: TcpStream,
    node: &Mutex<LocalNode>,
    config: &RpcSecurityConfig,
    limiter: &Mutex<security::RateLimiter>,
    request_ids: &AtomicU64,
) -> Result<(), RejectReason> {
    let mut buf = vec![0u8; config.max_request_bytes];
    let n = stream.read(&mut buf).map_err(|_| RejectReason::DecodeFailed)?;
    if n >= config.max_request_bytes {
        return write_json(
            &mut stream,
            "413 Payload Too Large",
            json!({"error": "SIZE_EXCEEDED"}),
            "oversized",
            None,
        );
    }
    let request = String::from_utf8_lossy(&buf[..n]);
    let parsed = parse_http_full(&request);
    let request_id = parsed
        .request_id
        .unwrap_or_else(|| security::next_request_id(request_ids.fetch_add(1, Ordering::Relaxed)));
    let peer =
        stream.peer_addr().map(|addr| addr.ip().to_string()).unwrap_or_else(|_| "unknown".into());
    if !security::method_allowed(config.plane, &parsed.method, &parsed.path) {
        return write_json(
            &mut stream,
            "403 Forbidden",
            json!({"error": "METHOD_NOT_ALLOWED", "plane": config.plane.as_str()}),
            &request_id,
            security::cors_header(config, parsed.origin.as_deref()),
        );
    }
    let allowed = limiter
        .lock()
        .map(|mut guard| {
            guard.allow(&peer, security::now_ms(), config.rate_per_window, config.window_ms)
        })
        .unwrap_or(true);
    if !allowed {
        return write_json(
            &mut stream,
            "429 Too Many Requests",
            json!({"error": "RATE_LIMITED", "request_id": request_id}),
            &request_id,
            security::cors_header(config, parsed.origin.as_deref()),
        );
    }
    if parsed.method == "OPTIONS" {
        return write_json(
            &mut stream,
            "204 No Content",
            json!({}),
            &request_id,
            security::cors_header(config, parsed.origin.as_deref()),
        );
    }
    let (path, query) = split_query(&parsed.path);
    let (status, payload) = v1::dispatch_v1(node, &parsed.method, path, query, parsed.body)
        .unwrap_or_else(|| dispatch(node, &parsed.method, path, parsed.body));
    write_json(
        &mut stream,
        status,
        payload,
        &request_id,
        security::cors_header(config, parsed.origin.as_deref()),
    )
}

struct ParsedHttp<'a> {
    method: String,
    path: String,
    body: &'a str,
    request_id: Option<String>,
    origin: Option<String>,
}

fn parse_http_full(request: &str) -> ParsedHttp<'_> {
    let mut lines = request.split("\r\n");
    let start = lines.next().unwrap_or("");
    let mut parts = start.split_whitespace();
    let method = parts.next().unwrap_or("GET").to_string();
    let path = parts.next().unwrap_or("/").to_string();
    let mut request_id = None;
    let mut origin = None;
    for line in lines {
        if let Some((key, value)) = line.split_once(':') {
            if key.eq_ignore_ascii_case("x-request-id") {
                request_id = Some(value.trim().to_string());
            }
            if key.eq_ignore_ascii_case("origin") {
                origin = Some(value.trim().to_string());
            }
        }
    }
    let body = request.split("\r\n\r\n").nth(1).unwrap_or("");
    ParsedHttp { method, path, body, request_id, origin }
}

fn split_query(path: &str) -> (&str, &str) {
    match path.split_once('?') {
        Some((route, query)) => (route, query),
        None => (path, ""),
    }
}

fn write_json(
    stream: &mut TcpStream,
    status: &str,
    payload: Value,
    request_id: &str,
    cors: Option<String>,
) -> Result<(), RejectReason> {
    let body_bytes = if status.starts_with("204") { String::new() } else { payload.to_string() };
    let cors_line = cors
        .map(|origin| format!("Access-Control-Allow-Origin: {origin}\r\nAccess-Control-Allow-Headers: content-type,x-request-id\r\n"))
        .unwrap_or_default();
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nX-Request-Id: {request_id}\r\n{cors_line}Connection: close\r\n\r\n{body_bytes}",
        body_bytes.len()
    );
    stream.write_all(response.as_bytes()).map_err(|_| RejectReason::PersistenceFailure)?;
    Ok(())
}

fn dispatch(
    node: &Mutex<LocalNode>,
    method: &str,
    path: &str,
    body: &str,
) -> (&'static str, Value) {
    match (method, path) {
        ("GET", "/health") | ("GET", "/ready") => {
            ("200 OK", json!({"ok": true, "environment": "simulation", "role": NODE_ROLE}))
        }
        ("GET", "/status") | ("GET", "/chain") => status_json(node),
        ("GET", "/governance") => governance_json(node),
        ("GET", "/oracle/providers") => oracle_providers(node),
        ("GET", "/oracle/feeds") => oracle_feeds(node),
        ("GET", "/oracle/disputes") => oracle_disputes(node),
        ("GET", "/oracle/quality") => oracle_quality(node),
        ("GET", "/protocol/version") => protocol_json(node),
        ("POST", "/tx") => submit(node, body),
        ("POST", "/admin/produce-block") => produce(node),
        ("GET", "/wallet/finality") => wallet_finality(node),
        ("GET", "/wallet/crypto-policy") => wallet_crypto_policy(node),
        _ if path.starts_with("/wallet/fee-estimate") => wallet_fee_estimate(node, path),
        _ if path.starts_with("/wallet/account/") => {
            wallet_account(node, &path["/wallet/account/".len()..])
        }
        _ if path.starts_with("/wallet/nonce/") => {
            wallet_nonce(node, &path["/wallet/nonce/".len()..])
        }
        _ if path.starts_with("/wallet/holdings/") => {
            wallet_holdings(node, &path["/wallet/holdings/".len()..])
        }
        _ if path.starts_with("/wallet/locks/") => {
            wallet_locks(node, &path["/wallet/locks/".len()..])
        }
        _ if path.starts_with("/wallet/tx/") => tx_lookup(node, &path["/wallet/tx/".len()..]),
        _ if path.starts_with("/block/height/") => {
            block_by_height(node, &path["/block/height/".len()..])
        }
        _ if path.starts_with("/block/id/") => block_by_id(node, &path["/block/id/".len()..]),
        _ if path.starts_with("/tx/") => tx_lookup(node, &path["/tx/".len()..]),
        _ if path.starts_with("/state/") => state_query(node, &path["/state/".len()..]),
        _ if path.starts_with("/oracle/observation/") => {
            oracle_observation(node, &path["/oracle/observation/".len()..])
        }
        _ if path.starts_with("/oracle/fact/") => oracle_fact(node, &path["/oracle/fact/".len()..]),
        _ if path.starts_with("/oracle/facts") => oracle_facts(node, path),
        _ => ("404 Not Found", json!({"error": "NOT_FOUND"})),
    }
}

pub(crate) fn status_json(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => {
            ("200 OK", serde_json::to_value(guard.status()).unwrap_or(json!({"error": "ENCODE"})))
        }
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn oracle_providers(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => (
            "200 OK",
            serde_json::to_value(&guard.oracle.providers).unwrap_or(json!({"error": "ENCODE"})),
        ),
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn oracle_feeds(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => (
            "200 OK",
            serde_json::to_value(&guard.oracle.feeds).unwrap_or(json!({"error": "ENCODE"})),
        ),
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn oracle_disputes(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => (
            "200 OK",
            serde_json::to_value(&guard.oracle.disputes).unwrap_or(json!({"error": "ENCODE"})),
        ),
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn oracle_quality(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(mut guard) => ("200 OK", serde_json::json!(guard.oracle.quality_report())),
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn oracle_observation(node: &Mutex<LocalNode>, id: &str) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => match guard.oracle.observations.get(id) {
            Some(row) => {
                ("200 OK", serde_json::to_value(row).unwrap_or(json!({"error": "ENCODE"})))
            }
            None => ("404 Not Found", json!({"error": "NOT_FOUND"})),
        },
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn oracle_fact(node: &Mutex<LocalNode>, id: &str) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => match guard.oracle.facts.get(id) {
            Some(row) => {
                ("200 OK", serde_json::to_value(row).unwrap_or(json!({"error": "ENCODE"})))
            }
            None => ("404 Not Found", json!({"error": "NOT_FOUND"})),
        },
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn oracle_facts(node: &Mutex<LocalNode>, path: &str) -> (&'static str, Value) {
    let feed = path.split("feed=").nth(1).map(|raw| raw.split('&').next().unwrap_or(raw));
    match node.lock() {
        Ok(guard) => {
            let rows: Vec<_> = guard
                .oracle
                .facts
                .values()
                .filter(|fact| feed.map(|id| fact.feed_id == id).unwrap_or(true))
                .cloned()
                .collect();
            ("200 OK", serde_json::to_value(rows).unwrap_or(json!({"error": "ENCODE"})))
        }
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn governance_json(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => ("200 OK", guard.governance.metrics_json()),
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn protocol_json(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => {
            let commits = guard.governance.commitments();
            (
                "200 OK",
                json!({
                    "protocol_version": commits.protocol_version,
                    "consensus_params_hash": hash_to_hex(&commits.consensus_params_hash),
                    "module_registry_hash": hash_to_hex(&commits.module_registry_hash),
                    "codec_registry_hash": hash_to_hex(&commits.codec_registry_hash),
                    "crypto_policy_hash": hash_to_hex(&commits.crypto_policy_hash),
                }),
            )
        }
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

pub(crate) fn submit(node: &Mutex<LocalNode>, body: &str) -> (&'static str, Value) {
    let parsed: Value = match serde_json::from_str(body) {
        Ok(value) => value,
        Err(_) => return ("400 Bad Request", json!({"error": "DECODE_FAILED"})),
    };
    let hex = parsed.get("hex").and_then(Value::as_str).unwrap_or("");
    let bytes = match sunrey_protocol::hex_decode(hex) {
        Ok(bytes) => bytes,
        Err(_) => return ("400 Bad Request", json!({"error": "DECODE_FAILED"})),
    };
    match node.lock() {
        Ok(mut guard) => match guard.submit_bytes(&bytes) {
            Ok(tx_id) => ("200 OK", json!({"tx_id": tx_id})),
            Err(reason) => ("400 Bad Request", json!({"error": reason.as_str()})),
        },
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn produce(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(mut guard) => match guard.produce_block() {
            Ok(result) => ("200 OK", serde_json::to_value(result).unwrap_or(json!({"ok": true}))),
            Err(reason) => ("400 Bad Request", json!({"error": reason.as_str()})),
        },
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

pub(crate) fn block_by_height(node: &Mutex<LocalNode>, height: &str) -> (&'static str, Value) {
    let Ok(height) = height.parse::<u64>() else {
        return ("400 Bad Request", json!({"error": "SCHEMA_INVALID"}));
    };
    match node.lock() {
        Ok(guard) => match guard.store.load_block(height) {
            Ok(stored) => ("200 OK", block_json(&guard, &stored.header, stored.transactions.len())),
            Err(reason) => ("404 Not Found", json!({"error": reason.as_str()})),
        },
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn block_by_id(node: &Mutex<LocalNode>, id: &str) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => match guard.store.load_block_by_id(id) {
            Ok(stored) => ("200 OK", block_json(&guard, &stored.header, stored.transactions.len())),
            Err(reason) => ("404 Not Found", json!({"error": reason.as_str()})),
        },
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn block_json(node: &LocalNode, header: &BlockHeader, tx_count: usize) -> Value {
    json!({
        "height": header.height,
        "block_id": hash_to_hex(&sunrey_protocol::block_id(&node.suite, header)),
        "parent_block_id": hash_to_hex(&header.parent_block_id),
        "transaction_root": hash_to_hex(&header.transaction_root),
        "app_hash": hash_to_hex(&header.app_hash),
        "timestamp_unix_ms": header.timestamp_unix_ms,
        "proposer": header.proposer,
        "tx_count": tx_count,
        "environment": "simulation",
    })
}

pub(crate) fn tx_lookup(node: &Mutex<LocalNode>, id: &str) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => match guard.lookup_tx(id) {
            Ok((height, tx, block_id)) => (
                "200 OK",
                json!({
                    "tx_id": hash_to_hex(&transaction_id(&guard.suite, &tx.unsigned)),
                    "height": height,
                    "block_id": block_id,
                    "family": tx.unsigned.family.as_str(),
                    "nonce": tx.unsigned.nonce,
                }),
            ),
            Err(reason) => ("404 Not Found", json!({"error": reason.as_str()})),
        },
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn wallet_finality(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => {
            let status = guard.status();
            (
                "200 OK",
                json!({
                    "height": status.height,
                    "latest_block_id": status.latest_block_id,
                    "app_hash": status.app_hash,
                    "environment": "simulation",
                    "local_observation_is_not_finality": true,
                    "statuses": ["PENDING", "INCLUDED", "FINALIZED", "FAILED"],
                    "note": "FINALIZED requires a BFT commit certificate; local height is INCLUDED only"
                }),
            )
        }
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn wallet_crypto_policy(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => (
            "200 OK",
            json!({
                "crypto_policy_hash": guard.crypto_policy_commitment(),
                "private_keys_exposed": false,
            }),
        ),
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

pub(crate) fn wallet_fee_estimate(node: &Mutex<LocalNode>, path: &str) -> (&'static str, Value) {
    let bytes = path
        .split("bytes=")
        .nth(1)
        .and_then(|raw| raw.split('&').next())
        .and_then(|raw| raw.parse::<u128>().ok())
        .unwrap_or(256);
    let sigs = path
        .split("sigs=")
        .nth(1)
        .and_then(|raw| raw.split('&').next())
        .and_then(|raw| raw.parse::<u128>().ok())
        .unwrap_or(1);
    match node.lock() {
        Ok(guard) => {
            let mut estimate = guard.fees_estimate(bytes, sigs);
            if let Some(obj) = estimate.as_object_mut() {
                obj.insert(
                    "distinguishes".into(),
                    json!(["estimated_fee", "maximum_authorized_fee", "actual_finalized_fee"]),
                );
            }
            ("200 OK", estimate)
        }
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

pub(crate) fn wallet_account(node: &Mutex<LocalNode>, id: &str) -> (&'static str, Value) {
    let parsed = sunrey_wallet::parse_address(id, None).ok();
    match node.lock() {
        Ok(guard) => match guard.native_assets() {
            Ok(assets) => {
                let sun = assets.holding(id, sunrey_native_assets::NativeAssetId::SunReyCoin);
                (
                    "200 OK",
                    json!({
                        "account_id": id,
                        "address": parsed.as_ref().map(|addr| addr.text.clone()),
                        "address_class": parsed.as_ref().map(|addr| format!("{:?}", addr.address_class)),
                        "nonce": 0,
                        "status": "ACTIVE",
                        "holdings_note": "native balances are canonical chain state",
                        "sunrey_available": sun.available.to_string(),
                        "ticker_status": "NOT_ASSIGNED",
                    }),
                )
            }
            Err(_) => ("404 Not Found", json!({"error": "NOT_FOUND"})),
        },
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn wallet_nonce(node: &Mutex<LocalNode>, id: &str) -> (&'static str, Value) {
    let _ = id;
    match node.lock() {
        Ok(guard) => {
            ("200 OK", json!({"account_id": id, "nonce": 0, "height": guard.status().height}))
        }
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn wallet_holdings(node: &Mutex<LocalNode>, id: &str) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => match guard.native_assets() {
            Ok(assets) => {
                let sun = assets.holding(id, sunrey_native_assets::NativeAssetId::SunReyCoin);
                let moon = assets.holding(id, sunrey_native_assets::NativeAssetId::MoonReyCoin);
                (
                    "200 OK",
                    json!({
                        "account_id": id,
                        "SUNREY_COIN": {"available": sun.available.to_string(), "locked": sun.locked.to_string()},
                        "MOONREY_COIN": {"available": moon.available.to_string(), "locked": moon.locked.to_string()},
                        "ticker_status": "NOT_ASSIGNED",
                    }),
                )
            }
            Err(_) => ("404 Not Found", json!({"error": "NOT_FOUND"})),
        },
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn wallet_locks(node: &Mutex<LocalNode>, id: &str) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => match guard.native_assets() {
            Ok(assets) => {
                let locks = assets.locks_for(id);
                (
                    "200 OK",
                    json!({
                        "account_id": id,
                        "locks": locks,
                    }),
                )
            }
            Err(_) => ("404 Not Found", json!({"error": "NOT_FOUND"})),
        },
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn state_query(node: &Mutex<LocalNode>, key: &str) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => match guard.get_state(key) {
            Some(value) => ("200 OK", json!({"key": key, "hex": hex::encode(value)})),
            None => ("404 Not Found", json!({"error": "NOT_FOUND"})),
        },
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

pub fn http_get(addr: &str, path: &str) -> Result<String, RejectReason> {
    let mut stream = TcpStream::connect(addr).map_err(|_| RejectReason::NotReady)?;
    stream.set_read_timeout(Some(Duration::from_secs(2))).ok();
    let req = format!("GET {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n");
    stream.write_all(req.as_bytes()).map_err(|_| RejectReason::NotReady)?;
    let mut buf = String::new();
    stream.read_to_string(&mut buf).map_err(|_| RejectReason::NotReady)?;
    Ok(buf)
}

pub fn http_post(addr: &str, path: &str, body: &str) -> Result<String, RejectReason> {
    let mut stream = TcpStream::connect(addr).map_err(|_| RejectReason::NotReady)?;
    stream.set_read_timeout(Some(Duration::from_secs(2))).ok();
    let req = format!(
        "POST {path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(req.as_bytes()).map_err(|_| RejectReason::NotReady)?;
    let mut buf = String::new();
    stream.read_to_string(&mut buf).map_err(|_| RejectReason::NotReady)?;
    Ok(buf)
}
