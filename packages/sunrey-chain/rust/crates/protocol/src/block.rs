use serde::{Deserialize, Serialize};

use crate::codec::{
    decode_bytes, decode_string, decode_u32, decode_u64, encode_bytes, encode_string, encode_u32,
    encode_u64,
};
use crate::transaction::SignedTransaction;
use crate::{hash_from_hex, hash_to_hex, Hash32, RejectReason};

pub const BLOCK_VERSION_V1: u32 = 1;
const HEADER_TAG: &str = "BlockHeaderV1";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockHeader {
    pub version: u32,
    pub network_id: String,
    pub chain_id: String,
    pub height: u64,
    pub parent_block_id: Hash32,
    pub transaction_root: Hash32,
    pub app_hash: Hash32,
    pub validator_set_hash: Hash32,
    pub consensus_parameter_hash: Hash32,
    pub timestamp_unix_ms: u64,
    pub proposer: String,
    pub crypto_suite_id: String,
}

impl BlockHeader {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, HEADER_TAG);
        encode_u32(&mut out, self.version);
        encode_string(&mut out, &self.network_id);
        encode_string(&mut out, &self.chain_id);
        encode_u64(&mut out, self.height);
        encode_bytes(&mut out, &self.parent_block_id);
        encode_bytes(&mut out, &self.transaction_root);
        encode_bytes(&mut out, &self.app_hash);
        encode_bytes(&mut out, &self.validator_set_hash);
        encode_bytes(&mut out, &self.consensus_parameter_hash);
        encode_u64(&mut out, self.timestamp_unix_ms);
        encode_string(&mut out, &self.proposer);
        encode_string(&mut out, &self.crypto_suite_id);
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, RejectReason> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        if tag != HEADER_TAG {
            return Err(RejectReason::UnsupportedVersion);
        }
        let version = decode_u32(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let network_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let chain_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let height = decode_u64(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let parent_block_id = decode_hash(&mut input)?;
        let transaction_root = decode_hash(&mut input)?;
        let app_hash = decode_hash(&mut input)?;
        let validator_set_hash = decode_hash(&mut input)?;
        let consensus_parameter_hash = decode_hash(&mut input)?;
        let timestamp_unix_ms = decode_u64(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let proposer = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let crypto_suite_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        if !input.is_empty() {
            return Err(RejectReason::SchemaInvalid);
        }
        Ok(Self {
            version,
            network_id,
            chain_id,
            height,
            parent_block_id,
            transaction_root,
            app_hash,
            validator_set_hash,
            consensus_parameter_hash,
            timestamp_unix_ms,
            proposer,
            crypto_suite_id,
        })
    }
}

fn decode_hash(input: &mut &[u8]) -> Result<Hash32, RejectReason> {
    let bytes = decode_bytes(input).map_err(|_| RejectReason::DecodeFailed)?;
    bytes.try_into().map_err(|_| RejectReason::SchemaInvalid)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockId(pub Hash32);

impl BlockId {
    pub fn hex(&self) -> String {
        hash_to_hex(&self.0)
    }

    pub fn from_hex(text: &str) -> Result<Self, RejectReason> {
        Ok(Self(hash_from_hex(text)?))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockBody {
    pub transactions: Vec<SignedTransaction>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockResult {
    pub height: u64,
    pub block_id: String,
    pub transaction_root: String,
    pub app_hash: String,
    pub tx_ids: Vec<String>,
    pub rejected: Vec<RejectedTx>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RejectedTx {
    pub tx_id: String,
    pub reason: String,
}

pub fn validate_block_header(
    header: &BlockHeader,
    expected_network: &str,
    expected_chain: &str,
    expected_height: u64,
    expected_parent: &Hash32,
    expected_tx_root: &Hash32,
    expected_app_hash: &Hash32,
) -> Result<(), RejectReason> {
    if header.version != BLOCK_VERSION_V1 {
        return Err(RejectReason::UnsupportedVersion);
    }
    if header.network_id != expected_network {
        return Err(RejectReason::WrongNetwork);
    }
    if header.chain_id != expected_chain {
        return Err(RejectReason::WrongChain);
    }
    if header.height != expected_height {
        return Err(RejectReason::IncorrectHeight);
    }
    if &header.parent_block_id != expected_parent {
        return Err(RejectReason::IncorrectParent);
    }
    if &header.transaction_root != expected_tx_root {
        return Err(RejectReason::WrongTransactionRoot);
    }
    if &header.app_hash != expected_app_hash {
        return Err(RejectReason::WrongStateRoot);
    }
    Ok(())
}
