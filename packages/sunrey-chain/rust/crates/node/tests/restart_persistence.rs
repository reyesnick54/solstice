//! Wave 2 — crash/restart and canonical persistence integration tests.

use std::time::{SystemTime, UNIX_EPOCH};

use sunrey_crypto::development_fixture_secret;
use sunrey_execution::encode_issue_bytes;
use sunrey_native_assets::{
    AssetQuantity, AuthorityBoundary, IssuanceAuthorization, NativeAssetId, NativeAssetOp,
    NativeAssetPayload, DEVELOPMENT_FAUCET_POLICY, DEV_FAUCET_ISSUER,
};
use sunrey_node::LocalNode;
use sunrey_protocol::{
    encode_system_payload, genesis_hash, SystemPayload, TransactionFamily, UnsignedTransaction,
    LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, RejectReason, SCHEMA_VERSION, SRCB_CODEC_ID,
};
use sunrey_storage::{assert_state_root, rebuild_state_root, ChainStore, FailPoint};

fn temp_dir(label: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let dir = std::env::temp_dir().join(format!("sunrey-restart-{label}-{nanos}"));
    std::fs::create_dir_all(&dir).unwrap();
    dir
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

fn system_tx(node: &LocalNode, nonce: u64, key: &str) -> Vec<u8> {
    let unsigned = UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::System,
        nonce,
        idempotency_key: format!("sys-{key}"),
        payload: encode_system_payload(&SystemPayload {
            op: "SET_OBJECT".to_string(),
            object_key: key.to_string(),
            object_value: b"note".to_vec(),
        }),
    };
    node.sign_dev_tx(unsigned, &development_fixture_secret()).unwrap().encode()
}

struct LifecycleSnapshot {
    app_hash: String,
    alice_available: u128,
    bob_available: u128,
}

fn run_native_lifecycle(dir: &std::path::Path) -> LifecycleSnapshot {
    let mut node = LocalNode::init(dir).unwrap();
    let secret = development_fixture_secret();
    let mut nonce = 0u64;

    node.submit_signed(
        node.sign_dev_tx(
            unsigned(nonce, faucet_bytes(NativeAssetId::SunReyCoin, "alice", 100, "sun-1"), "sun-1"),
            &secret,
        )
        .unwrap(),
    )
    .unwrap();
    node.produce_block().unwrap();
    nonce += 1;

    let xfer = NativeAssetPayload::transfer(
        "alice",
        "bob",
        AssetQuantity::new(NativeAssetId::SunReyCoin, 40).unwrap(),
    );
    node.submit_signed(node.sign_dev_tx(unsigned(nonce, xfer.encode(), "xfer"), &secret).unwrap())
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
    node.submit_signed(node.sign_dev_tx(unsigned(nonce, burn.encode(), "burn"), &secret).unwrap())
        .unwrap();
    node.produce_block().unwrap();

    let assets = node.native_assets().unwrap();
    assets.reconcile_all().unwrap();
    LifecycleSnapshot {
        app_hash: node.status().app_hash,
        alice_available: assets.available("alice", NativeAssetId::SunReyCoin),
        bob_available: assets.available("bob", NativeAssetId::SunReyCoin),
    }
}

#[test]
fn genesis_initialization_and_restart_after_genesis() {
    let dir = temp_dir("genesis");
    let first = LocalNode::init(&dir).unwrap();
    let genesis_root = first.status().app_hash.clone();
    let genesis_hash = first.genesis_hash;
    assert_eq!(first.store.meta.height, 0);
    assert!(!AuthorityBoundary::development().application_supply_imported);

    let reopened = LocalNode::open(&dir).unwrap();
    assert_eq!(reopened.store.meta.height, 0);
    assert_eq!(reopened.status().app_hash, genesis_root);
    assert_eq!(reopened.genesis_hash, genesis_hash);
    reopened.verify_chain().unwrap();
}

