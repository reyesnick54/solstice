//! Wave 2 Prompt 5 — consensus cannot authorize monetary issuance.

use sunrey_consensus::{development_secret, ConsensusAdapter, ExecutionConsensusAdapter};
use sunrey_crypto::{development_fixture_secret, schema_registry_hash, DevEd25519Sha256Suite};
use sunrey_execution::encode_issue_bytes;
use sunrey_native_assets::{
    IssuanceAuthorization, NativeAssetId, NativeAssetOp, NativeAssetPayload,
    DEVELOPMENT_FAUCET_POLICY, DEV_FAUCET_ISSUER,
};
use sunrey_protocol::{
    encode_system_payload, local_dev_genesis, SystemPayload, TransactionFamily,
    UnsignedTransaction, LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, SCHEMA_VERSION, SRCB_CODEC_ID,
};

fn adapter() -> ExecutionConsensusAdapter {
    let suite = DevEd25519Sha256Suite;
    let schema_hash = schema_registry_hash(&suite);
    ExecutionConsensusAdapter::development(local_dev_genesis(
        schema_hash.to_vec(),
        "sunrey.dev.ed25519.v1".to_string(),
    ))
}

#[test]
fn consensus_adapter_rejects_unauthorized_sunrey_issue() {
    let adapter = adapter();
    let secret = development_secret("issuer");
    let payload = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Issue,
        asset_id: NativeAssetId::SunReyCoin,
        actor_id: "governance.actor".to_string(),
        counterparty: "recipient".to_string(),
        quantity: 1_000,
        lock_id: String::new(),
        lock_purpose: None,
        expiration_height: None,
        authorized_releaser: String::new(),
        authorization_id: "missing-governance".to_string(),
        issuance_policy: "sunrey.issuance.sunrey_coin.v1".to_string(),
        proof_reference: "none".to_string(),
        economic_unit_label: "DEVELOPMENT_ECONOMIC_UNIT".to_string(),
    };
    let unsigned = UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::NativeAsset,
        nonce: 0,
        idempotency_key: "unauth-issue".to_string(),
        payload: payload.encode(),
    };
    let tx = adapter.sign_dev_tx(unsigned, &secret).unwrap();
    assert!(adapter.validate_tx(&tx, &adapter.view).is_err());
}

#[test]
fn development_faucet_issue_requires_simulation_environment() {
    let mut adapter = adapter();
    adapter.genesis.environment = "production".to_string();
    adapter.genesis.production_network_enabled = true;
    let secret = development_fixture_secret();
    let payload = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Issue,
        actor_id: "dev.faucet".to_string(),
        asset_id: NativeAssetId::SunReyCoin,
        quantity: 100,
        counterparty: "recipient".to_string(),
        lock_id: String::new(),
        lock_purpose: None,
        expiration_height: None,
        authorized_releaser: String::new(),
        authorization_id: "faucet-1".to_string(),
        issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
        proof_reference: "faucet:faucet-1".to_string(),
        economic_unit_label: "DEVELOPMENT_ECONOMIC_UNIT".to_string(),
    };
    let auth = IssuanceAuthorization {
        authorization_id: "faucet-1".to_string(),
        asset_id: NativeAssetId::SunReyCoin,
        recipient: "recipient".to_string(),
        quantity: 100,
        issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
        proof_reference: "faucet:faucet-1".to_string(),
        governance_policy_reference: "gov.native.dev.v1".to_string(),
        expiration_height: 10_000,
        issuer: DEV_FAUCET_ISSUER.to_string(),
        suite_id: String::new(),
        algorithm_id: String::new(),
        public_key: vec![],
        signature: vec![],
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
    };
    let payload_bytes = encode_issue_bytes(&payload, auth, &secret).unwrap();
    let unsigned = UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::NativeAsset,
        nonce: 0,
        idempotency_key: "faucet".to_string(),
        payload: payload_bytes,
    };
    let tx = adapter.sign_dev_tx(unsigned, &secret).unwrap();
    let mut view = adapter.view.clone();
    assert!(ExecutionConsensusAdapter::apply_one(
        &adapter.genesis,
        &adapter.suite,
        &mut view,
        tx,
        1,
    )
    .is_err());
}

