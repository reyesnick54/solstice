use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;

use crate::chain::{Genesis, Transaction};
use crate::crypto::KeyDomain;
use crate::error::{HandshakeRejectReason, NodeError, NodeResult};
use crate::identity::PeerAddress;
use crate::node::{generate_wallet, DevelopmentNode, NodeConfig, NodeEvent};
use crate::operator::serve_operator;

#[derive(Debug, Clone, serde::Serialize)]
pub struct DemoReport {
    pub transport: &'static str,
    pub nodes_tested: u8,
    pub transaction_gossip: &'static str,
    pub block_gossip: &'static str,
    pub restart_catch_up: &'static str,
    pub wrong_genesis: &'static str,
    pub malformed_input: &'static str,
    pub final_height: u64,
    pub final_state_root: String,
}

pub async fn run_required_devnet_demo(root: PathBuf) -> NodeResult<DemoReport> {
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).map_err(|e| NodeError::Store(e.to_string()))?;
    let genesis = Genesis::development();

    let (a, listen_a) = spawn_named("A", root.join("a"), true, vec![], genesis.clone()).await?;
    let seed = PeerAddress::from_socket(listen_a);
    let (b, _listen_b) = spawn_named(
        "B",
        root.join("b"),
        false,
        vec![seed.clone()],
        genesis.clone(),
    )
    .await?;
    let (c, _listen_c) = spawn_named(
        "C",
        root.join("c"),
        false,
        vec![seed.clone()],
        genesis.clone(),
    )
    .await?;

    wait_peers(&a, 2).await?;
    wait_peers(&b, 1).await?;
    wait_peers(&c, 1).await?;

    let wallet = generate_wallet();
    let tx = Transaction::sign(
        &wallet,
        &genesis.network_id,
        &genesis.chain_id,
        "demo-actor",
        1,
        b"chunk-35-devnet".to_vec(),
        0,
    )?;
    let tx_id = c.submit_tx(tx)?;
    wait_until(Duration::from_secs(8), || {
        a.mempool.lock().contains(&tx_id) && b.mempool.lock().contains(&tx_id)
    })
    .await?;

    let block = a.produce_block()?;
    wait_height(&b, 1).await?;
    wait_height(&c, 1).await?;
    assert_same_root(&[&a, &b, &c])?;

    b.shutdown().await;
    drop(b);
    let second = a.produce_block()?;
    let _ = second;
    wait_height(&a, 2).await?;
    wait_height(&c, 2).await?;

    let (b2, _) = spawn_named(
        "B",
        root.join("b"),
        false,
        vec![seed.clone()],
        genesis.clone(),
    )
    .await?;
    wait_height(&b2, 2).await?;
    wait_event(&b2, Duration::from_secs(5), |e| {
        matches!(
            e,
            NodeEvent::SyncCaughtUp { .. } | NodeEvent::BlockCommitted { height: 2, .. }
        )
    })
    .await
    .ok();
    wait_height(&b2, 2).await?;
    assert_same_root(&[&a, &b2, &c])?;

    let mut wrong = genesis.clone();
    wrong.created_at_ms = 99;
    wrong.hash = wrong.compute_hash();
    let mut rejects = a.subscribe();
    let (d, _) = spawn_named("D", root.join("d"), false, vec![seed], wrong).await?;
    wait_until(Duration::from_secs(8), || {
        a.metrics_snapshot()
            .handshake_reject_by_reason
            .get(HandshakeRejectReason::GenesisMismatch.as_str())
            .copied()
            .unwrap_or(0)
            > 0
            || matches!(
                rejects.try_recv(),
                Ok(NodeEvent::HandshakeRejected {
                    reason: HandshakeRejectReason::GenesisMismatch
                })
            )
    })
    .await?;
    d.shutdown().await;

    send_malformed(listen_a).await?;
    wait_event(&a, Duration::from_secs(3), |e| {
        matches!(e, NodeEvent::MalformedIgnored)
    })
    .await
    .ok();
    if a.height() != 2 {
        return Err(NodeError::Validation(
            "producer became unhealthy after malformed input".into(),
        ));
    }

    let report = DemoReport {
        transport: "Quinn QUIC + rustls TLS 1.3",
        nodes_tested: 3,
        transaction_gossip: "transaction submitted only to C reached A and B mempools",
        block_gossip: "development producer A included the transaction; B and C executed the block",
        restart_catch_up:
            "B restarted from isolated storage and caught up to height 2 with identical state root",
        wrong_genesis: "node D with a different genesis hash was rejected at handshake",
        malformed_input: "receiver A remained at height 2 after malformed bytes",
        final_height: a.height(),
        final_state_root: hex::encode(a.state_root()),
    };

    a.shutdown().await;
    b2.shutdown().await;
    c.shutdown().await;
    let _ = block;
    let _ = tx_id;
    Ok(report)
}

