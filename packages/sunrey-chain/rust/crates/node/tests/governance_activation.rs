use std::time::{SystemTime, UNIX_EPOCH};

use sunrey_governance::{ConsensusParams, VoteChoice};
use sunrey_node::LocalNode;
use sunrey_protocol::hash_to_hex;

fn temp_dir(label: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let dir = std::env::temp_dir().join(format!("sunrey-gov-{label}-{nanos}"));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn produced_headers_change_parameter_hash_exactly_at_h() {
    let dir = temp_dir("activate");
    let mut node = LocalNode::init(&dir).unwrap();
    let mut params = ConsensusParams::development();
    params.max_transactions = 64;
    let plan = node.governance.draft_parameter_change("upg_node_h5", 5, params).unwrap();
    node.governance.propose(plan, "gov_operator_1").unwrap();
    node.governance.validate("upg_node_h5").unwrap();
    for voter in ["gov_validator_1", "gov_validator_2", "gov_validator_3"] {
        node.governance.vote("upg_node_h5", voter, VoteChoice::Approve).unwrap();
    }
    node.governance.schedule("upg_node_h5", "gov_operator_1").unwrap();
    node.governance.persist(&dir).unwrap();

    let mut hashes = Vec::new();
    for _ in 0..6 {
        let result = node.produce_block().unwrap();
        let stored = node.store.load_block(result.height).unwrap();
        hashes.push((
            stored.header.height,
            stored.header.protocol_version.clone(),
            hash_to_hex(&stored.header.consensus_parameter_hash),
        ));
    }
    assert_eq!(hashes[0].0, 1);
    assert_eq!(hashes[3].0, 4);
    assert_eq!(hashes[0].2, hashes[3].2);
    assert_eq!(hashes[4].0, 5);
    assert_ne!(hashes[4].2, hashes[3].2);
    assert_eq!(hashes[5].2, hashes[4].2);
    assert_eq!(node.governance.params.max_transactions, 64);
}
