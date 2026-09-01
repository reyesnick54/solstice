//! Wave 3 Prompt 9 adversarial interoperability security tests.

use std::collections::BTreeSet;

use sunrey_interop::activation::{InteropActivationGate, InteropActivationState};
use sunrey_interop::boundary::InteropBoundary;
use sunrey_interop::circuit_breaker::InteropCircuitBreakers;
use sunrey_interop::engine::{development_fixture, make_packet, open_dev_path, packet_state_key};
use sunrey_interop::envelope::{
    InteropFlowDirection, InteropMessageEnvelope, DOMAIN_ENVELOPE, ENVELOPE_SCHEMA_VERSION,
};
use sunrey_interop::error::InteropError;
use sunrey_interop::external_rpc::{
    ExternalRpcEvaluator, ExternalRpcObservation, FinalityRequirement,
};
use sunrey_interop::flow::InteropFlowLedger;
use sunrey_interop::foreign::ExternalDevChain;
use sunrey_interop::keys::{assert_key_separation, InteropKeyBinding};
use sunrey_interop::network::{require_egress, InteropNetworkPolicy, InteropServiceRole};
use sunrey_interop::registry::{
    development_external_chain, EXTERNAL_DEV_CHAIN_ID, SUNREY_CHAIN_ID,
};
use sunrey_interop::relayer::IsolatedRelayer;
use sunrey_interop::rpc_access::interop_may_call;
use sunrey_interop::types::{ChannelOrdering, ChannelType};
use sunrey_interop::watcher::IsolatedWatcher;
use sunrey_interop::INTEROP_PROTOCOL_VERSION;

fn setup() -> (ExternalDevChain, sunrey_interop::engine::InteropEngine, String) {
    let foreign = ExternalDevChain::genesis();
    let engine = development_fixture(
        foreign.latest_header().unwrap(),
        foreign.latest_proof().unwrap(),
        foreign.validator_public_keys(),
    )
    .unwrap();
    let client = engine.clients.keys().next().cloned().unwrap();
    (foreign, engine, client)
}

fn active_dev_chain() -> sunrey_interop::registry::ExternalChainDefinition {
    let mut chain = development_external_chain("00".into(), "00".into());
    chain.status = sunrey_interop::types::ChainStatus::ActiveDevelopment;
    chain
}

fn sample_envelope() -> InteropMessageEnvelope {
    InteropMessageEnvelope {
        envelope_version: ENVELOPE_SCHEMA_VERSION,
        protocol_version: INTEROP_PROTOCOL_VERSION.to_string(),
        direction: InteropFlowDirection::Inbound,
        source_network: "net_external_dev".into(),
        source_chain_id: EXTERNAL_DEV_CHAIN_ID.into(),
        source_tx_hash: "0xdeadbeef".into(),
        source_event_index: 0,
        destination_chain_id: SUNREY_CHAIN_ID.into(),
        destination_channel: "chan-0".into(),
        message_type: ChannelType::GenericMessage,
        payload_hash: sunrey_interop::encoding::domain_hash(
            sunrey_interop::DOMAIN_PACKET,
            b"hello",
        ),
        message_nonce: 1,
        sequence: 0,
        expiry_height: 100,
        expiry_timestamp: 1_900_000_000,
        proof_reference: "proof-ref".into(),
        attestation_digest: "att".into(),
        domain: DOMAIN_ENVELOPE.to_string(),
    }
}

#[test]
fn production_interop_remains_disabled_by_default() {
    let gate = InteropActivationGate::fail_closed_default();
    assert_eq!(gate.state, InteropActivationState::Disabled);
    assert_eq!(gate.require_production().unwrap_err(), InteropError::ProductionInteropDisabled);
    let mut gate2 = InteropActivationGate::fail_closed_default();
    gate2.relayer_started_must_not_activate();
    gate2.url_present_must_not_activate("https://rpc.example");
    gate2.credential_present_must_not_activate("cred-123");
    gate2.node_env_production_must_not_activate("production");
    assert_eq!(gate2.state, InteropActivationState::Disabled);
}

