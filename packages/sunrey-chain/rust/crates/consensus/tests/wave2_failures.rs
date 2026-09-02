//! Wave 2 Prompt 5 — consensus failure and recovery scenarios through the
//! execution adapter and four-validator harness.

use sunrey_consensus::{
    development_secret, four_validator_set, ConsensusAdapter, ConsensusEngine, ConsensusOutput,
    ConsensusStep, EngineConfig, EnginePaths, ExecutionConsensusAdapter, FourValidatorHarness,
    Height, HARNESS_VALIDATORS,
};
use sunrey_crypto::{schema_registry_hash, DevEd25519Sha256Suite};
use sunrey_protocol::{
    encode_system_payload, local_dev_genesis, SystemPayload, TransactionFamily,
    UnsignedTransaction, LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, SCHEMA_VERSION, SRCB_CODEC_ID,
};

fn genesis() -> sunrey_protocol::GenesisV1 {
    let suite = DevEd25519Sha256Suite;
    let schema_hash = schema_registry_hash(&suite);
    local_dev_genesis(schema_hash.to_vec(), "sunrey.dev.ed25519.v1".to_string())
}

fn system_tx(
    adapter: &ExecutionConsensusAdapter,
    nonce: u64,
    key: &str,
) -> sunrey_protocol::SignedTransaction {
    let unsigned = UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::System,
        nonce,
        idempotency_key: format!("wave2-{key}"),
        payload: encode_system_payload(&SystemPayload {
            op: "SET_OBJECT".to_string(),
            object_key: key.to_string(),
            object_value: b"wave2".to_vec(),
        }),
    };
    adapter.sign_dev_tx(unsigned, &development_secret("tx_actor")).unwrap()
}

fn execution_harness() -> (
    std::collections::BTreeMap<
        String,
        ConsensusEngine<ExecutionConsensusAdapter, DevEd25519Sha256Suite>,
    >,
    std::collections::BTreeMap<String, bool>,
) {
    let set = four_validator_set().unwrap();
    let params = sunrey_consensus::ConsensusParams::development();
    let genesis = genesis();
    let mut nodes = std::collections::BTreeMap::new();
    let mut available = std::collections::BTreeMap::new();
    for id in HARNESS_VALIDATORS {
        let secret = development_secret(id);
        let app = ExecutionConsensusAdapter::development(genesis.clone());
        let engine = ConsensusEngine::open(
            EngineConfig::development(id),
            DevEd25519Sha256Suite,
            app,
            params.clone(),
            set.clone(),
            Some(secret),
            EnginePaths { wal: None, signer: None },
        )
        .unwrap();
        nodes.insert(id.to_string(), engine);
        available.insert(id.to_string(), true);
    }
    (nodes, available)
}

fn drive(
    nodes: &mut std::collections::BTreeMap<
        String,
        ConsensusEngine<ExecutionConsensusAdapter, DevEd25519Sha256Suite>,
    >,
    available: &std::collections::BTreeMap<String, bool>,
    max: usize,
) -> bool {
    let mut pending = Vec::new();
    for (id, node) in nodes.iter_mut() {
        if available.get(id).copied().unwrap_or(false) {
            pending.extend(node.start_round(sunrey_consensus::Round::ZERO).unwrap());
        }
    }
    for _ in 0..max {
        if nodes.values().any(|n| n.last_finalized.is_some()) {
            return true;
        }
        if pending.is_empty() {
            break;
        }
        let batch = std::mem::take(&mut pending);
        for output in batch {
            match output {
                ConsensusOutput::Proposal(proposal) => {
                    for (id, node) in nodes.iter_mut() {
                        if available.get(id).copied().unwrap_or(false) {
                            if let Ok(more) = node.receive_proposal(*proposal.clone()) {
                                pending.extend(more);
                            }
                        }
                    }
                }
                ConsensusOutput::Vote(vote) => {
                    for (id, node) in nodes.iter_mut() {
                        if available.get(id).copied().unwrap_or(false) {
                            let more = match vote.vote_type {
                                sunrey_consensus::VoteType::Prevote => {
                                    node.receive_prevote(vote.clone())
                                }
                                sunrey_consensus::VoteType::Precommit => {
                                    node.receive_precommit(vote.clone())
                                }
                            };
                            if let Ok(more) = more {
                                pending.extend(more);
                            }
                        }
                    }
                }
                ConsensusOutput::Finalized(_) | ConsensusOutput::Evidence(_) => {}
                ConsensusOutput::TimeoutScheduled { .. } => {}
            }
        }
    }
    nodes.values().any(|n| n.last_finalized.is_some())
}

