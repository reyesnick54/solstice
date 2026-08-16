//! Protocol-native execution modules for the local development node.

use sunrey_crypto::{
    CryptoSuite, DevEd25519Sha256Suite, SigningSecret, DEV_ALGORITHM_ID, DEV_SUITE_ID,
};
use sunrey_native_assets::{
    apply_native_asset, ApplyContext, AssetCrypto, AssetError, CryptoClass, CryptoPolicy,
    IssuanceAuthorization, NativeAssetLedger, NativeAssetPayload, LEDGER_STORE_KEY,
};
use sunrey_protocol::{
    decode_evidence_anchor_payload, decode_system_payload, hex_decode, RejectReason,
    SignedTransaction, TransactionFamily,
};
use sunrey_state::{ChainView, ObjectStore, NS_ASSET, NS_EVIDENCE, NS_OBJECT, NS_SYSTEM};

pub struct ExecutionContext<'a> {
    pub height: u64,
    pub network_id: &'a str,
    pub chain_id: &'a str,
    pub environment: &'a str,
    pub production_network_enabled: bool,
    pub authorization: Option<IssuanceAuthorization>,
}

struct SuiteCrypto {
    suite: DevEd25519Sha256Suite,
}

impl AssetCrypto for SuiteCrypto {
    fn suite_id(&self) -> &str {
        DEV_SUITE_ID
    }

    fn algorithm_id(&self) -> &str {
        DEV_ALGORITHM_ID
    }

    fn crypto_class(&self) -> CryptoClass {
        CryptoClass::Classical
    }

    fn verify(
        &self,
        public_key: &[u8],
        message: &[u8],
        signature: &[u8],
    ) -> Result<(), AssetError> {
        self.suite.verify(public_key, message, signature).map_err(|_| AssetError::InvalidSignature)
    }
}

pub fn load_assets(view: &ChainView) -> Result<NativeAssetLedger, RejectReason> {
    let key = ObjectStore::namespaced(NS_ASSET, LEDGER_STORE_KEY);
    match view.store.get(&key) {
        Some(bytes) => NativeAssetLedger::decode(bytes).map_err(RejectReason::from),
        None => Ok(NativeAssetLedger::development()),
    }
}

pub fn store_assets(view: &mut ChainView, ledger: &NativeAssetLedger) {
    let key = ObjectStore::namespaced(NS_ASSET, LEDGER_STORE_KEY);
    view.store.put(key, ledger.canonical_bytes());
}

pub fn apply_transaction(
    view: &mut ChainView,
    tx: &SignedTransaction,
    ctx: &ExecutionContext<'_>,
) -> Result<(), RejectReason> {
    match tx.unsigned.family {
        TransactionFamily::System => apply_system(view, tx)?,
        TransactionFamily::EvidenceAnchor => apply_evidence_anchor(view, tx)?,
        TransactionFamily::NativeAsset => apply_native(view, tx, ctx)?,
        TransactionFamily::Identity => return Err(RejectReason::TransactionNotActivated),
    }
    Ok(())
}

fn apply_native(
    view: &mut ChainView,
    tx: &SignedTransaction,
    ctx: &ExecutionContext<'_>,
) -> Result<(), RejectReason> {
    let (payload, rest) =
        NativeAssetPayload::decode_prefix(&tx.unsigned.payload).map_err(RejectReason::from)?;
    let (_fee_intent, rest) = sunrey_fees::split_fee_intent(rest)?;
    let embedded = if rest.is_empty() {
        None
    } else {
        Some(IssuanceAuthorization::decode(rest).map_err(RejectReason::from)?)
    };
    let authorization = embedded.as_ref().or(ctx.authorization.as_ref());
    let mut ledger = load_assets(view)?;
    let crypto = SuiteCrypto { suite: DevEd25519Sha256Suite };
    let policy = CryptoPolicy::development_classical(DEV_SUITE_ID, DEV_ALGORITHM_ID);
    let apply_ctx = ApplyContext {
        height: ctx.height,
        network_id: ctx.network_id,
        chain_id: ctx.chain_id,
        environment: ctx.environment,
        production_network_enabled: ctx.production_network_enabled,
        protocol_version: 1,
        crypto: &crypto,
        crypto_policy: &policy,
        authorization,
    };
    apply_native_asset(&mut ledger, &payload, &apply_ctx).map_err(RejectReason::from)?;
    store_assets(view, &ledger);
    Ok(())
}

fn apply_system(view: &mut ChainView, tx: &SignedTransaction) -> Result<(), RejectReason> {
    let payload = decode_system_payload(&tx.unsigned.payload)?;
    if payload.op != "SET_OBJECT" && payload.op != "NOTE" {
        return Err(RejectReason::InvalidStateTransition);
    }
    if payload.object_key.is_empty() || payload.object_key.len() > 256 {
        return Err(RejectReason::StatelessInvalid);
    }
    let prefix = if payload.op == "NOTE" { NS_SYSTEM } else { NS_OBJECT };
    let key = ObjectStore::namespaced(prefix, payload.object_key.as_bytes());
    view.store.put(key, payload.object_value);
    Ok(())
}

fn apply_evidence_anchor(view: &mut ChainView, tx: &SignedTransaction) -> Result<(), RejectReason> {
    let payload = decode_evidence_anchor_payload(&tx.unsigned.payload)?;
    if payload.vault_record_hash.len() != 64 || hex_decode(&payload.vault_record_hash).is_err() {
        return Err(RejectReason::StatelessInvalid);
    }
    if payload.schema_id.is_empty() || payload.purpose.is_empty() {
        return Err(RejectReason::StatelessInvalid);
    }
    let key = ObjectStore::namespaced(NS_EVIDENCE, payload.vault_record_hash.as_bytes());
    if view.store.contains(&key) {
        return Err(RejectReason::StatefulInvalid);
    }
    let mut value = Vec::new();
    value.extend_from_slice(payload.schema_id.as_bytes());
    value.push(0);
    value.extend_from_slice(payload.purpose.as_bytes());
    view.store.put(key, value);
    Ok(())
}

pub fn encode_issue_bytes(
    payload: &sunrey_native_assets::NativeAssetPayload,
    mut authorization: IssuanceAuthorization,
    secret: &SigningSecret,
) -> Result<Vec<u8>, RejectReason> {
    let suite = DevEd25519Sha256Suite;
    authorization.suite_id = DEV_SUITE_ID.to_string();
    authorization.algorithm_id = DEV_ALGORITHM_ID.to_string();
    authorization.public_key = secret.public_key();
    authorization.signature =
        suite.sign(secret, &authorization.unsigned_bytes()).map_err(RejectReason::from)?;
    let mut out = payload.encode();
    out.extend_from_slice(&authorization.encode());
    Ok(out)
}

pub fn install_genesis_assets(view: &mut ChainView, genesis: &sunrey_protocol::GenesisV1) {
    for asset in &genesis.native_assets {
        let key = ObjectStore::namespaced(NS_ASSET, asset.asset_id.as_bytes());
        let mut value = Vec::new();
        value.extend_from_slice(asset.ticker_status.as_bytes());
        value.push(0);
        value.extend_from_slice(&asset.genesis_supply.to_be_bytes());
        value.push(u8::from(asset.implemented));
        view.store.put(key, value);
    }
    store_assets(view, &NativeAssetLedger::development());
}
