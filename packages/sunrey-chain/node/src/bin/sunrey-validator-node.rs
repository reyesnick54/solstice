//! One validator process for the SunRey development or Testnet-1 network.
//!
//! Testnet-1 uses the deterministic seven-validator fixture. These keys are
//! simulation/testnet-only and must never be reused for mainnet.

use std::path::PathBuf;
use std::sync::Arc;

use sunrey_chain_node::chain::TESTNET_1_NETWORK_ID;
use sunrey_chain_node::consensus::{FourValidatorFixture, SevenValidatorFixture};
use sunrey_chain_node::identity::{PeerAddress, PeerIdentity};
use sunrey_chain_node::node::{ConsensusNodeConfig, DevelopmentNode, NodeConfig};
use sunrey_chain_node::operator::serve_operator;

const TESTNET_NAMES: [&str; 7] = ["A", "B", "C", "D", "E", "F", "G"];

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let network_id = std::env::var("SUNREY_NETWORK_ID").unwrap_or_else(|_| "net_sunrey_dev".into());
    let name = validator_name();

    let (genesis, validator_set, params, consensus_key, p2p_seed) =
        if network_id == TESTNET_1_NETWORK_ID {
            let fixture = SevenValidatorFixture::testnet();
            let item = fixture
                .validators
                .iter()
                .find(|validator| validator.name == name)
                .unwrap_or_else(|| panic!("validator {name} is not in SunRey Testnet-1"));
            (
                fixture.genesis.clone(),
                fixture.set.clone(),
                fixture.params,
                item.consensus_key.clone(),
                item.p2p_seed,
            )
        } else {
            let fixture = FourValidatorFixture::development();
            let item = fixture.by_name(&name);
            (
                fixture.genesis.clone(),
                fixture.set.clone(),
                fixture.params,
                item.consensus_key.clone(),
                item.p2p_seed,
            )
        };

    if let Ok(expected_chain_id) = std::env::var("SUNREY_CHAIN_ID") {
        assert_eq!(
            expected_chain_id, genesis.chain_id,
            "SUNREY_CHAIN_ID does not match selected genesis"
        );
    }

    let data_dir = PathBuf::from(
        std::env::var("SUNREY_DATA_DIR")
            .unwrap_or_else(|_| format!("/tmp/sunrey-validator-{name}")),
    );
    std::fs::create_dir_all(&data_dir).expect("data dir");
    PeerIdentity::from_seed(p2p_seed)
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
    let hostname = std::env::var("HOSTNAME").ok();
    let seeds = resolve_seeds(std::env::var("SUNREY_SEEDS").ok(), hostname.as_deref()).await;

    let mut config = NodeConfig::development(&name, data_dir, listen, operator);
    config.seeds = seeds;
    config.genesis = genesis;
    config.consensus = Some(ConsensusNodeConfig {
        validator_name: name.clone(),
        consensus_key,
        validator_set,
        params,
    });

    let node = Arc::new(DevelopmentNode::open(config).expect("open validator"));
    let p2p = node.start().await.expect("start p2p");
    println!(
        "validator {name} network={} chain={} listening on {p2p} id={} set={}",
        node.config.genesis.network_id,
        node.config.genesis.chain_id,
        node.node_id().hex(),
        hex::encode(node.validator_set_hash())
    );
    serve_operator(node).await.expect("operator");
}

fn validator_name() -> String {
    if let Ok(name) = std::env::var("SUNREY_VALIDATOR_NAME") {
        return name;
    }
    if let Ok(hostname) = std::env::var("HOSTNAME") {
        if let Some(ordinal) = hostname
            .strip_prefix("sunrey-validator-")
            .and_then(|value| value.parse::<usize>().ok())
        {
            if let Some(name) = TESTNET_NAMES.get(ordinal) {
                return (*name).into();
            }
        }
    }
    "A".into()
}

async fn resolve_seeds(raw: Option<String>, own_hostname: Option<&str>) -> Vec<PeerAddress> {
    let Some(raw) = raw else {
        return Vec::new();
    };
    let mut seeds = Vec::new();
    for item in raw.split(',').map(str::trim).filter(|item| !item.is_empty()) {
        let Some((host, port_raw)) = item.rsplit_once(':') else {
            continue;
        };
        if own_hostname.is_some_and(|own| host.split('.').next() == Some(own)) {
            continue;
        }
        let Ok(port) = port_raw.parse::<u16>() else {
            continue;
        };
        if let Ok(ip) = host.parse::<std::net::IpAddr>() {
            seeds.push(PeerAddress {
                host: ip.to_string(),
                port,
            });
            continue;
        }
        match tokio::net::lookup_host((host, port)).await {
            Ok(addresses) => {
                if let Some(address) = addresses.into_iter().next() {
                    seeds.push(PeerAddress {
                        host: address.ip().to_string(),
                        port: address.port(),
                    });
                }
            }
            Err(error) => {
                tracing::warn!(seed = item, %error, "seed DNS is not ready yet; later peer discovery may retry other seeds");
            }
        }
    }
    seeds
}
