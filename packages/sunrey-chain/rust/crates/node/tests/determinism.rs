use std::time::{SystemTime, UNIX_EPOCH};

use sunrey_crypto::development_fixture_secret;
use sunrey_node::LocalNode;
use sunrey_protocol::{
    encode_system_payload, SystemPayload, TransactionFamily, UnsignedTransaction,
    LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, SCHEMA_VERSION, SRCB_CODEC_ID,
};

fn temp_dir(label: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let dir = std::env::temp_dir().join(format!("sunrey-{label}-{nanos}"));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn system_tx(node: &LocalNode, nonce: u64, key: &str, value: &[u8]) -> Vec<u8> {
    let unsigned = UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::System,
        nonce,
        idempotency_key: format!("idem-{key}"),
        payload: encode_system_payload(&SystemPayload {
            op: "SET_OBJECT".to_string(),
            object_key: key.to_string(),
            object_value: value.to_vec(),
        }),
    };
    node.sign_dev_tx(unsigned, &development_fixture_secret()).unwrap().encode()
}

#[test]
fn two_independent_nodes_match_commitments() {
    let a_dir = temp_dir("a");
    let b_dir = temp_dir("b");
    let mut a = LocalNode::init(&a_dir).unwrap();
    let mut b = LocalNode::init(&b_dir).unwrap();
    assert_eq!(a.genesis_hash, b.genesis_hash);
    let tx = system_tx(&a, 0, "alpha", b"one");
    let id_a = a.submit_bytes(&tx).unwrap();
    let id_b = b.submit_bytes(&tx).unwrap();
    assert_eq!(id_a, id_b);
    let ra = a.produce_block().unwrap();
    let rb = b.produce_block().unwrap();
    assert_eq!(ra.block_id, rb.block_id);
    assert_eq!(ra.transaction_root, rb.transaction_root);
    assert_eq!(ra.app_hash, rb.app_hash);
    assert_eq!(ra.tx_ids, rb.tx_ids);
    assert_eq!(a.store.view, b.store.view);
}
