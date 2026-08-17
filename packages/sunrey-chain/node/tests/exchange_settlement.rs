use sunrey_chain_node::run_exchange_settlement_devnet;

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_validator_exchange_dvp_and_equal_roots() {
    let root = std::env::temp_dir().join(format!(
        "sunrey-exchange-settlement-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let report = run_exchange_settlement_devnet(root)
        .await
        .expect("exchange settlement demo");
    assert_eq!(report.validators, 4);
    assert_eq!(report.market, "SUNREY_COIN/MOONREY_COIN");
    assert_eq!(report.tickers, ["NOT_ASSIGNED", "NOT_ASSIGNED"]);
    assert!(report.deposits_finalized);
    assert!(report.reservations_validated);
    assert!(report.dvp_atomic);
    assert!(report.settlement_finalized);
    assert!(report.failure_rejected_atomically);
    assert!(report.no_partial_movement);
    assert!(report.no_duplicate_settlement);
    assert!(report.ambiguity_resolved_once);
    assert!(report.reconciliation_ok);
    assert!(report.roots_equal);
    assert_eq!(report.alice_sunrey, "10");
    assert_eq!(report.bob_moonrey, "25");
}