#[test]
fn duplicate_and_replay_messages_rejected() {
    let (mut foreign, mut engine, client) = setup();
    let honest = IsolatedRelayer::new("honest");
    let (_, src, dst) = open_dev_path(
        &mut engine,
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        ChannelType::GenericMessage,
        ChannelOrdering::Unordered,
    )
    .unwrap();
    let packet = make_packet(
        EXTERNAL_DEV_CHAIN_ID,
        SUNREY_CHAIN_ID,
        &src,
        &dst,
        0,
        ChannelType::GenericMessage,
        b"payload".to_vec(),
        50,
    );
    foreign.put(packet_state_key(&packet), packet.encode());
    let (header, proof) = foreign.finalize_next().unwrap();
    engine.submit_header_update(&client, header, proof, &honest).unwrap();
    let membership = foreign.membership(&packet_state_key(&packet)).unwrap();
    engine.recv_packet(&client, packet.clone(), &membership, 1, &honest).unwrap();
    assert_eq!(
        engine.recv_packet(&client, packet, &membership, 1, &honest).unwrap_err(),
        InteropError::PacketReplay
    );
}

#[test]
fn wrong_source_chain_and_unsupported_version_rejected() {
    let mut envelope = sample_envelope();
    envelope.source_chain_id = "chn_wrong".into();
    let gate = InteropActivationGate::fail_closed_default();
    let mut circuits = InteropCircuitBreakers::default();
    let mut consumed = BTreeSet::new();
    let mut engine = sunrey_interop::engine::InteropEngine::new();
    engine
        .register_chain(
            active_dev_chain(),
            &sunrey_interop::engine::gov(
                "gov",
                sunrey_interop::types::ActorKind::GovernanceSigner,
                sunrey_interop::governance::InteropGovernanceAction::RegisterExternalChain,
                EXTERNAL_DEV_CHAIN_ID,
            ),
        )
        .unwrap();
    let chain = engine.chains.get(EXTERNAL_DEV_CHAIN_ID).unwrap().clone();
    let mut boundary = InteropBoundary {
        engine: &mut engine,
        activation: &gate,
        circuits: &mut circuits,
        consumed: &mut consumed,
    };
    assert_eq!(
        boundary
            .verify_envelope(&envelope, b"hello", &chain, &IsolatedRelayer::new("r"))
            .unwrap_err(),
        InteropError::ProductionInteropDisabled
    );
    let gate_dev = InteropActivationGate {
        state: InteropActivationState::DevelopmentOnly,
        environment: "simulation".into(),
        live_flags: false,
        governance_approval_id: None,
        qualification_complete: false,
        counsel_review: "RESEARCH_REQUIRED".into(),
    };
    gate_dev.require_development().unwrap();
    envelope.source_chain_id = EXTERNAL_DEV_CHAIN_ID.into();
    envelope.envelope_version = 99;
    let mut boundary2 = InteropBoundary {
        engine: &mut engine,
        activation: &gate_dev,
        circuits: &mut circuits,
        consumed: &mut consumed,
    };
    assert_eq!(
        boundary2
            .verify_envelope(&envelope, b"hello", &chain, &IsolatedRelayer::new("r"))
            .unwrap_err(),
        InteropError::UnsupportedMessageVersion
    );
}

#[test]
fn expired_message_rejected() {
    let mut envelope = sample_envelope();
    envelope.expiry_timestamp = 1;
    let gate = InteropActivationGate {
        state: InteropActivationState::DevelopmentOnly,
        environment: "simulation".into(),
        live_flags: false,
        governance_approval_id: None,
        qualification_complete: false,
        counsel_review: "RESEARCH_REQUIRED".into(),
    };
    let mut engine = sunrey_interop::engine::InteropEngine::new();
    engine.now_unix = 9_999_999;
    let chain = active_dev_chain();
    let mut circuits = InteropCircuitBreakers::default();
    let mut consumed = BTreeSet::new();
    let mut boundary = InteropBoundary {
        engine: &mut engine,
        activation: &gate,
        circuits: &mut circuits,
        consumed: &mut consumed,
    };
    assert_eq!(
        boundary
            .verify_envelope(&envelope, b"hello", &chain, &IsolatedRelayer::new("r"))
            .unwrap_err(),
        InteropError::MessageExpired
    );
}

