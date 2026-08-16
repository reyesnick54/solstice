//! Local operator control plane. This is not P2P and never receives
//! validator voting keys.

use std::sync::Arc;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::chain::Transaction;
use crate::error::NodeResult;
use crate::node::DevelopmentNode;

pub async fn serve_operator(node: Arc<DevelopmentNode>) -> NodeResult<()> {
    let listener = TcpListener::bind(node.config.operator_listen)
        .await
        .map_err(|e| crate::error::NodeError::Transport(e.to_string()))?;
    loop {
        tokio::select! {
            _ = node.shutdown.notified() => break,
            accepted = listener.accept() => {
                let Ok((mut stream, _)) = accepted else { continue; };
                let node = Arc::clone(&node);
                tokio::spawn(async move {
                    let mut buf = vec![0u8; 8192];
                    let n = match stream.read(&mut buf).await {
                        Ok(n) => n,
                        Err(_) => return,
                    };
                    let req = String::from_utf8_lossy(&buf[..n]);
                    let (status, body) = handle(&node, &req);
                    let response = format!(
                        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                        body.len()
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                });
            }
        }
    }
    Ok(())
}

fn handle(node: &DevelopmentNode, req: &str) -> (&'static str, String) {
    let line = req.lines().next().unwrap_or("");
    if line.starts_with("GET /ready") {
        return (
            "200 OK",
            serde_json::json!({
                "ready": true,
                "name": node.config.name,
                "node_id": node.node_id().hex(),
                "height": node.height(),
            })
            .to_string(),
        );
    }
    if line.starts_with("GET /status") {
        let metrics = node.metrics_snapshot();
        return (
            "200 OK",
            serde_json::json!({
                "name": node.config.name,
                "node_id": node.node_id().hex(),
                "height": node.height(),
                "finalized_height": node.finalized_height(),
                "state_root": hex::encode(node.state_root()),
                "validator_set_hash": hex::encode(node.validator_set_hash()),
                "metrics": metrics,
                "consensus_metrics": node.consensus_metrics(),
                "forks": node.fork_evidence(),
            })
            .to_string(),
        );
    }
    if line.starts_with("GET /finalized_height") {
        return (
            "200 OK",
            serde_json::json!({ "finalized_height": node.finalized_height() }).to_string(),
        );
    }
    if let Some(height) = query_height(line, "GET /finalized_block") {
        return match node.finalized_block(height) {
            Some(block) => (
                "200 OK",
                serde_json::json!({
                    "height": block.header.height,
                    "block_id": hex::encode(block.block_id),
                    "state_root": hex::encode(block.header.state_root),
                    "committed": true,
                })
                .to_string(),
            ),
            None => (
                "404 Not Found",
                serde_json::json!({"error":"no finalized block"}).to_string(),
            ),
        };
    }
    if let Some(height) = query_height(line, "GET /commit_certificate") {
        return match node.commit_certificate(height) {
            Some(cert) => (
                "200 OK",
                serde_json::json!({
                    "height": cert.height,
                    "round": cert.round,
                    "block_id": hex::encode(cert.block_id),
                    "state_root": hex::encode(cert.state_root),
                    "validator_set_hash": hex::encode(cert.validator_set_hash),
                })
                .to_string(),
            ),
            None => (
                "404 Not Found",
                serde_json::json!({"error":"no commit certificate"}).to_string(),
            ),
        };
    }
    if let Some(height) = query_height(line, "GET /validator_set_at_height") {
        return match node.validator_set_at_height(height) {
            Some(set) => (
                "200 OK",
                serde_json::json!({
                    "epoch": set.epoch,
                    "hash": hex::encode(set.hash()),
                    "total_power": set.total_power(),
                    "validators": set.validators.iter().map(|v| v.name.clone()).collect::<Vec<_>>(),
                })
                .to_string(),
            ),
            None => (
                "404 Not Found",
                serde_json::json!({"error":"no validator set"}).to_string(),
            ),
        };
    }
    if let Some(height) = query_height(line, "GET /consensus_round_at_commit") {
        return (
            "200 OK",
            serde_json::json!({
                "round": node.consensus_round_at_commit(height),
            })
            .to_string(),
        );
    }
    if let Some(height) = query_height(line, "GET /state_root_at_height") {
        return (
            "200 OK",
            serde_json::json!({
                "state_root": node.state_root_at_height(height).map(hex::encode),
            })
            .to_string(),
        );
    }
    if line.starts_with("POST /produce") {
        return match node.produce_block() {
            Ok(block) => (
                "200 OK",
                serde_json::json!({
                    "height": block.header.height,
                    "block_id": hex::encode(block.block_id),
                    "state_root": hex::encode(block.header.state_root),
                })
                .to_string(),
            ),
            Err(err) => (
                "400 Bad Request",
                serde_json::json!({"error": err.to_string()}).to_string(),
            ),
        };
    }
    if line.starts_with("GET /evidence") {
        if line.contains("show") {
            let id = query_param(req, "id").unwrap_or_default();
            return (
                "200 OK",
                serde_json::to_string(&node.evidence_show(&id)).unwrap_or_else(|_| "null".into()),
            );
        }
        return (
            "200 OK",
            serde_json::to_string(&node.evidence_list()).unwrap_or_else(|_| "[]".into()),
        );
    }
    if line.starts_with("GET /validator/offenses") {
        let id = query_param(req, "id").unwrap_or_default();
        return (
            "200 OK",
            serde_json::to_string(&node.validator_offenses(&id)).unwrap_or_else(|_| "[]".into()),
        );
    }
    if line.starts_with("GET /validator/accountability") {
        let id = query_param(req, "id").unwrap_or_default();
        return (
            "200 OK",
            serde_json::to_string(&node.validator_accountability(&id))
                .unwrap_or_else(|_| "{}".into()),
        );
    }
    if line.starts_with("POST /tx") {
        let Some(body) = req.split("\r\n\r\n").nth(1) else {
            return ("400 Bad Request", "{\"error\":\"missing body\"}".into());
        };
        let Ok(bytes) = hex::decode(body.trim()) else {
            return (
                "400 Bad Request",
                "{\"error\":\"tx body must be hex\"}".into(),
            );
        };
        let Ok(tx) = Transaction::decode(&bytes) else {
            return (
                "400 Bad Request",
                "{\"error\":\"invalid transaction\"}".into(),
            );
        };
        return match node.submit_tx(tx) {
            Ok(id) => (
                "200 OK",
                serde_json::json!({"tx_id": hex::encode(id)}).to_string(),
            ),
            Err(err) => (
                "400 Bad Request",
                serde_json::json!({"error": err.to_string()}).to_string(),
            ),
        };
    }
    ("404 Not Found", "{\"error\":\"not found\"}".into())
}

fn query_param(req: &str, key: &str) -> Option<String> {
    let line = req.lines().next()?;
    let start = line.find('?')?;
    let query = line[start + 1..].split_whitespace().next()?;
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if k == key {
                return Some(v.to_string());
            }
        }
    }
    None
}

fn query_height(line: &str, prefix: &str) -> Option<u64> {
    if !line.starts_with(prefix) {
        return None;
    }
    let query = line.split('?').nth(1)?;
    let query = query.split(' ').next()?;
    for part in query.split('&') {
        if let Some(value) = part.strip_prefix("height=") {
            return value.parse().ok();
        }
    }
    None
}
