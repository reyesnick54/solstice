//! Local development HTTP API. Binds to loopback by default.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde_json::{json, Value};
use sunrey_node::{LocalNode, NODE_ROLE};
use sunrey_protocol::{hash_to_hex, transaction_id, BlockHeader, RejectReason};
use tracing::{info, warn};

pub struct RpcServer {
    listener: TcpListener,
    node: Arc<Mutex<LocalNode>>,
}

impl RpcServer {
    pub fn bind(addr: &str, node: LocalNode) -> Result<Self, RejectReason> {
        let listener = TcpListener::bind(addr).map_err(|_| RejectReason::PersistenceFailure)?;
        listener.set_nonblocking(false).ok();
        info!(event = "rpc_listen", addr, role = NODE_ROLE, "local development API listening");
        Ok(Self { listener, node: Arc::new(Mutex::new(node)) })
    }

    pub fn local_addr(&self) -> String {
        self.listener.local_addr().map(|addr| addr.to_string()).unwrap_or_default()
    }

    pub fn serve(&self) -> Result<(), RejectReason> {
        for stream in self.listener.incoming() {
            match stream {
                Ok(stream) => {
                    let node = Arc::clone(&self.node);
                    thread::spawn(move || {
                        if let Err(err) = handle_client(stream, &node) {
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

fn handle_client(mut stream: TcpStream, node: &Mutex<LocalNode>) -> Result<(), RejectReason> {
    let mut buf = vec![0u8; 65536];
    let n = stream.read(&mut buf).map_err(|_| RejectReason::DecodeFailed)?;
    let request = String::from_utf8_lossy(&buf[..n]);
    let (method, path, body) = parse_http(&request);
    let (status, payload) = dispatch(node, &method, &path, body);
    let body_bytes = payload.to_string();
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body_bytes}",
        body_bytes.len()
    );
    stream.write_all(response.as_bytes()).map_err(|_| RejectReason::PersistenceFailure)?;
    Ok(())
}

fn parse_http(request: &str) -> (String, String, &str) {
    let mut lines = request.split("\r\n");
    let start = lines.next().unwrap_or("");
    let mut parts = start.split_whitespace();
    let method = parts.next().unwrap_or("GET").to_string();
    let path = parts.next().unwrap_or("/").to_string();
    let body = request.split("\r\n\r\n").nth(1).unwrap_or("");
    (method, path, body)
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
        ("POST", "/tx") => submit(node, body),
        ("POST", "/admin/produce-block") => produce(node),
        _ if path.starts_with("/block/height/") => {
            block_by_height(node, &path["/block/height/".len()..])
        }
        _ if path.starts_with("/block/id/") => block_by_id(node, &path["/block/id/".len()..]),
        _ if path.starts_with("/tx/") => tx_lookup(node, &path["/tx/".len()..]),
        _ if path.starts_with("/state/") => state_query(node, &path["/state/".len()..]),
        _ => ("404 Not Found", json!({"error": "NOT_FOUND"})),
    }
}

fn status_json(node: &Mutex<LocalNode>) -> (&'static str, Value) {
    match node.lock() {
        Ok(guard) => {
            ("200 OK", serde_json::to_value(guard.status()).unwrap_or(json!({"error": "ENCODE"})))
        }
        Err(_) => ("500 Internal Server Error", json!({"error": "NOT_READY"})),
    }
}

fn submit(node: &Mutex<LocalNode>, body: &str) -> (&'static str, Value) {
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

fn block_by_height(node: &Mutex<LocalNode>, height: &str) -> (&'static str, Value) {
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

fn tx_lookup(node: &Mutex<LocalNode>, id: &str) -> (&'static str, Value) {
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