#[test]
fn restart_after_transfers_issuance_and_burn_preserves_state_hash() {
    let dir = temp_dir("lifecycle");
    let before = run_native_lifecycle(&dir);

    let reopened = LocalNode::open(&dir).unwrap();
    assert_eq!(reopened.status().app_hash, before.app_hash);
    assert_eq!(reopened.store.meta.height, 3);
    assert_eq!(
        reopened.native_assets().unwrap().available("alice", NativeAssetId::SunReyCoin),
        before.alice_available
    );
    assert_eq!(
        reopened.native_assets().unwrap().available("bob", NativeAssetId::SunReyCoin),
        before.bob_available
    );
    reopened.verify_chain().unwrap();
    assert_state_root(&reopened.store, &reopened.suite).unwrap();
}

#[test]
fn state_hash_preserved_across_multiple_restarts() {
    let dir = temp_dir("multi-restart");
    let before = run_native_lifecycle(&dir);
    for _ in 0..3 {
        let node = LocalNode::open(&dir).unwrap();
        assert_eq!(node.status().app_hash, before.app_hash);
    }
}

#[test]
fn corrupted_block_rejected_on_startup() {
    let dir = temp_dir("corrupt-block");
    let mut node = LocalNode::init(&dir).unwrap();
    node.submit_bytes(&system_tx(&node, 0, "k")).unwrap();
    node.produce_block().unwrap();
    let store = ChainStore::open(&dir).unwrap();
    store.corrupt_for_test("block").unwrap();
    assert!(LocalNode::open(&dir).is_err());
}

#[test]
fn state_mismatch_rejected_on_startup() {
    let dir = temp_dir("state-mismatch");
    run_native_lifecycle(&dir);
    let mut store = ChainStore::open(&dir).unwrap();
    store.meta.app_hash = "00".repeat(32);
    store.persist_state_and_meta().unwrap();
    assert!(matches!(
        LocalNode::open(&dir),
        Err(RejectReason::WrongStateRoot)
    ));
}

#[test]
fn genesis_fingerprint_mismatch_rejected_on_startup() {
    let dir = temp_dir("genesis-mismatch");
    LocalNode::init(&dir).unwrap();
    let store = ChainStore::open(&dir).unwrap();
    let suite = sunrey_crypto::DevEd25519Sha256Suite;
    assert!(matches!(
        store.validate_canonical_startup(&suite, &[9u8; 32]),
        Err(RejectReason::IncompatibleProtocol)
    ));
}

#[test]
fn interrupted_block_commit_leaves_no_partial_canonical_mutation() {
    let dir = temp_dir("interrupt");
    let mut node = LocalNode::init(&dir).unwrap();
    let genesis_root = node.status().app_hash.clone();
    node.submit_bytes(&system_tx(&node, 0, "partial")).unwrap();
    node.set_fail_point(FailPoint::DuringPersistence);
    assert!(node.produce_block().is_err());
    let reopened = LocalNode::open(&dir).unwrap();
    assert_eq!(reopened.store.meta.height, 0);
    assert_eq!(reopened.status().app_hash, genesis_root);
}

#[test]
fn persisted_history_matches_state_commitments() {
    let dir = temp_dir("rebuild");
    let before = run_native_lifecycle(&dir);
    let store = ChainStore::open(&dir).unwrap();
    let suite = sunrey_crypto::DevEd25519Sha256Suite;
    let report = rebuild_state_root(&store, &suite).unwrap();
    assert!(report.matched);
    assert_eq!(report.rebuilt_state_root, before.app_hash);

    for height in 1..=store.meta.height {
        let block = store.load_block(height).unwrap();
        if height == store.meta.height {
            assert_eq!(
                sunrey_protocol::hash_to_hex(&block.header.app_hash),
                store.meta.app_hash
            );
        }
    }

    let reopened = LocalNode::open(&dir).unwrap();
    reopened.verify_chain().unwrap();
}

#[test]
fn genesis_hash_changes_when_consensus_critical_fields_change() {
    let suite = sunrey_crypto::DevEd25519Sha256Suite;
    let schema_hash = sunrey_crypto::schema_registry_hash(&suite);
    let base = sunrey_protocol::local_dev_genesis(schema_hash.to_vec(), "cs".into());
    let base_hash = genesis_hash(&suite, &base);
    let mut other = base.clone();
    other.max_block_txs = base.max_block_txs + 1;
    assert_ne!(genesis_hash(&suite, &other), base_hash);
}
