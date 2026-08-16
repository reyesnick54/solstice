use std::path::PathBuf;

use sunrey_chain_node::run_native_asset_devnet;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let root = PathBuf::from(
        std::env::var("SUNREY_NATIVE_ASSET_DEVNET_DIR")
            .unwrap_or_else(|_| "/tmp/sunrey-native-asset-devnet".into()),
    );
    match run_native_asset_devnet(root).await {
        Ok(report) => {
            println!("{}", serde_json::to_string_pretty(&report).expect("report"));
            if !report.roots_equal || !report.reconciliation_ok || !report.lock_rejected_overspend {
                std::process::exit(1);
            }
        }
        Err(err) => {
            eprintln!("native asset four-validator demo failed: {err}");
            std::process::exit(1);
        }
    }
}