#[test]
fn four_validators_agree_on_execution_state() {
    let (mut nodes, available) = execution_harness();
    assert!(drive(&mut nodes, &available, 256));
    let roots: Vec<_> = nodes.values().map(|n| n.app.state_commitment()).collect();
    assert!(roots.windows(2).all(|w| w[0] == w[1]));
    assert_eq!(nodes["val_a"].app.canonical_height(), 1);
}

#[test]
fn one_validator_offline_still_finalizes() {
    let (mut nodes, mut available) = execution_harness();
    available.insert("val_d".to_string(), false);
    assert!(drive(&mut nodes, &available, 256));
    assert!(nodes["val_a"].last_finalized.is_some());
    assert!(nodes["val_d"].last_finalized.is_none());
}

#[test]
fn invalid_proposed_transaction_rejected() {
    let genesis = genesis();
    let mut adapter = ExecutionConsensusAdapter::development(genesis);
    let bad = UnsignedTransaction {
        network_id: "net_wrong".to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::System,
        nonce: 0,
        idempotency_key: "bad".to_string(),
        payload: encode_system_payload(&SystemPayload {
            op: "SET_OBJECT".to_string(),
            object_key: "k".to_string(),
            object_value: b"x".to_vec(),
        }),
    };
    let tx = adapter.sign_dev_tx(bad, &development_secret("tx_actor")).unwrap();
    adapter.push_mempool(tx);
    let ctx = sunrey_consensus::ProposalContext {
        height: Height::FIRST,
        round: sunrey_consensus::Round::ZERO,
        parent: [0u8; 32],
        max_block_bytes: 1_048_576,
        max_transactions: 100,
    };
    let proposal = adapter.prepare_proposal(&ctx).unwrap();
    assert!(proposal.transactions.is_empty());
}

#[test]
fn inconsistent_application_hash_rejected() {
    let genesis = genesis();
    let adapter = ExecutionConsensusAdapter::development(genesis);
    let ctx = sunrey_consensus::ProposalContext {
        height: Height::FIRST,
        round: sunrey_consensus::Round::ZERO,
        parent: [0u8; 32],
        max_block_bytes: 1_048_576,
        max_transactions: 100,
    };
    let value = sunrey_consensus::ProposedValue {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        protocol_version: "1".to_string(),
        height: Height::FIRST,
        round: sunrey_consensus::Round::ZERO,
        parent: [0u8; 32],
        validator_set_hash: [0u8; 32],
        validator_set_version: 1,
        consensus_parameter_hash: [0u8; 32],
        proposer: sunrey_consensus::ValidatorId::from("val_a"),
        tx_root: [9u8; 32],
        app_hash_proposal: [8u8; 32],
        transactions: vec![system_tx(&adapter, 0, "bad-hash").encode()],
        time_unix_ms: 1,
    };
    assert!(adapter.validate_proposal(&value, &ctx).is_err());
}

#[test]
fn memory_harness_still_finalizes_for_regression() {
    let mut harness = FourValidatorHarness::open_ephemeral().unwrap();
    let finalized = harness.drive_until_commit(64).unwrap();
    assert_eq!(finalized.height, Height::FIRST);
    assert_eq!(harness.nodes["val_a"].engine.state.step, ConsensusStep::Finalized);
}

#[test]
fn quorum_not_reached_without_majority() {
    let (mut nodes, mut available) = execution_harness();
    for id in ["val_b", "val_c", "val_d"] {
        available.insert(id.to_string(), false);
    }
    assert!(!drive(&mut nodes, &available, 32));
    assert!(nodes.values().all(|n| n.last_finalized.is_none()));
}
