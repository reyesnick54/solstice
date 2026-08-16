use serde::{Deserialize, Serialize};
use sunrey_protocol::{encode_string, encode_u64};

use crate::encoding::domain_hash;
use crate::error::InteropError;
use crate::DOMAIN_ID;

const PROTOCOL_VERSION: &str = crate::INTEROP_PROTOCOL_VERSION;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct InterchainClientId {
    pub source_chain: String,
    pub destination_chain: String,
    pub protocol_version: String,
    pub local_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct InterchainConnectionId {
    pub source_chain: String,
    pub destination_chain: String,
    pub protocol_version: String,
    pub local_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct InterchainChannelId {
    pub source_chain: String,
    pub destination_chain: String,
    pub protocol_version: String,
    pub connection_id: String,
    pub local_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct InterchainPacketId {
    pub source_chain: String,
    pub destination_chain: String,
    pub protocol_version: String,
    pub channel_id: String,
    pub sequence: u64,
}

fn bind4(kind: &str, a: &str, b: &str, c: &str, d: &str) -> String {
    format!("{kind}/{a}/{b}/{c}/{d}")
}

impl InterchainClientId {
    pub fn new(
        source_chain: impl Into<String>,
        destination_chain: impl Into<String>,
        local_id: impl Into<String>,
    ) -> Self {
        Self {
            source_chain: source_chain.into(),
            destination_chain: destination_chain.into(),
            protocol_version: PROTOCOL_VERSION.to_string(),
            local_id: local_id.into(),
        }
    }

    pub fn canonical(&self) -> String {
        bind4(
            "ic",
            &self.source_chain,
            &self.destination_chain,
            &self.protocol_version,
            &self.local_id,
        )
    }

    pub fn encode(&self) -> Vec<u8> {
        encode_bound(
            "client",
            &self.source_chain,
            &self.destination_chain,
            &self.protocol_version,
            &self.local_id,
            None,
        )
    }
}

impl InterchainConnectionId {
    pub fn new(
        source_chain: impl Into<String>,
        destination_chain: impl Into<String>,
        local_id: impl Into<String>,
    ) -> Self {
        Self {
            source_chain: source_chain.into(),
            destination_chain: destination_chain.into(),
            protocol_version: PROTOCOL_VERSION.to_string(),
            local_id: local_id.into(),
        }
    }

    pub fn canonical(&self) -> String {
        bind4(
            "conn",
            &self.source_chain,
            &self.destination_chain,
            &self.protocol_version,
            &self.local_id,
        )
    }
}

impl InterchainChannelId {
    pub fn new(
        source_chain: impl Into<String>,
        destination_chain: impl Into<String>,
        connection_id: impl Into<String>,
        local_id: impl Into<String>,
    ) -> Self {
        Self {
            source_chain: source_chain.into(),
            destination_chain: destination_chain.into(),
            protocol_version: PROTOCOL_VERSION.to_string(),
            connection_id: connection_id.into(),
            local_id: local_id.into(),
        }
    }

    pub fn canonical(&self) -> String {
        format!(
            "chan/{}/{}/{}/{}/{}",
            self.source_chain,
            self.destination_chain,
            self.protocol_version,
            self.connection_id,
            self.local_id
        )
    }
}

impl InterchainPacketId {
    pub fn new(
        source_chain: impl Into<String>,
        destination_chain: impl Into<String>,
        channel_id: impl Into<String>,
        sequence: u64,
    ) -> Self {
        Self {
            source_chain: source_chain.into(),
            destination_chain: destination_chain.into(),
            protocol_version: PROTOCOL_VERSION.to_string(),
            channel_id: channel_id.into(),
            sequence,
        }
    }

    pub fn canonical(&self) -> String {
        format!(
            "pkt/{}/{}/{}/{}/{}",
            self.source_chain,
            self.destination_chain,
            self.protocol_version,
            self.channel_id,
            self.sequence
        )
    }

    pub fn replay_key(&self, packet_type: &str) -> [u8; 32] {
        let mut payload = Vec::new();
        encode_string(&mut payload, &self.source_chain);
        encode_string(&mut payload, &self.destination_chain);
        encode_string(&mut payload, &self.protocol_version);
        encode_string(&mut payload, &self.channel_id);
        encode_u64(&mut payload, self.sequence);
        encode_string(&mut payload, packet_type);
        domain_hash(DOMAIN_ID, &payload)
    }
}

fn encode_bound(
    kind: &str,
    source: &str,
    dest: &str,
    version: &str,
    local: &str,
    extra: Option<&str>,
) -> Vec<u8> {
    let mut out = Vec::new();
    encode_string(&mut out, kind);
    encode_string(&mut out, source);
    encode_string(&mut out, dest);
    encode_string(&mut out, version);
    encode_string(&mut out, local);
    if let Some(extra) = extra {
        encode_string(&mut out, extra);
    }
    out
}

pub fn require_bound_chains(
    expected_source: &str,
    expected_dest: &str,
    source: &str,
    dest: &str,
) -> Result<(), InteropError> {
    if source != expected_source {
        return Err(InteropError::WrongExternalChainId);
    }
    if dest != expected_dest {
        return Err(InteropError::WrongExternalChainId);
    }
    Ok(())
}
