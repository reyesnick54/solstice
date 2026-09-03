//! Wave 9 — sovereign blockchain adversarial integration tests.
//!
//! Extends Wave 2 coverage with nonce gaps, native-asset double-spend admission,
//! issuance replay after restart, invalid block roots, and mempool flood resilience.

use std::sync::{Arc, Mutex};
use std::time::Instant;

use sunrey_crypto::development_fixture_secret;
use sunrey_execution::encode_issue_bytes;
use sunrey_native_assets::{
    faucet_notice, AssetQuantity, IssuanceAuthorization, NativeAssetId, NativeAssetOp,
    NativeAssetPayload, DEVELOPMENT_FAUCET_POLICY, DEV_FAUCET_ISSUER,
};
use sunrey_node::LocalNode;
use sunrey_protocol::{
    encode_system_payload, RejectReason, SystemPayload, TransactionFamily, UnsignedTransaction,
    LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, SCHEMA_VERSION, SRCB_CODEC_ID,
};

fn dir(label: &str) -> std::path::PathBuf {
    let nanos =
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let path = std::env::temp_dir().join(format!("sunrey-wave9-{label}-{nanos}"));
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
fn nonce_skip_and_stale_nonce_rejected() {
    let mut node = LocalNode::init(dir("nonce")).unwrap();
    let secret = development_fixture_secret();
    let ok = node
        .sign_dev_tx(
            UnsignedTransaction {
                network_id: LOCAL_DEV_NETWORK_ID.to_string(),
                chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
                codec_id: SRCB_CODEC_ID.to_string(),
                schema_version: SCHEMA_VERSION,
                family: TransactionFamily::System,
                nonce: 0,
                idempotency_key: "n0".to_string(),
                payload: encode_system_payload(&SystemPayload {
                    op: "SET_OBJECT".to_string(),
                    object_key: "k0".to_string(),
                    object_value: b"v".to_vec(),
                }),
            },
            &secret,
        )
        .unwrap();
    node.submit_signed(ok).unwrap();
    node.produce_block().unwrap();

    let skip = node
        .sign_dev_tx(
            UnsignedTransaction {
                network_id: LOCAL_DEV_NETWORK_ID.to_string(),
                chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
                codec_id: SRCB_CODEC_ID.to_string(),
                schema_version: SCHEMA_VERSION,
                family: TransactionFamily::System,
                nonce: 2,
                idempotency_key: "n2".to_string(),
                payload: encode_system_payload(&SystemPayload {
                    op: "SET_OBJECT".to_string(),
                    object_key: "k2".to_string(),
                    object_value: b"v".to_vec(),
                }),
            },
            &secret,
        )
        .unwrap();
    assert_eq!(node.submit_signed(skip).unwrap_err(), RejectReason::Replay);

    let stale = node
        .sign_dev_tx(
            UnsignedTransaction {
                network_id: LOCAL_DEV_NETWORK_ID.to_string(),
                chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
                codec_id: SRCB_CODEC_ID.to_string(),
                schema_version: SCHEMA_VERSION,
                family: TransactionFamily::System,
                nonce: 0,
                idempotency_key: "n0b".to_string(),
                payload: encode_system_payload(&SystemPayload {
                    op: "SET_OBJECT".to_string(),
                    object_key: "k0b".to_string(),
                    object_value: b"v".to_vec(),
                }),
            },
            &secret,
        )
        .unwrap();
    assert_eq!(node.submit_signed(stale).unwrap_err(), RejectReason::Replay);
}

#[test]
fn native_asset_conflicting_same_nonce_admits_only_one() {
    let node = Arc::new(Mutex::new(LocalNode::init(dir("native-ds")).unwrap()));
    let secret = development_fixture_secret();
    let issue = {
        let mut guard = node.lock().unwrap();
        let tx = guard
            .sign_dev_tx(
                unsigned(0, faucet_bytes(NativeAssetId::SunReyCoin, "alice", 100, "w9-sun"), "iss"),
                &secret,
            )
            .unwrap();
        guard.submit_signed(tx).unwrap();
        guard.produce_block().unwrap();
        guard.native_assets().unwrap().available("alice", NativeAssetId::SunReyCoin)
    };
    assert_eq!(issue, 100);

    let left = {
        let guard = node.lock().unwrap();
        let xfer = NativeAssetPayload::transfer(
            "alice",
            "bob",
            AssetQuantity::new(NativeAssetId::SunReyCoin, 40).unwrap(),
        );
        guard.sign_dev_tx(unsigned(1, xfer.encode(), "left"), &secret).unwrap()
    };
    let right = {
        let guard = node.lock().unwrap();
        let xfer = NativeAssetPayload::transfer(
            "alice",
            "carol",
            AssetQuantity::new(NativeAssetId::SunReyCoin, 40).unwrap(),
        );
        guard.sign_dev_tx(unsigned(1, xfer.encode(), "right"), &secret).unwrap()
    };
    let a = {
        let node = Arc::clone(&node);
        std::thread::spawn(move || node.lock().unwrap().submit_signed(left))
    };
    let b = {
        let node = Arc::clone(&node);
        std::thread::spawn(move || node.lock().unwrap().submit_signed(right))
    };
    let results = [a.join().unwrap(), b.join().unwrap()];
    let ok = results.iter().filter(|row| row.is_ok()).count();
    let replay =
        results.iter().filter(|row| row.as_ref().err() == Some(&RejectReason::Replay)).count();
    assert_eq!(ok, 1);
    assert_eq!(replay, 1);
}

#[test]
fn issuance_transaction_replay_rejected_after_restart() {
    let path = dir("issuance-restart");
    let mut node = LocalNode::init(&path).unwrap();
    let secret = development_fixture_secret();
    let issue = node
        .sign_dev_tx(
            unsigned(0, faucet_bytes(NativeAssetId::MoonReyCoin, "alice", 50, "w9-moon"), "moon"),
            &secret,
        )
        .unwrap();
    node.submit_signed(issue.clone()).unwrap();
    node.produce_block().unwrap();
    drop(node);

    let mut reopened = LocalNode::open(&path).unwrap();
    assert_eq!(reopened.submit_signed(issue).unwrap_err(), RejectReason::Replay);
    assert!(faucet_notice()["production_networks"].as_str().unwrap().contains("forbidden"));
}

#[test]
fn duplicate_issuance_authorization_rejected_at_block_apply() {
    let mut node = LocalNode::init(dir("iss-auth")).unwrap();
    let secret = development_fixture_secret();
    let first = node
        .sign_dev_tx(
            unsigned(0, faucet_bytes(NativeAssetId::SunReyCoin, "alice", 25, "w9-dup"), "a1"),
            &secret,
        )
        .unwrap();
    node.submit_signed(first).unwrap();
    node.produce_block().unwrap();
    let supply_after_first = node.native_assets().unwrap().supply(NativeAssetId::SunReyCoin);
    let second = node
        .sign_dev_tx(
            unsigned(1, faucet_bytes(NativeAssetId::SunReyCoin, "bob", 25, "w9-dup"), "a2"),
            &secret,
        )
        .unwrap();
    node.submit_signed(second).unwrap();
    node.produce_block().unwrap();
    let supply_after_second = node.native_assets().unwrap().supply(NativeAssetId::SunReyCoin);
    assert_eq!(supply_after_first, supply_after_second);
    assert_eq!(node.native_assets().unwrap().available("bob", NativeAssetId::SunReyCoin), 0);
}

#[test]
fn moonrey_transfer_requires_moonrey_balance_not_sunrey() {
    let mut node = LocalNode::init(dir("asset-iso")).unwrap();
    let secret = development_fixture_secret();
    node.submit_signed(
        node.sign_dev_tx(
            unsigned(0, faucet_bytes(NativeAssetId::SunReyCoin, "alice", 50, "w9-sun"), "sun"),
            &secret,
        )
        .unwrap(),
    )
    .unwrap();
    node.produce_block().unwrap();
    let moon_before = node.native_assets().unwrap().available("alice", NativeAssetId::MoonReyCoin);
    let moon_xfer = NativeAssetPayload::transfer(
        "alice",
        "bob",
        AssetQuantity::new(NativeAssetId::MoonReyCoin, 10).unwrap(),
    );
    node.submit_signed(
        node.sign_dev_tx(unsigned(1, moon_xfer.encode(), "moon-x"), &secret).unwrap(),
    )
    .unwrap();
    node.produce_block().unwrap();
    assert_eq!(
        node.native_assets().unwrap().available("alice", NativeAssetId::MoonReyCoin),
        moon_before
    );
    assert_eq!(node.native_assets().unwrap().available("bob", NativeAssetId::MoonReyCoin), 0);
}

#[test]
fn invalid_transaction_flood_stays_rejected_without_panic() {
    let mut node = LocalNode::init(dir("flood")).unwrap();
    let secret = development_fixture_secret();
    let start = Instant::now();
    let mut rejected = 0u32;
    for i in 0..200u64 {
        let mut bad = node
            .sign_dev_tx(
                UnsignedTransaction {
                    network_id: "net_wrong".to_string(),
                    chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
                    codec_id: SRCB_CODEC_ID.to_string(),
                    schema_version: SCHEMA_VERSION,
                    family: TransactionFamily::System,
                    nonce: i,
                    idempotency_key: format!("bad-{i}"),
                    payload: encode_system_payload(&SystemPayload {
                        op: "SET_OBJECT".to_string(),
                        object_key: format!("k-{i}"),
                        object_value: b"x".to_vec(),
                    }),
                },
                &secret,
            )
            .unwrap();
        bad.auth[0].signature[0] ^= 0xff;
        if node.submit_signed(bad).is_err() {
            rejected += 1;
        }
    }
    let elapsed = start.elapsed();
    assert_eq!(rejected, 200);
    assert!(elapsed.as_secs() < 30);
    assert!(node.status().height == 0);
}
