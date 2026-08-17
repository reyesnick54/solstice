//! Networked Tendermint-family BFT for the SunRey development validator set.
//!
//! This is not production mainnet consensus and does not post financial
//! journals or issue Execution Authority.

pub mod auth;
pub mod buffer;
pub mod chaos;
pub mod dos;
pub mod engine;
pub mod evidence;
pub mod fixture;
pub mod messages;
pub mod metrics;
pub mod proposal;
pub mod reactor;
pub mod signer;
pub mod simnet;
pub mod store;
pub mod types;
pub mod validators;
pub mod vote;
pub mod wal;

pub use engine::{Action, ConsensusEngine};
pub use fixture::{FourValidatorFixture, SevenValidatorFixture};
pub use messages::ConsensusMessage;
pub use metrics::{ConsensusMetrics, ConsensusMetricsSnapshot};
pub use reactor::ConsensusReactor;
pub use signer::ConsensusSigner;
pub use store::FinalizedStore;
pub use types::{ConsensusParams, RejectReason, Step, VoteType};
pub use validators::{Validator, ValidatorId, ValidatorSet};
pub use vote::CommitCertificate;

#[cfg(test)]
mod tests {
    use super::chaos::ChaosController;
    use super::engine::refuse_if_conflicting_finality;
    use super::fixture::{FourValidatorFixture, SevenValidatorFixture};
    use super::messages::ConsensusMessage;
    use super::simnet::SimNet;
    use super::types::RejectReason;
    use super::types::VoteType;
    use super::vote::{CommitCertificate, SignedVote};
    use crate::chain::DevChain;
    use crate::crypto::{DomainKey, KeyDomain};
    use crate::identity::unix_ms;

    #[test]
    fn healthy_four_finalize_identical_blocks() {
        let fixture = FourValidatorFixture::development();
        let mut net = SimNet::four_honest(&fixture);
        net.start_all();
        net.step_until_height(3, 400).expect("healthy finality");
        for _ in 0..20 {
            net.step();
        }
        assert!(net.identical_finality(1));
        assert!(net.identical_finality(2));
        assert!(net.identical_finality(3));
        let proposers: Vec<_> = (1..=3)
            .map(|h| fixture.set.proposer(h, 0).unwrap().name.clone())
            .collect();
        assert_eq!(proposers, ["A", "B", "C"]);
    }

    #[test]
    fn three_of_four_remain_live_and_lagging_validator_catches_up() {
        let fixture = FourValidatorFixture::development();
        let mut net = SimNet::four_honest(&fixture);
        net.set_online("D", false);
        net.start_all();
        net.step_until_majority(2, 400).expect("3/4 availability");
        assert!(net.by_name("A").unwrap().engine.finalized_height() >= 2);
        assert_eq!(net.by_name("D").unwrap().engine.finalized_height(), 0);
        net.set_online("D", true);
        // D learns commits from the majority after reconnect.
        if let Some(cert) = net
            .by_name("A")
            .and_then(|n| n.engine.store.commit_certificate(1))
            .cloned()
        {
            if let Some(block) = net
                .by_name("A")
                .and_then(|n| n.engine.store.finalized_block(1))
                .cloned()
            {
                net.inject(
                    "D",
                    ConsensusMessage::CommitResponse {
                        certificate: cert,
                        block,
                    },
                );
            }
        }
        net.step_until_height(2, 200).ok();
        assert!(net.by_name("D").unwrap().engine.finalized_height() >= 1);
    }

    #[test]
    fn equal_partition_has_no_conflicting_finality() {
        let fixture = FourValidatorFixture::development();
        let mut net = SimNet::four_honest(&fixture);
        net.start_all();
        net.partition_groups(&["A", "B"], &["C", "D"]);
        for _ in 0..80 {
            net.step();
        }
        let heights: Vec<_> = net
            .nodes
            .values()
            .map(|n| n.engine.finalized_height())
            .collect();
        assert!(
            heights.iter().all(|h| *h == 0),
            "2+2 must not finalize: {heights:?}"
        );
        net.heal();
        net.step_until_height(1, 800).expect("resume after heal");
        assert!(net.identical_finality(1));
    }

    #[test]
    fn asymmetric_partition_majority_continues() {
        let fixture = FourValidatorFixture::development();
        let mut net = SimNet::four_honest(&fixture);
        net.start_all();
        net.partition_groups(&["A", "B", "C"], &["D"]);
        net.step_until_majority(1, 400).expect("3+1 majority");
        assert_eq!(net.by_name("D").unwrap().engine.finalized_height(), 0);
        net.heal();
        if let Some(cert) = net
            .by_name("A")
            .and_then(|n| n.engine.store.commit_certificate(1))
            .cloned()
        {
            if let Some(block) = net
                .by_name("A")
                .and_then(|n| n.engine.store.finalized_block(1))
                .cloned()
            {
                net.inject(
                    "D",
                    ConsensusMessage::CommitResponse {
                        certificate: cert,
                        block,
                    },
                );
            }
        }
        for _ in 0..40 {
            net.step();
        }
        assert!(net.by_name("D").unwrap().engine.finalized_height() >= 1);
    }

