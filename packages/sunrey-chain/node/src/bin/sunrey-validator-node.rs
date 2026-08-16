//! One validator process for the four-validator development network.

use std::path::PathBuf;
use std::sync::Arc;

use sunrey_chain_node::consensus::FourValidatorFixture;
use sunrey_chain_node::identity::{PeerAddress, PeerIdentity};
use sunrey_chain_node::node::{ConsensusNodeConfig, DevelopmentNode, NodeConfig};
use sunrey_chain_node::operator::serve_operator;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let name = std::env::var("SUNREY_VALIDATOR_NAME").unwrap_or_else(|_| "A".into());
    let fixture = FourValidatorFixture::development();
    let item = fixture.by_name(&name);
    let data_dir = PathBuf::from(
        std::env::var("SUNREY_DATA_DIR")
            .unwrap_or_else(|_| format!("/tmp/sunrey-validator-{name}")),
    );
    std::fs::create_dir_all(&data_dir).expect("data dir");
    PeerIdentity::from_seed(item.p2p_seed)
        .persist(&data_dir)
        .expect("p2p identity");

    let listen = std::env::var("SUNREY_P2P_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:0".into())
        .parse()
        .expect("SUNREY_P2P_ADDR");
    let operator = std::env::var("SUNREY_OPERATOR_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:0".into())
        .parse()
        .expect("SUNREY_OPERATOR_ADDR");
    let seeds = std::env::var("SUNREY_SEEDS")
        .ok()
        .map(|raw| {
            raw.split(',')
                .filter_map(|item| {
                    let (host, port) = item.split_once(':')?;
                    Some(PeerAddress {
                        host: host.to_string(),
                        port: port.parse().ok()?,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let mut config = NodeConfig::development(&name, data_dir, listen, operator);
    config.seeds = seeds;
    config.genesis = fixture.genesis.clone();
    config.consensus = Some(ConsensusNodeConfig {
        validator_name: name.clone(),
        consensus_key: item.consensus_key.clone(),
        validator_set: fixture.set.clone(),
        params: fixture.params,
    });

    let node = Arc::new(DevelopmentNode::open(config).expect("open validator"));
    let p2p = node.start().await.expect("start p2p");
    println!(
        "validator {name} listening on {p2p} id={} set={}",
        node.node_id().hex(),
        hex::encode(node.validator_set_hash())
    );
    serve_operator(node).await.expect("operator");
}
