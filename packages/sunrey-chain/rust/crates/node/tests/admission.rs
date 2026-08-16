use sunrey_crypto::development_fixture_secret;
use sunrey_node::LocalNode;
use sunrey_protocol::{
    encode_system_payload, RejectReason, SystemPayload, TransactionFamily, UnsignedTransaction,
    LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, SCHEMA_VERSION, SRCB_CODEC_ID,
};

fn dir() -> std::path::PathBuf {
    let nanos =
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let path = std::env::temp_dir().join(format!("sunrey-admit-{nanos}"));
    std::fs::create_dir_all(&path).unwrap();
    path
}

fn unsigned(
    family: TransactionFamily,
    nonce: u64,
    network: &str,
    chain: &str,
) -> UnsignedTransaction {
    UnsignedTransaction {
        network_id: network.to_string(),
        chain_id: chain.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family,
        nonce,
        idempotency_key: format!("k-{nonce}"),
        payload: encode_system_payload(&SystemPayload {
            op: "SET_OBJECT".to_string(),
            object_key: "k".to_string(),
            object_value: b"v".to_vec(),
        }),
    }
}

#[test]
fn rejects_wrong_network_replay_and_unactivated_family() {
    let mut node = LocalNode::init(dir()).unwrap();
    let secret = development_fixture_secret();
    let wrong_net = node
        .sign_dev_tx(
            unsigned(TransactionFamily::System, 0, "net_other", LOCAL_DEV_CHAIN_ID),
            &secret,
        )
        .unwrap();
    assert_eq!(node.submit_signed(wrong_net).unwrap_err(), RejectReason::WrongNetwork);

    let wrong_chain = node
        .sign_dev_tx(
            unsigned(TransactionFamily::System, 0, LOCAL_DEV_NETWORK_ID, "chn_other"),
            &secret,
        )
        .unwrap();
    assert_eq!(node.submit_signed(wrong_chain).unwrap_err(), RejectReason::WrongChain);

    let identity = node
        .sign_dev_tx(
            unsigned(TransactionFamily::Identity, 0, LOCAL_DEV_NETWORK_ID, LOCAL_DEV_CHAIN_ID),
            &secret,
        )
        .unwrap();
    assert_eq!(node.submit_signed(identity).unwrap_err(), RejectReason::TransactionNotActivated);

    let native_bad = node
        .sign_dev_tx(
            unsigned(TransactionFamily::NativeAsset, 0, LOCAL_DEV_NETWORK_ID, LOCAL_DEV_CHAIN_ID),
            &secret,
        )
        .unwrap();
    assert_eq!(node.submit_signed(native_bad).unwrap_err(), RejectReason::SchemaInvalid);

    let ok = node
        .sign_dev_tx(
            unsigned(TransactionFamily::System, 0, LOCAL_DEV_NETWORK_ID, LOCAL_DEV_CHAIN_ID),
            &secret,
        )
        .unwrap();
    node.submit_signed(ok.clone()).unwrap();
    assert_eq!(node.submit_signed(ok).unwrap_err(), RejectReason::Replay);
}
