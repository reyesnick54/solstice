//! Logical storage namespaces. Deterministic state-root semantics stay in
//! `sunrey-state` / `sunrey-protocol` Merkle commitments over the state map.

use sunrey_state::{NS_ASSET, NS_EVIDENCE, NS_OBJECT, NS_SYSTEM};

pub const NS_BLOCKS: &[u8] = b"blk/";
pub const NS_BLOCK_META: &[u8] = b"bmd/";
pub const NS_CONSENSUS_META: &[u8] = b"cns/";
pub const NS_STATE: &[u8] = b"st/";
pub const NS_VALIDATOR_HISTORY: &[u8] = b"valh/";
pub const NS_GOVERNANCE: &[u8] = b"gov/";
pub const NS_TX_LOOKUP: &[u8] = b"txl/";
pub const NS_INTEROP: &[u8] = b"int/";
pub const NS_ORACLE: &[u8] = b"orc/";
pub const NS_COMMIT: &[u8] = b"cmt/";
pub const NS_SEEN_TX: &[u8] = b"stx/";

pub const TABLE_META: &str = "sys_meta";
pub const TABLE_BLOCKS: &str = "ns_blocks";
pub const TABLE_BLOCK_META: &str = "ns_block_meta";
pub const TABLE_CONSENSUS_META: &str = "ns_consensus_meta";
pub const TABLE_STATE: &str = "ns_state";
pub const TABLE_VALIDATOR_HISTORY: &str = "ns_validator_history";
pub const TABLE_EVIDENCE: &str = "ns_evidence";
pub const TABLE_GOVERNANCE: &str = "ns_governance";
pub const TABLE_TX_LOOKUP: &str = "ns_tx_lookup";
pub const TABLE_INTEROP: &str = "ns_interop";
pub const TABLE_NATIVE_ASSET: &str = "ns_native_asset";
pub const TABLE_ORACLE: &str = "ns_oracle";
pub const TABLE_COMMIT: &str = "ns_commit";
pub const TABLE_SEEN_TX: &str = "ns_seen_tx";

pub fn namespaced(prefix: &[u8], key: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(prefix.len() + key.len());
    out.extend_from_slice(prefix);
    out.extend_from_slice(key);
    out
}

pub fn state_object_prefix() -> &'static [u8] {
    NS_OBJECT
}

pub fn state_system_prefix() -> &'static [u8] {
    NS_SYSTEM
}

pub fn state_evidence_prefix() -> &'static [u8] {
    NS_EVIDENCE
}

pub fn state_asset_prefix() -> &'static [u8] {
    NS_ASSET
}

pub const ALL_TABLES: &[&str] = &[
    TABLE_META,
    TABLE_BLOCKS,
    TABLE_BLOCK_META,
    TABLE_CONSENSUS_META,
    TABLE_STATE,
    TABLE_VALIDATOR_HISTORY,
    TABLE_EVIDENCE,
    TABLE_GOVERNANCE,
    TABLE_TX_LOOKUP,
    TABLE_INTEROP,
    TABLE_NATIVE_ASSET,
    TABLE_ORACLE,
    TABLE_COMMIT,
    TABLE_SEEN_TX,
];
