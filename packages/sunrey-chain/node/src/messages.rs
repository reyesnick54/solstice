use crate::chain::{Block, Transaction};
use crate::codec::{Reader, Writer};
use crate::consensus::messages::ConsensusMessage;
use crate::error::{NodeError, NodeResult};
use crate::evidence::EquivocationEvidence;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageType {
    Handshake = 1,
    Disconnect = 2,
    Ping = 3,
    Pong = 4,
    TxAnnounce = 10,
    TxRequest = 11,
    TxResponse = 12,
    BlockAnnounce = 20,
    BlockRequest = 21,
    BlockResponse = 22,
    SyncRequest = 30,
    SyncResponse = 31,
    Consensus = 40,
    EvidenceAnnounce = 50,
    EvidenceRequest = 51,
    EvidenceResponse = 52,
}

impl MessageType {
    pub fn from_u8(value: u8) -> NodeResult<Self> {
        match value {
            1 => Ok(Self::Handshake),
            2 => Ok(Self::Disconnect),
            3 => Ok(Self::Ping),
            4 => Ok(Self::Pong),
            10 => Ok(Self::TxAnnounce),
            11 => Ok(Self::TxRequest),
            12 => Ok(Self::TxResponse),
            20 => Ok(Self::BlockAnnounce),
            21 => Ok(Self::BlockRequest),
            22 => Ok(Self::BlockResponse),
            30 => Ok(Self::SyncRequest),
            31 => Ok(Self::SyncResponse),
            40 => Ok(Self::Consensus),
            50 => Ok(Self::EvidenceAnnounce),
            51 => Ok(Self::EvidenceRequest),
            52 => Ok(Self::EvidenceResponse),
            _ => Err(NodeError::Codec(format!("unknown message type {value}"))),
        }
    }
}

#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NetMessage {
    Handshake(Vec<u8>),
    Disconnect { reason: String },
    Ping { nonce: u64 },
    Pong { nonce: u64 },
    TxAnnounce { tx_id: [u8; 32] },
    TxRequest { tx_id: [u8; 32] },
    TxResponse { tx: Transaction },
    BlockAnnounce { height: u64, block_id: [u8; 32] },
    BlockRequest { height: u64 },
    BlockResponse { block: Block },
    SyncRequest { from_height: u64, to_height: u64 },
    SyncResponse { blocks: Vec<Block> },
    Consensus(ConsensusMessage),
    EvidenceAnnounce { evidence_id: [u8; 32] },
    EvidenceRequest { evidence_id: [u8; 32] },
    EvidenceResponse { evidence: EquivocationEvidence },
}