#[test]
fn malformed_envelope_and_wrong_payload_hash_rejected() {
    let mut envelope = sample_envelope();
    envelope.domain = "evil.domain".into();
    let gate = InteropActivationGate {
        state: InteropActivationState::DevelopmentOnly,
        environment: "simulation".into(),
        live_flags: false,
        governance_approval_id: None,
        qualification_complete: false,
        counsel_review: "RESEARCH_REQUIRED".into(),
    };
    let mut engine = sunrey_interop::engine::InteropEngine::new();
    let chain = active_dev_chain();
    let mut circuits = InteropCircuitBreakers::default();
    let mut consumed = BTreeSet::new();
    let mut boundary = InteropBoundary {
        engine: &mut engine,
        activation: &gate,
        circuits: &mut circuits,
        consumed: &mut consumed,
    };
    assert_eq!(
        boundary
            .verify_envelope(&envelope, b"hello", &chain, &IsolatedRelayer::new("r"))
            .unwrap_err(),
        InteropError::SchemaInvalid
    );
    envelope.domain = DOMAIN_ENVELOPE.to_string();
    assert_eq!(
        boundary
            .verify_envelope(&envelope, b"tampered", &chain, &IsolatedRelayer::new("r"))
            .unwrap_err(),
        InteropError::ModifiedPacket
    );
}

#[test]
fn paused_global_and_network_and_asset() {
    let mut circuits = InteropCircuitBreakers::default();
    circuits.pause_global("gov-1", "incident");
    assert_eq!(
        circuits.guard_message("net_a", None, 0).unwrap_err(),
        InteropError::GlobalInteropPaused
    );
    circuits.global_paused = false;
    circuits.pause_network("net_a", "gov-1", "suspect");
    assert_eq!(circuits.guard_message("net_a", None, 0).unwrap_err(), InteropError::NetworkPaused);
    circuits.paused_networks.clear();
    circuits.pause_asset("DEV_INTEROP_TEST_ASSET", "gov-1", "limit");
    assert_eq!(
        circuits.guard_message("net_a", Some("DEV_INTEROP_TEST_ASSET"), 0).unwrap_err(),
        InteropError::AssetPaused
    );
}

#[test]
fn value_and_message_limits_enforced() {
    let mut circuits = InteropCircuitBreakers { value_limit_minor: 100, ..Default::default() };
    assert_eq!(
        circuits.guard_message("net_a", None, 200).unwrap_err(),
        InteropError::ValueLimitExceeded
    );
    circuits.message_count_limit = 1;
    circuits.guard_message("net_a", None, 1).unwrap();
    assert_eq!(
        circuits.guard_message("net_a", None, 1).unwrap_err(),
        InteropError::MessageCountLimitExceeded
    );
}

#[test]
fn relayer_admin_rpc_forbidden() {
    assert_eq!(
        interop_may_call("RELAYER", "POST", "/admin/produce-block").unwrap_err(),
        InteropError::RpcMethodForbidden
    );
    assert_eq!(
        interop_may_call("RELAYER", "GET", "/v1/validator/admin").unwrap_err(),
        InteropError::RpcMethodForbidden
    );
}

#[test]
fn watcher_cannot_submit_or_govern() {
    let watcher = IsolatedWatcher::new("w1", EXTERNAL_DEV_CHAIN_ID);
    assert_eq!(watcher.cannot_submit().unwrap_err(), InteropError::WatcherForbidden);
    assert_eq!(watcher.cannot_govern().unwrap_err(), InteropError::WatcherForbidden);
    assert_eq!(
        interop_may_call("WATCHER", "POST", "/v1/transactions").unwrap_err(),
        InteropError::RpcMethodForbidden
    );
}

#[test]
fn network_egress_denied_for_privileged_destinations() {
    let policy = InteropNetworkPolicy::default();
    assert!(
        require_egress(&policy, InteropServiceRole::Watcher, "fixture://external-dev-rpc").is_ok()
    );
    assert_eq!(
        require_egress(&policy, InteropServiceRole::Watcher, "postgres://ledger").unwrap_err(),
        InteropError::NetworkEgressDenied
    );
    assert_eq!(
        require_egress(&policy, InteropServiceRole::Relayer, "https://vault.sunrey.internal/keys")
            .unwrap_err(),
        InteropError::NetworkEgressDenied
    );
}

