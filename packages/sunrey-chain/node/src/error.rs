use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum NodeError {
    #[error("codec: {0}")]
    Codec(String),
    #[error("handshake rejected: {reason}")]
    HandshakeRejected { reason: HandshakeRejectReason },
    #[error("identity: {0}")]
    Identity(String),
    #[error("mempool: {0}")]
    Mempool(String),
    #[error("validation: {0}")]
    Validation(String),
    #[error("sync: {0}")]
    Sync(String),
    #[error("peer: {0}")]
    Peer(String),
    #[error("store: {0}")]
    Store(String),
    #[error("transport: {0}")]
    Transport(String),
    #[error("forbidden: {0}")]
    Forbidden(String),
    #[error("fork detected")]
    ForkDetected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HandshakeRejectReason {
    NetworkMismatch,
    ChainMismatch,
    GenesisMismatch,
    ProtocolVersion,
    CodecVersion,
    CryptoSuite,
    BadSignature,
    Replay,
    ClockSkew,
    DuplicateIdentity,
    SelfConnection,
    AllowList,
    Banned,
    Malformed,
}

impl std::fmt::Display for HandshakeRejectReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl HandshakeRejectReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NetworkMismatch => "network_mismatch",
            Self::ChainMismatch => "chain_mismatch",
            Self::GenesisMismatch => "genesis_mismatch",
            Self::ProtocolVersion => "protocol_version",
            Self::CodecVersion => "codec_version",
            Self::CryptoSuite => "crypto_suite",
            Self::BadSignature => "bad_signature",
            Self::Replay => "replay",
            Self::ClockSkew => "clock_skew",
            Self::DuplicateIdentity => "duplicate_identity",
            Self::SelfConnection => "self_connection",
            Self::AllowList => "allow_list",
            Self::Banned => "banned",
            Self::Malformed => "malformed",
        }
    }
}

pub type NodeResult<T> = Result<T, NodeError>;
