use sunrey_chain_node::run_native_asset_devnet;

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_validator_native_assets_and_equal_roots() {
    let root = std::env::temp_dir().join(format!(
        "sunrey-native-assets-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let report = run_native_asset_devnet(root)
        .await
        .expect("native asset demo");
    assert_eq!(report.validators, 4);
    assert!(report.sunrey_registered);
    assert!(report.moonrey_registered);
    assert_eq!(report.tickers, ["NOT_ASSIGNED", "NOT_ASSIGNED"]);
    assert!(!report.application_supply_imported);
    assert!(report.transfer_ok);
    assert!(report.lock_rejected_overspend);
    assert!(report.unlock_ok);
    assert!(report.burn_ok);
    assert!(report.reconciliation_ok);
    assert!(report.roots_equal);
    assert_eq!(report.sunrey_issued, "100");
    assert_eq!(report.moonrey_issued, "80");
    assert_eq!(report.sunrey_burned, "10");
}
