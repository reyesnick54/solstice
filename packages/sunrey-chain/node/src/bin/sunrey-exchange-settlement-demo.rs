use std::path::PathBuf;

use sunrey_chain_node::run_exchange_settlement_devnet;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let root = PathBuf::from(
        std::env::var("SUNREY_EXCHANGE_SETTLEMENT_DEVNET_DIR")
            .unwrap_or_else(|_| "/tmp/sunrey-exchange-settlement-devnet".into()),
    );
    match run_exchange_settlement_devnet(root).await {
        Ok(report) => {
            println!("{}", serde_json::to_string_pretty(&report).expect("report"));
            if !report.roots_equal
                || !report.dvp_atomic
                || !report.settlement_finalized
                || !report.failure_rejected_atomically
                || !report.no_duplicate_settlement
                || !report.reconciliation_ok
            {
                std::process::exit(1);
            }
        }
        Err(err) => {
            eprintln!("exchange settlement four-validator demo failed: {err}");
            std::process::exit(1);
        }
    }
}
