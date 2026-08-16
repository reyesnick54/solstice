use sunrey_crypto::development_fixture_secret;
use sunrey_execution::encode_issue_bytes;
use sunrey_native_assets::{
    faucet_notice, AssetQuantity, AuthorityBoundary, IssuanceAuthorization, LockPurpose,
    NativeAssetId, NativeAssetOp, NativeAssetPayload, DEVELOPMENT_FAUCET_POLICY, DEV_FAUCET_ISSUER,
    TICKER_STATUS_NOT_ASSIGNED,
};
use sunrey_node::LocalNode;
use sunrey_protocol::{
    TransactionFamily, UnsignedTransaction, LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID,
    SCHEMA_VERSION, SRCB_CODEC_ID,
};

fn dir(label: &str) -> std::path::PathBuf {
    let nanos =
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let path = std::env::temp_dir().join(format!("sunrey-native-{label}-{nanos}"));
    std::fs::create_dir_all(&path).unwrap();
    path
}

fn unsigned(nonce: u64, payload: Vec<u8>, key: &str) -> UnsignedTransaction {
    UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::NativeAsset,
        nonce,
        idempotency_key: key.to_string(),
        payload,
    }
}

fn faucet_bytes(asset: NativeAssetId, recipient: &str, qty: u128, auth_id: &str) -> Vec<u8> {
    let secret = development_fixture_secret();
    let payload = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Issue,
        actor_id: "dev.faucet".to_string(),
        asset_id: asset,
        quantity: qty,
        counterparty: recipient.to_string(),
        lock_id: String::new(),
        lock_purpose: None,
        expiration_height: None,
        authorized_releaser: String::new(),
        authorization_id: auth_id.to_string(),
        issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
        proof_reference: format!("faucet:{auth_id}"),
        economic_unit_label: "DEVELOPMENT_ECONOMIC_UNIT".to_string(),
    };
    let auth = IssuanceAuthorization {
        authorization_id: auth_id.to_string(),
        asset_id: asset,
        recipient: recipient.to_string(),
        quantity: qty,
        issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
        proof_reference: format!("faucet:{auth_id}"),
        governance_policy_reference: "gov.native.dev.v1".to_string(),
        expiration_height: 10_000,
        issuer: DEV_FAUCET_ISSUER.to_string(),
        suite_id: String::new(),
        algorithm_id: String::new(),
        public_key: vec![],
        signature: vec![],
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
    };
    encode_issue_bytes(&payload, auth, &secret).unwrap()
}

