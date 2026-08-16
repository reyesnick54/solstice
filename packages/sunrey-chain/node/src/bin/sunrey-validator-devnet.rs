use std::path::PathBuf;

use sunrey_chain_node::run_four_validator_devnet;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let root = PathBuf::from(
        std::env::var("SUNREY_VALIDATOR_DEVNET_DIR")
            .unwrap_or_else(|_| "/tmp/sunrey-validator-devnet".into()),
    );
    match run_four_validator_devnet(root).await {
        Ok(report) => {
            println!("{}", serde_json::to_string_pretty(&report).expect("report"));
        }
        Err(err) => {
            eprintln!("four-validator devnet failed: {err}");
            std::process::exit(1);
        }
    }
}