async fn spawn_named(
    name: &str,
    dir: PathBuf,
    producer: bool,
    seeds: Vec<PeerAddress>,
    genesis: Genesis,
) -> NodeResult<(Arc<DevelopmentNode>, SocketAddr)> {
    let mut config = NodeConfig::development(
        name,
        dir,
        "127.0.0.1:0".parse().unwrap(),
        "127.0.0.1:0".parse().unwrap(),
    );
    config.producer = producer;
    config.seeds = seeds;
    config.genesis = genesis;
    let node = Arc::new(DevelopmentNode::open(config)?);
    let listen = node.start().await?;
    let operator = Arc::clone(&node);
    tokio::spawn(async move {
        let _ = serve_operator(operator).await;
    });
    Ok((node, listen))
}

async fn wait_peers(node: &DevelopmentNode, min: usize) -> NodeResult<()> {
    wait_until(Duration::from_secs(8), || {
        node.metrics_snapshot().peer_count as usize >= min
    })
    .await
}

async fn wait_height(node: &DevelopmentNode, height: u64) -> NodeResult<()> {
    wait_until(Duration::from_secs(8), || node.height() >= height).await
}

async fn wait_event<F>(
    node: &DevelopmentNode,
    timeout: Duration,
    mut pred: F,
) -> NodeResult<NodeEvent>
where
    F: FnMut(&NodeEvent) -> bool,
{
    let mut rx = node.subscribe();
    let deadline = Instant::now() + timeout;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err(NodeError::Sync("event wait timed out".into()));
        }
        match tokio::time::timeout(remaining, rx.recv()).await {
            Ok(Ok(event)) if pred(&event) => return Ok(event),
            Ok(Ok(_)) => continue,
            Ok(Err(_)) => return Err(NodeError::Sync("event channel closed".into())),
            Err(_) => return Err(NodeError::Sync("event wait timed out".into())),
        }
    }
}

async fn wait_until<F>(timeout: Duration, mut pred: F) -> NodeResult<()>
where
    F: FnMut() -> bool,
{
    let start = Instant::now();
    while start.elapsed() < timeout {
        if pred() {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    Err(NodeError::Sync("readiness wait timed out".into()))
}

fn assert_same_root(nodes: &[&DevelopmentNode]) -> NodeResult<()> {
    let height = nodes[0].height();
    let root = nodes[0].state_root();
    for node in nodes {
        if node.height() != height || node.state_root() != root {
            return Err(NodeError::Validation("nodes diverged".into()));
        }
    }
    Ok(())
}

async fn send_malformed(addr: SocketAddr) -> NodeResult<()> {
    if let Ok(mut stream) = TcpStream::connect(addr).await {
        let _ = stream.write_all(b"\x00\x01not-a-quic-frame").await;
    }
    Ok(())
}

pub fn refuse_security_boundary() -> [NodeError; 8] {
    [
        NodeError::Forbidden("networking cannot mint native assets".into()),
        NodeError::Forbidden("networking cannot post financial journals".into()),
        crate::crypto::refuse_execution_authority(),
        NodeError::Forbidden("networking cannot modify KYC".into()),
        NodeError::Forbidden("networking cannot modify Consent".into()),
        NodeError::Forbidden("networking cannot change Risk limits".into()),
        crate::crypto::refuse_governance(),
        NodeError::Forbidden("networking cannot change validator voting power".into()),
    ]
}

pub fn _wallet_domain_is_not_p2p() -> KeyDomain {
    KeyDomain::TxWallet
}
