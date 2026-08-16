use sunrey_crypto::DevEd25519Sha256Suite;
use sunrey_node::LocalNode;
use sunrey_protocol::DomainHasher;
use sunrey_protocol::{
    validate_block_header, BlockHeader, RejectReason, BLOCK_VERSION_V1, LOCAL_DEV_CHAIN_ID,
    LOCAL_DEV_NETWORK_ID,
};

#[test]
fn rejects_invalid_headers() {
    let dir = std::env::temp_dir().join(format!(
        "sunrey-invalid-{}",
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    let node = LocalNode::init(&dir).unwrap();
    let parent = node.genesis_hash;
    let zeros = [0u8; 32];
    let header = BlockHeader {
        version: BLOCK_VERSION_V1,
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        height: 1,
        parent_block_id: parent,
        transaction_root: zeros,
        app_hash: zeros,
        validator_set_hash: zeros,
        consensus_parameter_hash: zeros,
        protocol_version: "1".to_string(),
        module_registry_hash: zeros,
        codec_registry_hash: zeros,
        crypto_policy_hash: zeros,
        timestamp_unix_ms: 1,
        proposer: "DEV_BLOCK_PRODUCER".to_string(),
        crypto_suite_id: "SUNREY_DEV_ED25519_SHA256".to_string(),
    };
    assert_eq!(
        validate_block_header(&header, "other-net", LOCAL_DEV_CHAIN_ID, 1, &parent, &zeros, &zeros),
        Err(RejectReason::WrongNetwork)
    );
    assert_eq!(
        validate_block_header(
            &header,
            LOCAL_DEV_NETWORK_ID,
            "other-chain",
            1,
            &parent,
            &zeros,
            &zeros
        ),
        Err(RejectReason::WrongChain)
    );
    assert_eq!(
        validate_block_header(
            &header,
            LOCAL_DEV_NETWORK_ID,
            LOCAL_DEV_CHAIN_ID,
            2,
            &parent,
            &zeros,
            &zeros
        ),
        Err(RejectReason::IncorrectHeight)
    );
    assert_eq!(
        validate_block_header(
            &header,
            LOCAL_DEV_NETWORK_ID,
            LOCAL_DEV_CHAIN_ID,
            1,
            &zeros,
            &zeros,
            &zeros
        ),
        Err(RejectReason::IncorrectParent)
    );
    let other = DevEd25519Sha256Suite.hash("sunrey.txroot.v1", b"x");
    assert_eq!(
        validate_block_header(
            &header,
            LOCAL_DEV_NETWORK_ID,
            LOCAL_DEV_CHAIN_ID,
            1,
            &parent,
            &other,
            &zeros
        ),
        Err(RejectReason::WrongTransactionRoot)
    );
    assert_eq!(
        validate_block_header(
            &header,
            LOCAL_DEV_NETWORK_ID,
            LOCAL_DEV_CHAIN_ID,
            1,
            &parent,
            &zeros,
            &other
        ),
        Err(RejectReason::WrongStateRoot)
    );
    let mut bad_version = header.clone();
    bad_version.version = 99;
    assert_eq!(
        validate_block_header(
            &bad_version,
            LOCAL_DEV_NETWORK_ID,
            LOCAL_DEV_CHAIN_ID,
            1,
            &parent,
            &zeros,
            &zeros
        ),
        Err(RejectReason::UnsupportedVersion)
    );
}
