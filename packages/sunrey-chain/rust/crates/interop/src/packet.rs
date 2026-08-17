use serde::{Deserialize, Serialize};
use sunrey_protocol::{encode_bytes, encode_string, encode_u64, Hash32};

use crate::encoding::domain_hash;
use crate::error::InteropError;
use crate::ids::InterchainPacketId;
use crate::types::{ChannelType, PacketLifecycle};
use crate::DOMAIN_PACKET;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterchainPacket {
    pub sequence: u64,
    pub source_chain: String,
    pub source_channel: String,
    pub destination_chain: String,
    pub destination_channel: String,
    pub packet_type: ChannelType,
    pub payload: Vec<u8>,
    pub timeout_height: u64,
    pub timeout_timestamp: u64,
    pub sender: String,
    pub receiver: String,
    pub protocol_version: String,
}

impl InterchainPacket {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_u64(&mut out, self.sequence);
        encode_string(&mut out, &self.source_chain);
        encode_string(&mut out, &self.source_channel);
        encode_string(&mut out, &self.destination_chain);
        encode_string(&mut out, &self.destination_channel);
        encode_string(&mut out, self.packet_type.as_str());
        encode_bytes(&mut out, &self.payload);
        encode_u64(&mut out, self.timeout_height);
        encode_u64(&mut out, self.timeout_timestamp);
        encode_string(&mut out, &self.sender);
        encode_string(&mut out, &self.receiver);
        encode_string(&mut out, &self.protocol_version);
        out
    }

    pub fn payload_commitment(&self) -> Hash32 {
        domain_hash(DOMAIN_PACKET, &self.encode())
    }

    pub fn packet_id(&self) -> InterchainPacketId {
        InterchainPacketId::new(
            &self.source_chain,
            &self.destination_chain,
            &self.source_channel,
            self.sequence,
        )
    }

    pub fn replay_key(&self) -> [u8; 32] {
        self.packet_id().replay_key(self.packet_type.as_str())
    }

    pub fn bind_matches(
        &self,
        source: &str,
        dest: &str,
        version: &str,
    ) -> Result<(), InteropError> {
        if self.source_chain != source || self.destination_chain != dest {
            return Err(InteropError::WrongExternalChainId);
        }
        if self.protocol_version != version {
            return Err(InteropError::SchemaInvalid);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacketRecord {
    pub packet: InterchainPacket,
    pub commitment: Hash32,
    pub lifecycle: PacketLifecycle,
    pub acknowledgement: Option<Vec<u8>>,
}

impl PacketRecord {
    pub fn ack_commitment(&self) -> Option<Hash32> {
        self.acknowledgement.as_ref().map(|ack| domain_hash(crate::DOMAIN_ACK, ack))
    }
}

pub fn acknowledgement_bytes(packet: &InterchainPacket, result: &str) -> Vec<u8> {
    let mut out = Vec::new();
    encode_bytes(&mut out, &packet.payload_commitment());
    encode_string(&mut out, result);
    encode_string(&mut out, &packet.source_chain);
    encode_string(&mut out, &packet.destination_chain);
    encode_u64(&mut out, packet.sequence);
    out
}