#[test]
fn authorized_faucet_issue_succeeds_in_simulation() {
    let adapter = adapter();
    let secret = development_fixture_secret();
    let payload = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Issue,
        actor_id: "dev.faucet".to_string(),
        asset_id: NativeAssetId::SunReyCoin,
        quantity: 100,
        counterparty: "recipient".to_string(),
        lock_id: String::new(),
        lock_purpose: None,
        expiration_height: None,
        authorized_releaser: String::new(),
        authorization_id: "faucet-2".to_string(),
        issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
        proof_reference: "faucet:faucet-2".to_string(),
        economic_unit_label: "DEVELOPMENT_ECONOMIC_UNIT".to_string(),
    };
    let auth = IssuanceAuthorization {
        authorization_id: "faucet-2".to_string(),
        asset_id: NativeAssetId::SunReyCoin,
        recipient: "recipient".to_string(),
        quantity: 100,
        issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
        proof_reference: "faucet:faucet-2".to_string(),
        governance_policy_reference: "gov.native.dev.v1".to_string(),
        expiration_height: 10_000,
        issuer: DEV_FAUCET_ISSUER.to_string(),
        suite_id: String::new(),
        algorithm_id: String::new(),
        public_key: vec![],
        signature: vec![],
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
    };
    let payload_bytes = encode_issue_bytes(&payload, auth, &secret).unwrap();
    let unsigned = UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::NativeAsset,
        nonce: 0,
        idempotency_key: "faucet-ok".to_string(),
        payload: payload_bytes,
    };
    let tx = adapter.sign_dev_tx(unsigned, &secret).unwrap();
    let mut view = adapter.view.clone();
    ExecutionConsensusAdapter::apply_one(&adapter.genesis, &adapter.suite, &mut view, tx, 1)
        .unwrap();
    assert!(view
        .store
        .get(&sunrey_state::ObjectStore::namespaced(
            sunrey_state::NS_ASSET,
            sunrey_native_assets::LEDGER_STORE_KEY,
        ))
        .is_some());
}

#[test]
fn consensus_sources_do_not_reference_execution_authority() {
    let forbidden = ["AuthorityIssuer", "postJournal", "LIVE_CHAIN_ENABLED", "MAINNET_ENABLED"];
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/adapter.rs");
    let source = std::fs::read_to_string(path).expect("read adapter");
    for needle in forbidden {
        assert!(!source.contains(needle), "adapter must not reference {needle}");
    }
}

#[test]
fn system_transactions_do_not_move_supply() {
    let adapter = adapter();
    let secret = development_secret("user");
    let unsigned = UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::System,
        nonce: 0,
        idempotency_key: "sys".to_string(),
        payload: encode_system_payload(&SystemPayload {
            op: "SET_OBJECT".to_string(),
            object_key: "note".to_string(),
            object_value: b"hello".to_vec(),
        }),
    };
    let tx = adapter.sign_dev_tx(unsigned, &secret).unwrap();
    let before = adapter.state_commitment();
    let mut view = adapter.view.clone();
    ExecutionConsensusAdapter::apply_one(&adapter.genesis, &adapter.suite, &mut view, tx, 1)
        .unwrap();
    assert_ne!(before, view.store.app_hash(&DevEd25519Sha256Suite));
}

#[test]
fn consensus_agreement_alone_does_not_imply_issuance_authority() {
    let payload = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Issue,
        asset_id: NativeAssetId::MoonReyCoin,
        actor_id: "validator".to_string(),
        counterparty: "recipient".to_string(),
        quantity: 1,
        lock_id: String::new(),
        lock_purpose: None,
        expiration_height: None,
        authorized_releaser: String::new(),
        authorization_id: "no-gov".to_string(),
        issuance_policy: "sunrey.issuance.moonrey_coin.v1".to_string(),
        proof_reference: "none".to_string(),
        economic_unit_label: "DEVELOPMENT_ECONOMIC_UNIT".to_string(),
    };
    let unsigned = UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::NativeAsset,
        nonce: 0,
        idempotency_key: "moon".to_string(),
        payload: payload.encode(),
    };
    let adapter = adapter();
    let tx = adapter.sign_dev_tx(unsigned, &development_secret("v")).unwrap();
    assert!(adapter.validate_tx(&tx, &adapter.view).is_err());
}
