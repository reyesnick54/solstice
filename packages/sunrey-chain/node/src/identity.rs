use std::net::SocketAddr;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::crypto::{sha256, DomainKey, KeyDomain};
use crate::error::{NodeError, NodeResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct NodeId(pub [u8; 32]);

impl NodeId {
    pub fn from_public_key(public_key: &PeerPublicKey) -> Self {
        Self(sha256(&public_key.0))
    }

    pub fn hex(self) -> String {
        hex::encode(self.0)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PeerPublicKey(pub [u8; 32]);

impl PeerPublicKey {
    pub fn hex(self) -> String {
        hex::encode(self.0)
    }
}

#[derive(Clone)]
pub struct PeerIdentity {
    pub node_id: NodeId,
    pub public_key: PeerPublicKey,
    key: DomainKey,
}

impl PeerIdentity {
    pub fn generate() -> Self {
        let key = DomainKey::generate(KeyDomain::P2pNode);
        let public_key = PeerPublicKey(key.public_key());
        Self {
            node_id: NodeId::from_public_key(&public_key),
            public_key,
            key,
        }
    }

    pub fn from_seed(seed: [u8; 32]) -> Self {
        let key = DomainKey::from_seed(KeyDomain::P2pNode, seed);
        let public_key = PeerPublicKey(key.public_key());
        Self {
            node_id: NodeId::from_public_key(&public_key),
            public_key,
            key,
        }
    }

    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        self.key.sign(message)
    }

    pub fn seed_bytes(&self) -> [u8; 32] {
        self.key.seed_bytes()
    }

    pub fn persist(&self, dir: &Path) -> NodeResult<()> {
        std::fs::create_dir_all(dir).map_err(|e| NodeError::Store(e.to_string()))?;
        let path = dir.join("p2p-identity.seed");
        std::fs::write(path, hex::encode(self.seed_bytes()))
            .map_err(|e| NodeError::Store(e.to_string()))
    }

    pub fn load_or_create(dir: &Path) -> NodeResult<Self> {
        std::fs::create_dir_all(dir).map_err(|e| NodeError::Store(e.to_string()))?;
        let path = dir.join("p2p-identity.seed");
        if path.exists() {
            let text =
                std::fs::read_to_string(&path).map_err(|e| NodeError::Store(e.to_string()))?;
            let bytes = hex::decode(text.trim()).map_err(|e| NodeError::Store(e.to_string()))?;
            let seed: [u8; 32] = bytes
                .try_into()
                .map_err(|_| NodeError::Store("identity seed must be 32 bytes".into()))?;
            return Ok(Self::from_seed(seed));
        }
        let identity = Self::generate();
        identity.persist(dir)?;
        Ok(identity)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PeerAddress {
    pub host: String,
    pub port: u16,
}

impl PeerAddress {
    pub fn to_socket_addr(&self) -> NodeResult<SocketAddr> {
        format!("{}:{}", self.host, self.port)
            .parse()
            .map_err(|e| NodeError::Peer(format!("invalid peer address: {e}")))
    }

    pub fn from_socket(addr: SocketAddr) -> Self {
        Self {
            host: addr.ip().to_string(),
            port: addr.port(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionDirection {
    Inbound,
    Outbound,
}

#[derive(Debug, Clone)]
pub struct PeerSession {
    pub node_id: NodeId,
    pub public_key: PeerPublicKey,
    pub address: PeerAddress,
    pub direction: SessionDirection,
    pub height: u64,
    pub protocol_version: u16,
    pub codec_version: u16,
    pub crypto_suite: String,
    pub feature_bits: u64,
    pub established_at_ms: u64,
    pub last_seen_ms: u64,
}

pub fn unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
