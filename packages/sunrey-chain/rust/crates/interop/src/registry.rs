use serde::{Deserialize, Serialize};
use sunrey_protocol::{encode_string, encode_u32, encode_u64};

use crate::encoding::domain_hash;
use crate::error::InteropError;
use crate::types::{ChainStatus, ClientType, FinalityModel, InteropCapability};
use crate::DOMAIN_REGISTRY;

pub const REGISTRY_SCHEMA_VERSION: u32 = 1;
pub const SUNREY_CHAIN_ID: &str = "chn_sunrey_simulation";
pub const EXTERNAL_DEV_CHAIN_ID: &str = "chn_external_dev_bft";
pub const EXTERNAL_DEV_NETWORK_ID: &str = "net_external_dev";
pub const EXTERNAL_DEV_DISPLAY: &str = "ExternalDevChain";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalChainDefinition {
    pub external_chain_id: String,
    pub display_name: String,
    pub chain_family: String,
    pub finality_model: FinalityModel,
    pub client_type: ClientType,
    pub genesis_hash: String,
    pub trust_anchor: String,
    pub proof_system: String,
    pub expected_block_format: String,
    pub timeout_policy: String,
    pub minimum_finality_rule: String,
    pub allowed_capabilities: Vec<InteropCapability>,
    pub status: ChainStatus,
    pub activation_height: u64,
    pub schema_version: u32,
}

impl ExternalChainDefinition {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, &self.external_chain_id);
        encode_string(&mut out, &self.display_name);
        encode_string(&mut out, &self.chain_family);
        encode_string(&mut out, self.finality_model.as_str());
        encode_string(&mut out, self.client_type.as_str());
        encode_string(&mut out, &self.genesis_hash);
        encode_string(&mut out, &self.trust_anchor);
        encode_string(&mut out, &self.proof_system);
        encode_string(&mut out, &self.expected_block_format);
        encode_string(&mut out, &self.timeout_policy);
        encode_string(&mut out, &self.minimum_finality_rule);
        encode_u32(&mut out, self.allowed_capabilities.len() as u32);
        for cap in &self.allowed_capabilities {
            encode_string(&mut out, cap.as_str());
        }
        encode_string(&mut out, self.status.as_str());
        encode_u64(&mut out, self.activation_height);
        encode_u32(&mut out, self.schema_version);
        out
    }

    pub fn digest(&self) -> [u8; 32] {
        domain_hash(DOMAIN_REGISTRY, &self.encode())
    }

    pub fn require_usable(&self) -> Result<(), InteropError> {
        if !self.status.may_verify() {
            return Err(InteropError::StatusNotActivatable);
        }
        Ok(())
    }

    pub fn allows(&self, capability: InteropCapability) -> Result<(), InteropError> {
        if self.allowed_capabilities.contains(&capability) {
            Ok(())
        } else {
            Err(InteropError::CapabilityDenied)
        }
    }
}

pub fn development_external_chain(
    genesis_hash: String,
    trust_anchor: String,
) -> ExternalChainDefinition {
    ExternalChainDefinition {
        external_chain_id: EXTERNAL_DEV_CHAIN_ID.to_string(),
        display_name: EXTERNAL_DEV_DISPLAY.to_string(),
        chain_family: "SIMULATED_BFT".to_string(),
        finality_model: FinalityModel::SimulatedDeterministicBftExternalChain,
        client_type: ClientType::SimulatedDeterministicBft,
        genesis_hash,
        trust_anchor,
        proof_system: "SORTED_MERKLE_V1".to_string(),
        expected_block_format: "EXTERNAL_DEV_HEADER_V1".to_string(),
        timeout_policy: "FAIL_CLOSED_HEIGHT_OR_TIMESTAMP".to_string(),
        minimum_finality_rule: "QUORUM_2F_PLUS_1".to_string(),
        allowed_capabilities: vec![
            InteropCapability::GenericMessage,
            InteropCapability::OracleFact,
            InteropCapability::AssetTransferDevOnly,
            InteropCapability::IdentityAttestation,
            InteropCapability::EconomicAttestation,
        ],
        status: ChainStatus::Draft,
        activation_height: 0,
        schema_version: REGISTRY_SCHEMA_VERSION,
    }
}
