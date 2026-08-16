use std::path::PathBuf;

use sunrey_chain_node::run_required_devnet_demo;

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn three_node_gossip_sync_restart_and_wrong_genesis() {
    let root = PathBuf::from(format!(
        "/tmp/sunrey-devnet-test-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let report = run_required_devnet_demo(root).await.expect("required demo");
    assert_eq!(report.nodes_tested, 3);
    assert_eq!(report.final_height, 2);
    assert!(!report.final_state_root.is_empty());
}
