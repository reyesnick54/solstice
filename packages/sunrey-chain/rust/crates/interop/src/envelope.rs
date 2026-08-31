//! Canonical, versioned, deterministic interop message envelope.
//!
//! Relayers submit envelopes; verification consumes the deterministic digest.
//! Business payload bytes are referenced by hash, not trusted from the relayer.

use serde::{Deserialize, Serialize};
use sunrey_protocol::{encode_bytes, encode_string, encode_u64, Hash32};

use crate::encoding::domain_hash;
use crate::error::InteropError;
use crate::types::ChannelType;
use crate::{DOMAIN_PACKET, INTEROP_PROTOCOL_VERSION};

pub const ENVELOPE_SCHEMA_VERSION: u32 = 1;
pub const DOMAIN_ENVELOPE: &str = "sunrey.interop.envelope.v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InteropFlowDirection {
    Inbound,
    Outbound,
}

impl InteropFlowDirection {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Inbound => "INBOUND",
            Self::Outbound => "OUTBOUND",
        }
    }
}

/// Deterministic cross-chain message envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteropMessageEnvelope {
    pub envelope_version: u32,
    pub protocol_version: String,
    pub direction: InteropFlowDirection,
    pub source_network: String,
    pub source_chain_id: String,
    pub source_tx_hash: String,
    pub source_event_index: u64,
    pub destination_chain_id: String,
    pub destination_channel: String,
    pub message_type: ChannelType,
    pub payload_hash: Hash32,
    pub message_nonce: u64,
    pub sequence: u64,
    pub expiry_height: u64,
    pub expiry_timestamp: u64,
    pub proof_reference: String,
    pub attestation_digest: String,
    pub domain: String,
}

impl InteropMessageEnvelope {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_u64(&mut out, self.envelope_version as u64);
        encode_string(&mut out, &self.protocol_version);
        encode_string(&mut out, self.direction.as_str());
        encode_string(&mut out, &self.source_network);
        encode_string(&mut out, &self.source_chain_id);
        encode_string(&mut out, &self.source_tx_hash);
        encode_u64(&mut out, self.source_event_index);
        encode_string(&mut out, &self.destination_chain_id);
        encode_string(&mut out, &self.destination_channel);
        encode_string(&mut out, self.message_type.as_str());
        encode_bytes(&mut out, &self.payload_hash);
        encode_u64(&mut out, self.message_nonce);
        encode_u64(&mut out, self.sequence);
        encode_u64(&mut out, self.expiry_height);
        encode_u64(&mut out, self.expiry_timestamp);
        encode_string(&mut out, &self.proof_reference);
        encode_string(&mut out, &self.attestation_digest);
        encode_string(&mut out, &self.domain);
        out
    }

    pub fn digest(&self) -> Hash32 {
        domain_hash(DOMAIN_ENVELOPE, &self.encode())
    }

    pub fn replay_key(&self) -> [u8; 32] {
        let mut payload = Vec::new();
        encode_string(&mut payload, &self.source_chain_id);
        encode_string(&mut payload, &self.source_tx_hash);
        encode_u64(&mut payload, self.source_event_index);
        encode_u64(&mut payload, self.message_nonce);
        encode_string(&mut payload, self.direction.as_str());
        domain_hash(DOMAIN_PACKET, &payload)
    }

    pub fn validate_structure(&self, now_unix: u64, height: u64) -> Result<(), InteropError> {
        if self.envelope_version != ENVELOPE_SCHEMA_VERSION {
            return Err(InteropError::UnsupportedMessageVersion);
        }
        if self.protocol_version != INTEROP_PROTOCOL_VERSION {
            return Err(InteropError::UnsupportedMessageVersion);
        }
        if self.expiry_height != 0 && height > self.expiry_height {
            return Err(InteropError::MessageExpired);
        }
        if self.expiry_timestamp != 0 && now_unix > self.expiry_timestamp {
            return Err(InteropError::MessageExpired);
        }
        if self.domain != DOMAIN_ENVELOPE {
            return Err(InteropError::SchemaInvalid);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn envelope_digest_is_deterministic() {
        let env = InteropMessageEnvelope {
            envelope_version: ENVELOPE_SCHEMA_VERSION,
            protocol_version: INTEROP_PROTOCOL_VERSION.to_string(),
            direction: InteropFlowDirection::Inbound,
            source_network: "net_external_dev".into(),
            source_chain_id: "chn_external_dev_bft".into(),
            source_tx_hash: "0xabc".into(),
            source_event_index: 0,
            destination_chain_id: "chn_sunrey_simulation".into(),
            destination_channel: "chan/0".into(),
            message_type: ChannelType::GenericMessage,
            payload_hash: [1u8; 32],
            message_nonce: 1,
            sequence: 0,
            expiry_height: 100,
            expiry_timestamp: 1_800_000_000,
            proof_reference: "proof-1".into(),
            attestation_digest: "att-1".into(),
            domain: DOMAIN_ENVELOPE.to_string(),
        };
        let a = env.digest();
        let b = env.digest();
        assert_eq!(a, b);
        assert_ne!(a, [0u8; 32]);
    }
}
