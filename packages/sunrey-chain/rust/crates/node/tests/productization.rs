use std::sync::{Arc, Mutex};

use sunrey_crypto::development_fixture_secret;
use sunrey_node::LocalNode;
use sunrey_protocol::{
    encode_system_payload, generate_genesis, observe, FinalitySource, GenesisGenerationInput,
    NetworkEnvironment, RejectReason, SystemPayload, TransactionFamily, TransactionFinality,
    UnsignedTransaction, LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, SCHEMA_VERSION, SRCB_CODEC_ID,
    TESTNET_1_CHAIN_ID, TESTNET_1_NETWORK_ID,
};

fn dir(label: &str) -> std::path::PathBuf {
    let nanos =
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let path = std::env::temp_dir().join(format!("sunrey-node-prod-{label}-{nanos}"));
    std::fs::create_dir_all(&path).unwrap();
    path
}

fn unsigned(nonce: u64, network: &str, chain: &str, key: &str) -> UnsignedTransaction {
    UnsignedTransaction {
        network_id: network.to_string(),
        chain_id: chain.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::System,
        nonce,
        idempotency_key: key.to_string(),
        payload: encode_system_payload(&SystemPayload {
            op: "SET_OBJECT".to_string(),
            object_key: format!("k-{nonce}"),
            object_value: b"v".to_vec(),
        }),
    }
}

#[test]
fn same_tx_old_nonce_and_cross_network_cannot_replay() {
    let mut node = LocalNode::init(dir("replay")).unwrap();
    let secret = development_fixture_secret();
    let first = node
        .sign_dev_tx(unsigned(0, LOCAL_DEV_NETWORK_ID, LOCAL_DEV_CHAIN_ID, "k-0"), &secret)
        .unwrap();
    node.submit_signed(first.clone()).unwrap();
    assert_eq!(node.submit_signed(first).unwrap_err(), RejectReason::Replay);

    let old_nonce = node
        .sign_dev_tx(unsigned(0, LOCAL_DEV_NETWORK_ID, LOCAL_DEV_CHAIN_ID, "k-old"), &secret)
        .unwrap();
    assert_eq!(node.submit_signed(old_nonce).unwrap_err(), RejectReason::Replay);

    let foreign = node
        .sign_dev_tx(unsigned(1, TESTNET_1_NETWORK_ID, TESTNET_1_CHAIN_ID, "k-x"), &secret)
        .unwrap();
    assert_eq!(node.submit_signed(foreign).unwrap_err(), RejectReason::WrongNetwork);
}

#[test]
fn concurrent_same_nonce_admits_only_one() {
    let node = Arc::new(Mutex::new(LocalNode::init(dir("concurrent")).unwrap()));
    let secret = development_fixture_secret();
    let left = node
        .lock()
        .unwrap()
        .sign_dev_tx(unsigned(0, LOCAL_DEV_NETWORK_ID, LOCAL_DEV_CHAIN_ID, "left"), &secret)
        .unwrap();
    let right = node
        .lock()
        .unwrap()
        .sign_dev_tx(unsigned(0, LOCAL_DEV_NETWORK_ID, LOCAL_DEV_CHAIN_ID, "right"), &secret)
        .unwrap();
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
fn local_commit_is_included_not_finalized() {
    let mut node = LocalNode::init(dir("finality")).unwrap();
    let secret = development_fixture_secret();
    let tx = node
        .sign_dev_tx(unsigned(0, LOCAL_DEV_NETWORK_ID, LOCAL_DEV_CHAIN_ID, "fin"), &secret)
        .unwrap();
    let tx_id = node.submit_signed(tx).unwrap();
    let pending = node.observe_transaction(&tx_id);
    assert_eq!(pending.status, TransactionFinality::Pending);
    node.prioritize_queue();
    node.produce_block().unwrap();
    let included = node.observe_transaction(&tx_id);
    assert_eq!(included.status, TransactionFinality::Included);
    assert!(included.local_observation_is_not_finality);
    let finalized = observe(&tx_id, FinalitySource::CommitCertificate, Some(1));
    assert_eq!(finalized.status, TransactionFinality::Finalized);
}

#[test]
fn restart_recovers_queue_and_height() {
    let path = dir("restart");
    let mut node = LocalNode::init(&path).unwrap();
    let secret = development_fixture_secret();
    let tx = node
        .sign_dev_tx(unsigned(0, LOCAL_DEV_NETWORK_ID, LOCAL_DEV_CHAIN_ID, "rst"), &secret)
        .unwrap();
    let tx_id = node.submit_signed(tx).unwrap();
    drop(node);
    let reopened = LocalNode::open(&path).unwrap();
    assert!(reopened.queue_contains(&tx_id));
    assert_eq!(reopened.status().height, 0);
}

#[test]
fn mainnet_genesis_stays_fail_closed() {
    let err = generate_genesis(GenesisGenerationInput {
        environment: NetworkEnvironment::Mainnet,
        schema_registry_hash: vec![1],
        crypto_policy_id: "cs".into(),
        governance_fields_complete: false,
        economic_parameters_approved: false,
        counsel_confirmed: false,
    })
    .unwrap_err();
    assert_eq!(err, RejectReason::GovernanceRejected);
}
