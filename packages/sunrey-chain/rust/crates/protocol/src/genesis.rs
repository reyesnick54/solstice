use serde::{Deserialize, Serialize};

use crate::codec::{
    decode_bool, decode_bytes, decode_string, decode_u32, decode_u64, encode_bool, encode_bytes,
    encode_string, encode_u32, encode_u64,
};
use crate::transaction::TransactionFamily;
use crate::RejectReason;

pub const LOCAL_DEV_NETWORK_ID: &str = "net_sunrey_local_dev";
pub const LOCAL_DEV_CHAIN_ID: &str = "chn_sunrey_local_dev";
pub const TESTNET_1_NETWORK_ID: &str = "net_sunrey_testnet_1";
pub const TESTNET_1_CHAIN_ID: &str = "chn_sunrey_testnet_1";
pub const PROTOCOL_VERSION: &str = "1";
pub const SRCB_CODEC_ID: &str = "srcb.v1";
pub const SCHEMA_VERSION: u32 = 1;
const GENESIS_TAG: &str = "GenesisV1";

/// Canonical schema registry document hashed into genesis.
pub const SCHEMA_REGISTRY_DOCUMENT: &str = include_str!("../../../../schemas/srcb-v1.json");

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NativeAssetDefinition {
    pub asset_id: String,
    pub ticker_status: String,
    pub genesis_supply: u64,
    pub implemented: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GenesisV1 {
    pub network_id: String,
    pub chain_id: String,
    pub protocol_version: String,
    pub codec_id: String,
    pub schema_registry_hash: Vec<u8>,
    pub crypto_policy_id: String,
    pub state_schema_version: u32,
    pub genesis_time_unix_ms: u64,
    pub block_interval_ms: u64,
    pub max_tx_bytes: u32,
    pub max_block_txs: u32,
    pub queue_bound: u32,
    pub validator_placeholder: String,
    pub native_assets: Vec<NativeAssetDefinition>,
    pub activated_families: Vec<TransactionFamily>,
    pub production_network_enabled: bool,
    pub environment: String,
}

impl GenesisV1 {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, GENESIS_TAG);
        encode_string(&mut out, &self.network_id);
        encode_string(&mut out, &self.chain_id);
        encode_string(&mut out, &self.protocol_version);
        encode_string(&mut out, &self.codec_id);
        encode_bytes(&mut out, &self.schema_registry_hash);
        encode_string(&mut out, &self.crypto_policy_id);
        encode_u32(&mut out, self.state_schema_version);
        encode_u64(&mut out, self.genesis_time_unix_ms);
        encode_u64(&mut out, self.block_interval_ms);
        encode_u32(&mut out, self.max_tx_bytes);
        encode_u32(&mut out, self.max_block_txs);
        encode_u32(&mut out, self.queue_bound);
        encode_string(&mut out, &self.validator_placeholder);
        encode_u32(&mut out, self.native_assets.len() as u32);
        for asset in &self.native_assets {
            encode_string(&mut out, &asset.asset_id);
            encode_string(&mut out, &asset.ticker_status);
            encode_u64(&mut out, asset.genesis_supply);
            encode_bool(&mut out, asset.implemented);
        }
        encode_u32(&mut out, self.activated_families.len() as u32);
        for family in &self.activated_families {
            encode_string(&mut out, family.as_str());
        }
        encode_bool(&mut out, self.production_network_enabled);
        encode_string(&mut out, &self.environment);
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, RejectReason> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        if tag != GENESIS_TAG {
            return Err(RejectReason::UnsupportedVersion);
        }
        let network_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let chain_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let protocol_version = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let codec_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let schema_registry_hash =
            decode_bytes(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let crypto_policy_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let state_schema_version =
            decode_u32(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let genesis_time_unix_ms =
            decode_u64(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let block_interval_ms = decode_u64(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let max_tx_bytes = decode_u32(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let max_block_txs = decode_u32(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let queue_bound = decode_u32(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let validator_placeholder =
            decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let asset_count = decode_u32(&mut input).map_err(|_| RejectReason::DecodeFailed)? as usize;
        let mut native_assets = Vec::with_capacity(asset_count);
        for _ in 0..asset_count {
            native_assets.push(NativeAssetDefinition {
                asset_id: decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?,
                ticker_status: decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?,
                genesis_supply: decode_u64(&mut input).map_err(|_| RejectReason::DecodeFailed)?,
                implemented: decode_bool(&mut input).map_err(|_| RejectReason::DecodeFailed)?,
            });
        }
        let family_count = decode_u32(&mut input).map_err(|_| RejectReason::DecodeFailed)? as usize;
        let mut activated_families = Vec::with_capacity(family_count);
        for _ in 0..family_count {
            activated_families.push(TransactionFamily::parse(
                &decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?,
            )?);
        }
        let production_network_enabled =
            decode_bool(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let environment = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        if !input.is_empty() {
            return Err(RejectReason::SchemaInvalid);
        }
        if production_network_enabled {
            return Err(RejectReason::StatelessInvalid);
        }
        Ok(Self {
            network_id,
            chain_id,
            protocol_version,
            codec_id,
            schema_registry_hash,
            crypto_policy_id,
            state_schema_version,
            genesis_time_unix_ms,
            block_interval_ms,
            max_tx_bytes,
            max_block_txs,
            queue_bound,
            validator_placeholder,
            native_assets,
            activated_families,
            production_network_enabled,
            environment,
        })
    }

    pub fn family_activated(&self, family: TransactionFamily) -> bool {
        self.activated_families.contains(&family)
    }
}

pub fn local_dev_genesis(schema_registry_hash: Vec<u8>, crypto_policy_id: String) -> GenesisV1 {
    GenesisV1 {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        protocol_version: PROTOCOL_VERSION.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_registry_hash,
        crypto_policy_id,
        state_schema_version: SCHEMA_VERSION,
        genesis_time_unix_ms: 1_700_000_000_000,
        block_interval_ms: 1_000,
        max_tx_bytes: crate::MAX_TX_BYTES,
        max_block_txs: 32,
        queue_bound: 128,
        validator_placeholder: "DEV_BLOCK_PRODUCER".to_string(),
        native_assets: vec![
            NativeAssetDefinition {
                asset_id: "SUNREY_COIN".to_string(),
                ticker_status: "NOT_ASSIGNED".to_string(),
                genesis_supply: 0,
                implemented: true,
            },
            NativeAssetDefinition {
                asset_id: "MOONREY_COIN".to_string(),
                ticker_status: "NOT_ASSIGNED".to_string(),
                genesis_supply: 0,
                implemented: true,
            },
        ],
        activated_families: vec![
            TransactionFamily::System,
            TransactionFamily::EvidenceAnchor,
            TransactionFamily::Oracle,
            TransactionFamily::NativeAsset,
        ],
        production_network_enabled: false,
        environment: "simulation".to_string(),
    }
}

pub fn testnet_1_genesis(schema_registry_hash: Vec<u8>, crypto_policy_id: String) -> GenesisV1 {
    let mut genesis = local_dev_genesis(schema_registry_hash, crypto_policy_id);
    genesis.network_id = TESTNET_1_NETWORK_ID.to_string();
    genesis.chain_id = TESTNET_1_CHAIN_ID.to_string();
    genesis.validator_placeholder = "TESTNET_1_SEVEN_VALIDATOR_SET".to_string();
    genesis
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn testnet_genesis_is_deterministic_and_not_local_dev() {
        let a = testnet_1_genesis(vec![1, 2, 3], "cs_ed25519_sha256_v1".into());
        let b = testnet_1_genesis(vec![1, 2, 3], "cs_ed25519_sha256_v1".into());
        assert_eq!(a.encode(), b.encode());
        assert_eq!(a.network_id, TESTNET_1_NETWORK_ID);
        assert_ne!(a.network_id, LOCAL_DEV_NETWORK_ID);
        assert!(!a.production_network_enabled);
        assert_eq!(a.environment, "simulation");
        assert_eq!(a.native_assets.len(), 2);
        assert!(a.native_assets.iter().all(|asset| asset.ticker_status == "NOT_ASSIGNED"));
    }
}
