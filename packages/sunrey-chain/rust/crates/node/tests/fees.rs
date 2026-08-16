use sunrey_crypto::development_fixture_secret;
use sunrey_execution::encode_issue_bytes;
use sunrey_fees::{usage_for, FeeAsset, FeeIntent, ProtocolOp};
use sunrey_native_assets::{
    AssetQuantity, IssuanceAuthorization, NativeAssetId, NativeAssetOp, NativeAssetPayload,
    DEVELOPMENT_FAUCET_POLICY, DEV_FAUCET_ISSUER,
};
use sunrey_node::LocalNode;
use sunrey_protocol::{
    TransactionFamily, UnsignedTransaction, LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID,
    SCHEMA_VERSION, SRCB_CODEC_ID,
};

fn dir() -> std::path::PathBuf {
    let nanos =
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let path = std::env::temp_dir().join(format!("sunrey-fees-{nanos}"));
    std::fs::create_dir_all(&path).unwrap();
    path
}

fn unsigned(nonce: u64, payload: Vec<u8>, key: &str) -> UnsignedTransaction {
    UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::NativeAsset,
        nonce,
        idempotency_key: key.to_string(),
        payload,
    }
}

fn faucet_bytes(recipient: &str, qty: u128, auth_id: &str) -> Vec<u8> {
    let secret = development_fixture_secret();
    let payload = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Issue,
        actor_id: "dev.faucet".to_string(),
        asset_id: NativeAssetId::SunReyCoin,
        quantity: qty,
        counterparty: recipient.to_string(),
        lock_id: String::new(),
        lock_purpose: None,
        expiration_height: None,
        authorized_releaser: String::new(),
        authorization_id: auth_id.to_string(),
        issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
        proof_reference: format!("faucet:{auth_id}"),
        economic_unit_label: "DEVELOPMENT_ECONOMIC_UNIT".to_string(),
    };
    let auth = IssuanceAuthorization {
        authorization_id: auth_id.to_string(),
        asset_id: NativeAssetId::SunReyCoin,
        recipient: recipient.to_string(),
        quantity: qty,
        issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
        proof_reference: format!("faucet:{auth_id}"),
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
    encode_issue_bytes(&payload, auth, &secret).unwrap()
}

fn transfer_with_fee(
    from: &str,
    to: &str,
    amount: u128,
    max_fee: u128,
    max_units: u128,
) -> Vec<u8> {
    let mut bytes = NativeAssetPayload::transfer(
        from,
        to,
        AssetQuantity::new(NativeAssetId::SunReyCoin, amount).unwrap(),
    )
    .encode();
    bytes.extend_from_slice(
        &FeeIntent {
            max_fee,
            max_execution_units: max_units,
            fee_asset: FeeAsset::SunreyCoin,
            fee_payer: from.to_string(),
        }
        .encode(),
    );
    bytes
}

#[test]
fn faucet_transfer_receipt_and_over_budget() {
    let mut node = LocalNode::init(dir()).unwrap();
    let secret = development_fixture_secret();
    let faucet = node
        .sign_dev_tx(unsigned(0, faucet_bytes("alice", 50_000, "fee-sun-1"), "fee-sun-1"), &secret)
        .unwrap();
    node.submit_signed(faucet).unwrap();
    node.produce_block().unwrap();
    assert!(node.fees.position("alice", FeeAsset::SunreyCoin).available >= 50_000);
    assert!(
        node.native_assets().unwrap().available("alice", NativeAssetId::SunReyCoin) >= 50_000
    );

    let transfer = node
        .sign_dev_tx(
            unsigned(1, transfer_with_fee("alice", "bob", 1_000, 5_000, 10_000), "fee-xfer-1"),
            &secret,
        )
        .unwrap();
    let tx_id = node.submit_signed(transfer).unwrap();
    node.produce_block().unwrap();
    let receipt = node.fees_receipt(&tx_id).expect("receipt");
    assert_eq!(receipt["payer"], "alice");
    assert!(node.fees.position("bob", FeeAsset::SunreyCoin).available >= 1_000);
    assert!(node.native_assets().unwrap().available("bob", NativeAssetId::SunReyCoin) >= 1_000);

    let low = node
        .sign_dev_tx(
            unsigned(2, transfer_with_fee("alice", "bob", 1, 1, 10_000), "fee-low"),
            &secret,
        )
        .unwrap();
    assert!(node.submit_signed(low).is_err());

    let over = node
        .sign_dev_tx(
            unsigned(2, transfer_with_fee("alice", "carol", 50, 5_000, 20), "fee-over"),
            &secret,
        )
        .unwrap();
    node.submit_signed(over).unwrap();
    node.produce_block().unwrap();
    assert_eq!(node.fees.position("carol", FeeAsset::SunreyCoin).available, 0);
    assert_eq!(node.native_assets().unwrap().available("carol", NativeAssetId::SunReyCoin), 0);
    let usage = usage_for(ProtocolOp::NativeTransfer, 240, 1);
    assert_eq!(usage.compute, 100);
}
