//! Canonical SunRey Blockchain protocol types and SRCB v1 encoding.
//!
//! This crate is encoding and typed envelopes only. Hashing and signatures
//! are supplied by a [`DomainHasher`] implementation from the crypto crate.

mod block;
mod codec;
mod commitments;
mod genesis;
mod reject;
mod transaction;
mod vectors;

pub use block::{
    validate_block_header, BlockBody, BlockHeader, BlockId, BlockResult, RejectedTx,
    BLOCK_VERSION_V1,
};
pub use codec::{
    decode_bool, decode_bytes, decode_string, decode_u128, decode_u32, decode_u64, encode_bool,
    encode_bytes, encode_string, encode_u128, encode_u32, encode_u64, CodecError,
};
pub use commitments::{
    block_id, domain_payload, genesis_hash, merkle_root, state_root, transaction_id,
    transaction_root, unsigned_signature_payload, DomainHasher, HASH_SIZE,
};
pub use genesis::{
    local_dev_genesis, testnet_1_genesis, GenesisV1, NativeAssetDefinition, LOCAL_DEV_CHAIN_ID,
    LOCAL_DEV_NETWORK_ID, PROTOCOL_VERSION, SCHEMA_REGISTRY_DOCUMENT, SCHEMA_VERSION,
    SRCB_CODEC_ID, TESTNET_1_CHAIN_ID, TESTNET_1_NETWORK_ID,
};
pub use reject::RejectReason;
pub use transaction::{
    decode_evidence_anchor_payload, decode_system_payload, encode_evidence_anchor_payload,
    encode_system_payload, EvidenceAnchorPayload, SignatureDescriptor, SignedTransaction,
    SystemPayload, TransactionFamily, UnsignedTransaction, MAX_TX_BYTES,
};

pub const DOMAIN_TX_ID: &str = "sunrey.txid.v1";
pub const DOMAIN_SIG: &str = "sunrey.sig.v1";
pub const DOMAIN_BLOCK_ID: &str = "sunrey.blockid.v1";
pub const DOMAIN_GENESIS: &str = "sunrey.genesis.v1";
pub const DOMAIN_TX_ROOT: &str = "sunrey.txroot.v1";
pub const DOMAIN_STATE_ROOT: &str = "sunrey.stateroot.v1";
pub const DOMAIN_MERKLE: &str = "sunrey.merkle.v1";
pub const DOMAIN_LEAF: &str = "sunrey.leaf.v1";
pub const DOMAIN_VALSET: &str = "sunrey.valset.v1";
pub const DOMAIN_CONSENSUS_PARAMS: &str = "sunrey.consparams.v1";
pub const DOMAIN_SCHEMA: &str = "sunrey.schema.v1";
pub const DOMAIN_CRYPTO_POLICY: &str = "sunrey.cryptopolicy.v1";
pub const DOMAIN_MODULES: &str = "sunrey.modules.v1";
pub const DOMAIN_CODECS: &str = "sunrey.codecs.v1";
pub const DOMAIN_GOVERNANCE: &str = "sunrey.gov.plan.v1";
pub const DOMAIN_ORACLE: &str = "sunrey.oracle.v1";
pub const DOMAIN_NATIVE_ASSET: &str = "sunrey.nativeasset.v1";

pub type Hash32 = [u8; HASH_SIZE];

pub fn hex_encode(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

pub fn hex_decode(text: &str) -> Result<Vec<u8>, hex::FromHexError> {
    hex::decode(text)
}

pub fn hash_to_hex(hash: &Hash32) -> String {
    hex::encode(hash)
}

pub fn hash_from_hex(text: &str) -> Result<Hash32, RejectReason> {
    let bytes = hex::decode(text).map_err(|_| RejectReason::SchemaInvalid)?;
    bytes.try_into().map_err(|_| RejectReason::SchemaInvalid)
}
