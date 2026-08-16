use std::path::PathBuf;
use std::sync::Arc;

use sunrey_chain_node::chain::Genesis;
use sunrey_chain_node::identity::PeerAddress;
use sunrey_chain_node::node::{DevelopmentNode, NodeConfig};
use sunrey_chain_node::operator::serve_operator;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let args: Vec<String> = std::env::args().skip(1).collect();
    if !args.is_empty() && matches!(args[0].as_str(), "evidence" | "validator") {
        match sunrey_chain_node::cli::run_operator_command(&args) {
            Ok(out) => {
                println!("{out}");
                return;
            }
            Err(err) => {
                eprintln!("{err}");
                std::process::exit(1);
            }
        }
    }

    let name = std::env::var("SUNREY_NODE_NAME").unwrap_or_else(|_| "node".into());
    let data_dir = PathBuf::from(
        std::env::var("SUNREY_DATA_DIR").unwrap_or_else(|_| format!("/tmp/sunrey-{name}")),
    );
    let listen = std::env::var("SUNREY_P2P_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:0".into())
        .parse()
        .expect("SUNREY_P2P_ADDR");
    let operator = std::env::var("SUNREY_OPERATOR_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:0".into())
        .parse()
        .expect("SUNREY_OPERATOR_ADDR");
    let producer = std::env::var("SUNREY_PRODUCER").ok().as_deref() == Some("1");
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
    config.producer = producer;
    config.seeds = seeds;
    config.genesis = if std::env::var("SUNREY_VALIDATOR_GENESIS").ok().as_deref() == Some("four") {
        let (set, _) = sunrey_chain_node::validators::four_validator_devnet();
        Genesis::development().with_validator_set(set)
    } else {
        Genesis::development()
    };

    let node = Arc::new(DevelopmentNode::open(config).expect("open node"));
    let p2p = node.start().await.expect("start p2p");
    println!(
        "node {} listening on {p2p} id={}",
        name,
        node.node_id().hex()
    );
    serve_operator(node).await.expect("operator");
}
