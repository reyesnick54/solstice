use std::time::{SystemTime, UNIX_EPOCH};

use sunrey_crypto::development_fixture_secret;
use sunrey_node::LocalNode;
use sunrey_protocol::{
    encode_system_payload, SystemPayload, TransactionFamily, UnsignedTransaction,
    LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, SCHEMA_VERSION, SRCB_CODEC_ID,
};
use sunrey_storage::FailPoint;

fn temp_dir(label: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let dir = std::env::temp_dir().join(format!("sunrey-{label}-{nanos}"));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn demo_tx(node: &LocalNode) -> Vec<u8> {
    let unsigned = UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::System,
        nonce: 0,
        idempotency_key: "atomic-1".to_string(),
        payload: encode_system_payload(&SystemPayload {
            op: "SET_OBJECT".to_string(),
            object_key: "atomic".to_string(),
            object_value: b"value".to_vec(),
        }),
    };
    node.sign_dev_tx(unsigned, &development_fixture_secret()).unwrap().encode()
}

fn assert_no_effect(point: FailPoint) {
    let dir = temp_dir(&format!("{point:?}"));
    let mut node = LocalNode::init(&dir).unwrap();
    let genesis_hash = node.status().app_hash.clone();
    node.submit_bytes(&demo_tx(&node)).unwrap();
    node.set_fail_point(point);
    assert!(node.produce_block().is_err());
    let reopened = LocalNode::open(&dir).unwrap();
    assert_eq!(reopened.store.meta.height, 0);
    assert_eq!(reopened.status().app_hash, genesis_hash);
}

#[test]
fn failure_before_execution_has_no_canonical_effect() {
    assert_no_effect(FailPoint::BeforeExecution);
}

#[test]
fn failure_during_execution_has_no_canonical_effect() {
    assert_no_effect(FailPoint::DuringExecution);
}

#[test]
fn failure_before_database_commit_has_no_canonical_effect() {
    assert_no_effect(FailPoint::BeforeDatabaseCommit);
}

#[test]
fn failure_during_persistence_has_no_canonical_effect() {
    assert_no_effect(FailPoint::DuringPersistence);
}

#[test]
fn failure_after_commit_keeps_canonical_state() {
    let dir = temp_dir("after-commit");
    let mut node = LocalNode::init(&dir).unwrap();
    node.submit_bytes(&demo_tx(&node)).unwrap();
    node.set_fail_point(FailPoint::AfterCommitBeforeResponse);
    assert!(node.produce_block().is_err());
    let reopened = LocalNode::open(&dir).unwrap();
    assert_eq!(reopened.store.meta.height, 1);
}