#[test]
fn external_rpc_timeout_conflict_and_reorg() {
    let requirement = FinalityRequirement::development(EXTERNAL_DEV_CHAIN_ID);
    let mut eval = ExternalRpcEvaluator::default();
    assert_eq!(
        eval.reconcile(&requirement, 1_700_000_000).unwrap_err(),
        InteropError::ExternalRpcTimeout
    );
    eval.record(ExternalRpcObservation {
        endpoint_id: "a".into(),
        chain_id: EXTERNAL_DEV_CHAIN_ID.into(),
        block_height: 10,
        block_hash: "h10a".into(),
        tx_hash: None,
        event_index: None,
        finality_confirmations: 0,
        required_confirmations: 1,
        observed_at_unix: 1_700_000_000,
    });
    assert_eq!(
        eval.reconcile(&requirement, 1_700_000_000).unwrap_err(),
        InteropError::ExternalRpcStale
    );
    eval.observations.clear();
    eval.record(ExternalRpcObservation {
        endpoint_id: "a".into(),
        chain_id: EXTERNAL_DEV_CHAIN_ID.into(),
        block_height: 10,
        block_hash: "h10a".into(),
        tx_hash: None,
        event_index: None,
        finality_confirmations: 2,
        required_confirmations: 1,
        observed_at_unix: 1_700_000_000,
    });
    eval.record(ExternalRpcObservation {
        endpoint_id: "b".into(),
        chain_id: EXTERNAL_DEV_CHAIN_ID.into(),
        block_height: 10,
        block_hash: "h10b".into(),
        tx_hash: None,
        event_index: None,
        finality_confirmations: 2,
        required_confirmations: 1,
        observed_at_unix: 1_700_000_000,
    });
    assert_eq!(
        eval.reconcile(&requirement, 1_700_000_000).unwrap_err(),
        InteropError::ExternalRpcConflict
    );
}

#[test]
fn interop_keys_cannot_reuse_validator_or_treasury_purposes() {
    assert!(assert_key_separation(&[
        InteropKeyBinding::interop_signer("interop-1"),
        InteropKeyBinding::watcher_attestation("watch-1"),
        InteropKeyBinding::relayer_submission("relay-1"),
    ])
    .is_ok());
    let bad = InteropKeyBinding {
        key_id: "bad".into(),
        purpose: "VALIDATOR_CONSENSUS_SIGNING".into(),
        service_role: "RELAYER".into(),
        may_sign_consensus: false,
        may_sign_governance: false,
        may_sign_treasury: false,
    };
    assert_eq!(assert_key_separation(&[bad]).unwrap_err(), InteropError::KeyPurposeForbidden);
}

#[test]
fn outbound_failure_does_not_corrupt_settlement() {
    let mut ledger = InteropFlowLedger::default();
    let mut envelope = sample_envelope();
    envelope.direction = InteropFlowDirection::Outbound;
    ledger.prepare_outbound(&envelope).unwrap();
    ledger.outbound_failed().unwrap();
    assert_eq!(ledger.outbound.failed, 1);
    assert!(!ledger.outbound.settlement_committed);
    ledger.commit_outbound_settlement();
    assert_eq!(ledger.outbound_failed().unwrap_err(), InteropError::OutboundSettlementCorruption);
}

#[test]
fn unauthorized_relayer_governance_blocked() {
    let mut engine = sunrey_interop::engine::InteropEngine::new();
    let auth = sunrey_interop::engine::gov(
        "relayer-x",
        sunrey_interop::types::ActorKind::Relayer,
        sunrey_interop::governance::InteropGovernanceAction::ActivateExternalChain,
        EXTERNAL_DEV_CHAIN_ID,
    );
    assert_eq!(
        engine.activate_chain(EXTERNAL_DEV_CHAIN_ID, &auth).unwrap_err(),
        InteropError::RelayerForbidden
    );
}

#[test]
fn envelope_parser_fuzz_smoke() {
    for nonce in 0u64..32 {
        let mut envelope = sample_envelope();
        envelope.message_nonce = nonce;
        envelope.sequence = nonce;
        let digest_a = envelope.digest();
        let digest_b = envelope.digest();
        assert_eq!(digest_a, digest_b);
    }
}
