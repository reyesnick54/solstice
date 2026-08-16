use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use sunrey_chain_node::consensus::messages::ConsensusMessage;
use sunrey_chain_node::consensus::{FourValidatorFixture, RejectReason};
use sunrey_chain_node::run_four_validator_devnet;

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_validator_p2p_reaches_identical_finality() {
    let root = PathBuf::from(format!(
        "/tmp/sunrey-bft-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let report = run_four_validator_devnet(root)
        .await
        .expect("four-validator networked finality");
    assert_eq!(report.validators, 4);
    assert!(report.healthy_finality);
    assert!(report.heights.iter().all(|h| *h >= 2));
    assert!(report.block_ids.windows(2).all(|w| w[0] == w[1]));
    assert!(report.state_roots.windows(2).all(|w| w[0] == w[1]));
}

#[test]
fn consensus_messages_are_versioned_binary_not_json() {
    let fixture = FourValidatorFixture::development();
    let msg = ConsensusMessage::RoundStateHint {
        height: 1,
        round: 0,
        step: sunrey_chain_node::consensus::Step::Propose,
    };
    let encoded = msg.encode().expect("encode");
    assert_ne!(encoded.first().copied(), Some(b'{'));
    let decoded = ConsensusMessage::decode(&encoded).expect("decode");
    assert_eq!(decoded, msg);
    assert_eq!(fixture.set.quorum_power(), 3);
    let _ = RejectReason::WrongNetwork;
}
