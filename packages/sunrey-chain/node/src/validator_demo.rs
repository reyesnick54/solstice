//! Four independent validator processes over the real development P2P network.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::chain::Transaction;
use crate::consensus::FourValidatorFixture;
use crate::error::{NodeError, NodeResult};
use crate::identity::{PeerAddress, PeerIdentity};
use crate::node::{generate_wallet, ConsensusNodeConfig, DevelopmentNode, NodeConfig, NodeEvent};
use crate::operator::serve_operator;

#[derive(Debug, Clone, serde::Serialize)]
pub struct FourValidatorReport {
    pub validators: u8,
    pub genesis_hash: String,
    pub validator_set_hash: String,
    pub heights: Vec<u64>,
    pub block_ids: Vec<String>,
    pub state_roots: Vec<String>,
    pub commit_rounds: Vec<u32>,
    pub healthy_finality: bool,
}

pub async fn run_four_validator_devnet(root: PathBuf) -> NodeResult<FourValidatorReport> {
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).map_err(|e| NodeError::Store(e.to_string()))?;
    let fixture = FourValidatorFixture::development();

    let (a, listen_a) = spawn_validator("A", root.join("a"), Vec::new(), &fixture).await?;
    let seed = PeerAddress::from_socket(listen_a);
    let (b, _) = spawn_validator("B", root.join("b"), vec![seed.clone()], &fixture).await?;
    let (c, _) = spawn_validator("C", root.join("c"), vec![seed.clone()], &fixture).await?;
    let (d, _) = spawn_validator("D", root.join("d"), vec![seed], &fixture).await?;
    let nodes = [a, b, c, d];

    wait_until(Duration::from_secs(12), || {
        nodes[0].metrics_snapshot().peer_count >= 3
            && nodes[1].metrics_snapshot().peer_count >= 1
            && nodes[2].metrics_snapshot().peer_count >= 1
            && nodes[3].metrics_snapshot().peer_count >= 1
    })
    .await?;

    if nodes
        .iter()
        .any(|n| n.config.genesis.hash != fixture.genesis.hash)
    {
        return Err(NodeError::Validation("genesis mismatch".into()));
    }
    if nodes
        .iter()
        .any(|n| n.validator_set_hash() != fixture.set.hash())
    {
        return Err(NodeError::Validation("validator-set hash mismatch".into()));
    }

    let wallet = generate_wallet();
    let tx = Transaction::sign(
        &wallet,
        &fixture.genesis.network_id,
        &fixture.genesis.chain_id,
        "devnet-actor",
        1,
        b"chunk-38-tx".to_vec(),
        0,
    )?;
    let _ = nodes[3].submit_tx(tx)?;

    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| n.finalized_height() >= 2)
    })
    .await?;
    assert_identical(&nodes, 1)?;
    assert_identical(&nodes, 2)?;

    let report = FourValidatorReport {
        validators: 4,
        genesis_hash: hex::encode(fixture.genesis.hash),
        validator_set_hash: hex::encode(fixture.set.hash()),
        heights: nodes.iter().map(|n| n.finalized_height()).collect(),
        block_ids: nodes
            .iter()
            .map(|n| {
                n.finalized_block(2)
                    .map(|b| hex::encode(b.block_id))
                    .unwrap_or_default()
            })
            .collect(),
        state_roots: nodes
            .iter()
            .map(|n| hex::encode(n.state_root_at_height(2).unwrap_or([0u8; 32])))
            .collect(),
        commit_rounds: nodes
            .iter()
            .map(|n| n.consensus_round_at_commit(2).unwrap_or(0))
            .collect(),
        healthy_finality: true,
    };

    for node in nodes {
        node.shutdown().await;
    }
    Ok(report)
}

async fn spawn_validator(
    name: &str,
    dir: PathBuf,
    seeds: Vec<PeerAddress>,
    fixture: &FourValidatorFixture,
) -> NodeResult<(Arc<DevelopmentNode>, SocketAddr)> {
    std::fs::create_dir_all(&dir).map_err(|e| NodeError::Store(e.to_string()))?;
    let item = fixture.by_name(name);
    PeerIdentity::from_seed(item.p2p_seed).persist(&dir)?;
    let mut config = NodeConfig::development(
        name,
        dir,
        "127.0.0.1:0".parse().unwrap(),
        "127.0.0.1:0".parse().unwrap(),
    );
    config.seeds = seeds;
    config.genesis = fixture.genesis.clone();
    config.consensus = Some(ConsensusNodeConfig {
        validator_name: name.into(),
        consensus_key: item.consensus_key.clone(),
        validator_set: fixture.set.clone(),
        params: fixture.params,
    });
    let node = Arc::new(DevelopmentNode::open(config)?);
    let listen = node.start().await?;
    let operator = Arc::clone(&node);
    tokio::spawn(async move {
        let _ = serve_operator(operator).await;
    });
    Ok((node, listen))
}

fn assert_identical(nodes: &[Arc<DevelopmentNode>; 4], height: u64) -> NodeResult<()> {
    let first = nodes[0]
        .finalized_block(height)
        .ok_or_else(|| NodeError::Validation("missing finalized block".into()))?;
    let cert = nodes[0]
        .commit_certificate(height)
        .ok_or_else(|| NodeError::Validation("missing commit certificate".into()))?;
    for node in nodes {
        let block = node
            .finalized_block(height)
            .ok_or_else(|| NodeError::Validation("peer missing finalized block".into()))?;
        if block.block_id != first.block_id || block.header.state_root != first.header.state_root {
            return Err(NodeError::Validation("finalized blocks diverged".into()));
        }
        let other = node
            .commit_certificate(height)
            .ok_or_else(|| NodeError::Validation("peer missing certificate".into()))?;
        if other.height != cert.height
            || other.block_id != cert.block_id
            || other.state_root != cert.state_root
            || other.validator_set_hash != cert.validator_set_hash
        {
            return Err(NodeError::Validation("commit certificates diverged".into()));
        }
    }
    Ok(())
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
    Err(NodeError::Sync("validator readiness wait timed out".into()))
}

pub fn _watch_finality(event: &NodeEvent) -> bool {
    matches!(event, NodeEvent::ConsensusFinalized { .. })
}
