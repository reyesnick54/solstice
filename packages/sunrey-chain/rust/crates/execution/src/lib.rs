//! Protocol-native execution modules for the local development node.

use sunrey_protocol::{
    decode_evidence_anchor_payload, decode_system_payload, hex_decode, RejectReason,
    SignedTransaction, TransactionFamily,
};
use sunrey_state::{ChainView, ObjectStore, NS_ASSET, NS_EVIDENCE, NS_OBJECT, NS_SYSTEM};

pub fn apply_transaction(view: &mut ChainView, tx: &SignedTransaction) -> Result<(), RejectReason> {
    match tx.unsigned.family {
        TransactionFamily::System => apply_system(view, tx)?,
        TransactionFamily::EvidenceAnchor => apply_evidence_anchor(view, tx)?,
        TransactionFamily::NativeAsset => return Err(RejectReason::TransactionNotActivated),
        TransactionFamily::Identity => return Err(RejectReason::TransactionNotActivated),
    }
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
}
