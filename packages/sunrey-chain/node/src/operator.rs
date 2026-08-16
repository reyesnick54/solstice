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
                "state_root": hex::encode(node.state_root()),
                "metrics": metrics,
                "forks": node.fork_evidence(),
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
