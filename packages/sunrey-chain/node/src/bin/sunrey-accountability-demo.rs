use std::path::PathBuf;

use sunrey_chain_node::run_accountability_demo;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let root = PathBuf::from(
        std::env::var("SUNREY_ACCOUNTABILITY_DIR")
            .unwrap_or_else(|_| "/tmp/sunrey-accountability".into()),
    );
    match run_accountability_demo(root).await {
        Ok(report) => {
            println!("{}", serde_json::to_string_pretty(&report).expect("report"));
            if !report.jailed
                || !report.replay_rejected
                || !report.false_accusation_rejected
                || !report.honest_validator_unchanged
                || !report.epoch_reflects_jail
                || !report.remaining_can_progress
            {
                eprintln!("accountability demo invariants failed");
                std::process::exit(1);
            }
        }
        Err(err) => {
            eprintln!("accountability demo failed: {err}");
            std::process::exit(1);
        }
    }
}