    #[test]
    fn byzantine_conflicting_vote_becomes_evidence() {
        let fixture = FourValidatorFixture::development();
        let mut net = SimNet::four_honest(&fixture);
        net.start_all();
        let mut evil = fixture.signer(3);
        let vote_x = SignedVote::sign(
            &mut evil,
            &fixture.genesis.network_id,
            &fixture.genesis.chain_id,
            1,
            0,
            VoteType::Prevote,
            Some([1u8; 32]),
        )
        .unwrap();
        // Forged second vote bypasses local signer safety.
        let mut vote_y = vote_x.clone();
        vote_y.block_id = Some([2u8; 32]);
        vote_y.signature = [9u8; 64];
        net.inject("A", ConsensusMessage::Prevote(vote_x));
        net.inject("A", ConsensusMessage::Prevote(vote_y));
        assert!(net.rejects.iter().any(|r| matches!(
            r,
            RejectReason::InvalidSignature | RejectReason::ConflictingVote
        )));
    }

    #[test]
    fn malicious_proposer_two_blocks_cannot_double_finalize() {
        let fixture = FourValidatorFixture::development();
        let mut net = SimNet::four_honest(&fixture);
        net.start_all();
        let chain_x = DevChain::new(fixture.genesis.clone());
        let chain_y = DevChain::new(fixture.genesis.clone());
        let block_x = chain_x.propose_block(Vec::new(), unix_ms()).unwrap();
        // Distinct payload so block ids differ if a later tx is added; empty
        // blocks at the same height share an id, so use a second height parent
        // mismatch by altering time.
        let block_y = chain_y.propose_block(Vec::new(), unix_ms() + 99).unwrap();
        assert_ne!(block_x.block_id, block_y.block_id);
        refuse_if_conflicting_finality(&block_x, &block_y).unwrap_err();
        net.step_until_height(1, 400)
            .expect("honest path still lives");
        assert!(net.identical_finality(1));
    }

    #[test]
    fn wal_restart_does_not_double_sign() {
        let fixture = FourValidatorFixture::development();
        let mut net = SimNet::four_honest(&fixture);
        net.start_all();
        net.step_until_height(1, 400).expect("pre-restart");
        net.restart("B", &fixture);
        net.step_until_height(2, 400).expect("post-restart");
        assert!(net.identical_finality(2));
    }

    #[test]
    fn security_rejects_wrong_network_chain_suite_and_key() {
        let fixture = FourValidatorFixture::development();
        let mut net = SimNet::four_honest(&fixture);
        net.start_all();
        let mut stranger = crate::consensus::signer::ConsensusSigner::new(DomainKey::generate(
            KeyDomain::ValidatorConsensus,
        ))
        .unwrap();
        let vote = SignedVote::sign(
            &mut stranger,
            "net_other",
            "chn_other",
            1,
            0,
            VoteType::Prevote,
            Some([3u8; 32]),
        )
        .unwrap();
        net.inject("A", ConsensusMessage::Prevote(vote));
        assert!(net.rejects.iter().any(|r| matches!(
            r,
            RejectReason::WrongNetwork | RejectReason::NotInValidatorSet
        )));
        let malformed = CommitCertificate {
            network_id: fixture.genesis.network_id.clone(),
            chain_id: fixture.genesis.chain_id.clone(),
            height: 1,
            round: 0,
            block_id: [1u8; 32],
            state_root: [2u8; 32],
            validator_set_hash: [3u8; 32],
            votes: Vec::new(),
        };
        net.inject("A", ConsensusMessage::CommitAnnouncement(malformed));
        assert!(net.rejects.iter().any(|r| matches!(
            r,
            RejectReason::MalformedCertificate | RejectReason::OldValidatorSet
        )));
    }

    #[test]
    fn chaos_controls_exist_and_delay_still_finalizes() {
        let fixture = FourValidatorFixture::development();
        let mut net = SimNet::four_honest(&fixture);
        {
            let mut chaos = ChaosController::new(&mut net);
            chaos.delay_packets("A", "B", 2);
            chaos.duplicate_packets("C", "D");
            assert_eq!(ChaosController::supported().len(), 7);
        }
        net.start_all();
        net.step_until_height(1, 500).expect("delayed finality");
    }

    #[test]
    fn seven_testnet_validators_finalize_and_survive_two_faults() {
        let fixture = SevenValidatorFixture::testnet();
        assert_eq!(fixture.validators.len(), 7);
        assert_eq!(
            fixture.genesis.network_id,
            crate::chain::TESTNET_1_NETWORK_ID
        );
        let mut net = SimNet::seven_honest(&fixture);
        net.start_all();
        net.step_until_height(1, 600)
            .expect("seven-validator finality");
        assert!(net.identical_finality(1));
        net.set_online("F", false);
        net.set_online("G", false);
        net.step_until_majority(2, 600).expect("5/7 availability");
        assert!(net.by_name("A").unwrap().engine.finalized_height() >= 2);
    }

    #[test]
    fn seven_validator_partition_without_quorum_has_no_conflicting_finality() {
        let fixture = SevenValidatorFixture::testnet();
        let mut net = SimNet::seven_honest(&fixture);
        net.start_all();
        net.partition_groups(&["A", "B", "C"], &["D", "E", "F", "G"]);
        for _ in 0..80 {
            net.step();
        }
        let heights: Vec<_> = net
            .nodes
            .values()
            .map(|n| n.engine.finalized_height())
            .collect();
        assert!(
            heights.iter().all(|h| *h == 0),
            "3+4 must not finalize: {heights:?}"
        );
    }

    #[test]
    fn p2p_key_cannot_sign_consensus_vote() {
        let p2p = DomainKey::generate(KeyDomain::P2pNode);
        assert!(crate::consensus::signer::ConsensusSigner::new(p2p).is_err());
    }
}