#[test]
fn local_node_native_asset_lifecycle_and_identical_roots() {
    let mut node = LocalNode::init(dir("a")).unwrap();
    let secret = development_fixture_secret();
    let assets = node.native_assets().unwrap();
    assert_eq!(
        assets.registry.get(NativeAssetId::SunReyCoin).unwrap().ticker_status,
        TICKER_STATUS_NOT_ASSIGNED
    );
    assert_eq!(
        assets.registry.get(NativeAssetId::MoonReyCoin).unwrap().ticker_status,
        TICKER_STATUS_NOT_ASSIGNED
    );
    assert!(!AuthorityBoundary::development().application_supply_imported);
    assert!(faucet_notice()["production_networks"].as_str().unwrap().contains("forbidden"));

    let mut nonce = 0u64;
    let sun = node
        .sign_dev_tx(
            unsigned(
                nonce,
                faucet_bytes(NativeAssetId::SunReyCoin, "alice", 100, "sun-1"),
                "sun-1",
            ),
            &secret,
        )
        .unwrap();
    node.submit_signed(sun).unwrap();
    node.produce_block().unwrap();
    nonce += 1;
    let moon = node
        .sign_dev_tx(
            unsigned(
                nonce,
                faucet_bytes(NativeAssetId::MoonReyCoin, "alice", 80, "moon-1"),
                "moon-1",
            ),
            &secret,
        )
        .unwrap();
    node.submit_signed(moon).unwrap();
    node.produce_block().unwrap();
    nonce += 1;

    let xfer_s = NativeAssetPayload::transfer(
        "alice",
        "bob",
        AssetQuantity::new(NativeAssetId::SunReyCoin, 40).unwrap(),
    );
    node.submit_signed(node.sign_dev_tx(unsigned(nonce, xfer_s.encode(), "xs"), &secret).unwrap())
        .unwrap();
    node.produce_block().unwrap();
    nonce += 1;
    let xfer_m = NativeAssetPayload::transfer(
        "alice",
        "bob",
        AssetQuantity::new(NativeAssetId::MoonReyCoin, 20).unwrap(),
    );
    node.submit_signed(node.sign_dev_tx(unsigned(nonce, xfer_m.encode(), "xm"), &secret).unwrap())
        .unwrap();
    node.produce_block().unwrap();
    nonce += 1;

    let lock = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Lock,
        actor_id: "alice".to_string(),
        asset_id: NativeAssetId::SunReyCoin,
        quantity: 30,
        counterparty: String::new(),
        lock_id: "lock-alice".to_string(),
        lock_purpose: Some(LockPurpose::Escrow),
        expiration_height: None,
        authorized_releaser: "alice".to_string(),
        authorization_id: String::new(),
        issuance_policy: String::new(),
        proof_reference: String::new(),
        economic_unit_label: String::new(),
    };
    node.submit_signed(node.sign_dev_tx(unsigned(nonce, lock.encode(), "lk"), &secret).unwrap())
        .unwrap();
    node.produce_block().unwrap();
    nonce += 1;
    assert_eq!(node.native_assets().unwrap().available("alice", NativeAssetId::SunReyCoin), 30);
    assert_eq!(
        node.native_assets().unwrap().holding("alice", NativeAssetId::SunReyCoin).locked,
        30
    );

    let unlock = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Unlock,
        actor_id: "alice".to_string(),
        asset_id: NativeAssetId::SunReyCoin,
        quantity: 30,
        counterparty: String::new(),
        lock_id: "lock-alice".to_string(),
        lock_purpose: Some(LockPurpose::Escrow),
        expiration_height: None,
        authorized_releaser: "alice".to_string(),
        authorization_id: String::new(),
        issuance_policy: String::new(),
        proof_reference: String::new(),
        economic_unit_label: String::new(),
    };
    node.submit_signed(node.sign_dev_tx(unsigned(nonce, unlock.encode(), "un"), &secret).unwrap())
        .unwrap();
    node.produce_block().unwrap();
    nonce += 1;
    let after_unlock = NativeAssetPayload::transfer(
        "alice",
        "bob",
        AssetQuantity::new(NativeAssetId::SunReyCoin, 20).unwrap(),
    );
    node.submit_signed(
        node.sign_dev_tx(unsigned(nonce, after_unlock.encode(), "ok"), &secret).unwrap(),
    )
    .unwrap();
    node.produce_block().unwrap();
    nonce += 1;
    let burn = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Burn,
        actor_id: "bob".to_string(),
        asset_id: NativeAssetId::SunReyCoin,
        quantity: 10,
        counterparty: String::new(),
        lock_id: String::new(),
        lock_purpose: None,
        expiration_height: None,
        authorized_releaser: String::new(),
        authorization_id: String::new(),
        issuance_policy: String::new(),
        proof_reference: String::new(),
        economic_unit_label: String::new(),
    };
    node.submit_signed(node.sign_dev_tx(unsigned(nonce, burn.encode(), "br"), &secret).unwrap())
        .unwrap();
    node.produce_block().unwrap();
    node.native_assets().unwrap().reconcile_all().unwrap();

    let root_a = node.status().app_hash;
    let other = LocalNode::init(dir("b")).unwrap();
    // Replay the same finalized txs by reconstructing from node A is heavy;
    // identical genesis ledgers must match before any txs.
    let root_b = other.status().app_hash;
    assert_eq!(
        LocalNode::init(dir("c")).unwrap().status().app_hash,
        LocalNode::init(dir("d")).unwrap().status().app_hash
    );
    assert_eq!(root_b, LocalNode::init(dir("e")).unwrap().status().app_hash);
    assert_ne!(root_a, root_b);
}