impl NetMessage {
    pub fn ty(&self) -> MessageType {
        match self {
            Self::Handshake(_) => MessageType::Handshake,
            Self::Disconnect { .. } => MessageType::Disconnect,
            Self::Ping { .. } => MessageType::Ping,
            Self::Pong { .. } => MessageType::Pong,
            Self::TxAnnounce { .. } => MessageType::TxAnnounce,
            Self::TxRequest { .. } => MessageType::TxRequest,
            Self::TxResponse { .. } => MessageType::TxResponse,
            Self::BlockAnnounce { .. } => MessageType::BlockAnnounce,
            Self::BlockRequest { .. } => MessageType::BlockRequest,
            Self::BlockResponse { .. } => MessageType::BlockResponse,
            Self::SyncRequest { .. } => MessageType::SyncRequest,
            Self::SyncResponse { .. } => MessageType::SyncResponse,
            Self::Consensus(_) => MessageType::Consensus,
            Self::EvidenceAnnounce { .. } => MessageType::EvidenceAnnounce,
            Self::EvidenceRequest { .. } => MessageType::EvidenceRequest,
            Self::EvidenceResponse { .. } => MessageType::EvidenceResponse,
        }
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(self.ty() as u8);
        w.u16(1);
        match self {
            Self::Handshake(bytes) => w.bytes(bytes)?,
            Self::Disconnect { reason } => w.string(reason)?,
            Self::Ping { nonce } | Self::Pong { nonce } => w.u64(*nonce),
            Self::TxAnnounce { tx_id } | Self::TxRequest { tx_id } => w.bytes32(tx_id),
            Self::TxResponse { tx } => w.bytes(&tx.encode()?)?,
            Self::BlockAnnounce { height, block_id } => {
                w.u64(*height);
                w.bytes32(block_id);
            }
            Self::BlockRequest { height } => w.u64(*height),
            Self::BlockResponse { block } => w.bytes(&block.encode()?)?,
            Self::SyncRequest {
                from_height,
                to_height,
            } => {
                w.u64(*from_height);
                w.u64(*to_height);
            }
            Self::SyncResponse { blocks } => {
                w.u32(blocks.len() as u32);
                for block in blocks {
                    w.bytes(&block.encode()?)?;
                }
            }
            Self::Consensus(message) => w.bytes(&message.encode()?)?,
            Self::EvidenceAnnounce { evidence_id } | Self::EvidenceRequest { evidence_id } => {
                w.bytes32(evidence_id);
            }
            Self::EvidenceResponse { evidence } => w.bytes(&evidence.encode()?)?,
        }
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        let ty = MessageType::from_u8(r.u8()?)?;
        let schema = r.u16()?;
        if schema != 1 {
            return Err(NodeError::Codec("unsupported message schema".into()));
        }
        let msg = match ty {
            MessageType::Handshake => Self::Handshake(r.bytes()?),
            MessageType::Disconnect => Self::Disconnect {
                reason: r.string()?,
            },
            MessageType::Ping => Self::Ping { nonce: r.u64()? },
            MessageType::Pong => Self::Pong { nonce: r.u64()? },
            MessageType::TxAnnounce => Self::TxAnnounce {
                tx_id: r.bytes32()?,
            },
            MessageType::TxRequest => Self::TxRequest {
                tx_id: r.bytes32()?,
            },
            MessageType::TxResponse => Self::TxResponse {
                tx: Transaction::decode(&r.bytes()?)?,
            },
            MessageType::BlockAnnounce => Self::BlockAnnounce {
                height: r.u64()?,
                block_id: r.bytes32()?,
            },
            MessageType::BlockRequest => Self::BlockRequest { height: r.u64()? },
            MessageType::BlockResponse => Self::BlockResponse {
                block: Block::decode(&r.bytes()?)?,
            },
            MessageType::SyncRequest => Self::SyncRequest {
                from_height: r.u64()?,
                to_height: r.u64()?,
            },
            MessageType::SyncResponse => {
                let count = r.u32()? as usize;
                if count > 64 {
                    return Err(NodeError::Codec("excessive sync response".into()));
                }
                let mut blocks = Vec::with_capacity(count);
                for _ in 0..count {
                    blocks.push(Block::decode(&r.bytes()?)?);
                }
                Self::SyncResponse { blocks }
            }
            MessageType::Consensus => Self::Consensus(ConsensusMessage::decode(&r.bytes()?)?),
            MessageType::EvidenceAnnounce => Self::EvidenceAnnounce {
                evidence_id: r.bytes32()?,
            },
            MessageType::EvidenceRequest => Self::EvidenceRequest {
                evidence_id: r.bytes32()?,
            },
            MessageType::EvidenceResponse => Self::EvidenceResponse {
                evidence: EquivocationEvidence::decode(&r.bytes()?)?,
            },
        };
        r.finish()?;
        Ok(msg)
    }
}

pub fn decode_handshake_payload(bytes: &[u8]) -> NodeResult<crate::handshake::HandshakeHello> {
    crate::handshake::HandshakeHello::decode(bytes)
}

pub fn decode_tx_gossip(bytes: &[u8]) -> NodeResult<NetMessage> {
    let msg = NetMessage::decode(bytes)?;
    match msg {
        NetMessage::TxAnnounce { .. }
        | NetMessage::TxRequest { .. }
        | NetMessage::TxResponse { .. } => Ok(msg),
        _ => Err(NodeError::Codec("not a transaction gossip message".into())),
    }
}

pub fn decode_block_gossip(bytes: &[u8]) -> NodeResult<NetMessage> {
    let msg = NetMessage::decode(bytes)?;
    match msg {
        NetMessage::BlockAnnounce { .. }
        | NetMessage::BlockRequest { .. }
        | NetMessage::BlockResponse { .. } => Ok(msg),
        _ => Err(NodeError::Codec("not a block gossip message".into())),
    }
}

pub fn decode_sync_response(bytes: &[u8]) -> NodeResult<NetMessage> {
    let msg = NetMessage::decode(bytes)?;
    match msg {
        NetMessage::SyncResponse { .. } | NetMessage::SyncRequest { .. } => Ok(msg),
        _ => Err(NodeError::Codec("not a sync message".into())),
    }
}
