use std::collections::HashSet;

use crate::codec::{Reader, Writer};
use crate::crypto::{verify, KeyDomain, CODEC_VERSION, CRYPTO_SUITE_ID, PROTOCOL_VERSION};
use crate::error::{HandshakeRejectReason, NodeError, NodeResult};
use crate::identity::{unix_ms, NodeId, PeerIdentity, PeerPublicKey};

pub const HANDSHAKE_SKEW_MS: u64 = 120_000;
pub const FEATURE_DEV_PRODUCER: u64 = 1 << 0;
pub const FEATURE_TX_GOSSIP: u64 = 1 << 1;
pub const FEATURE_BLOCK_GOSSIP: u64 = 1 << 2;
pub const FEATURE_STATE_SYNC: u64 = 1 << 3;
pub const FEATURE_EVIDENCE_GOSSIP: u64 = 1 << 4;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HandshakeHello {
    pub network_id: String,
    pub chain_id: String,
    pub genesis_hash: [u8; 32],
    pub node_id: NodeId,
    pub public_key: PeerPublicKey,
    pub protocol_version: u16,
    pub codec_version: u16,
    pub crypto_suite: String,
    pub height: u64,
    pub feature_bits: u64,
    pub timestamp_ms: u64,
    pub nonce: [u8; 32],
    pub signature: [u8; 64],
}

impl HandshakeHello {
    pub fn unsigned_bytes(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.string(&self.network_id)?;
        w.string(&self.chain_id)?;
        w.bytes32(&self.genesis_hash);
        w.bytes32(&self.node_id.0);
        w.bytes32(&self.public_key.0);
        w.u16(self.protocol_version);
        w.u16(self.codec_version);
        w.string(&self.crypto_suite)?;
        w.u64(self.height);
        w.u64(self.feature_bits);
        w.u64(self.timestamp_ms);
        w.bytes32(&self.nonce);
        Ok(w.finish())
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(1);
        w.string(&self.network_id)?;
        w.string(&self.chain_id)?;
        w.bytes32(&self.genesis_hash);
        w.bytes32(&self.node_id.0);
        w.bytes32(&self.public_key.0);
        w.u16(self.protocol_version);
        w.u16(self.codec_version);
        w.string(&self.crypto_suite)?;
        w.u64(self.height);
        w.u64(self.feature_bits);
        w.u64(self.timestamp_ms);
        w.bytes32(&self.nonce);
        w.bytes64(&self.signature);
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        let version = r.u8()?;
        if version != 1 {
            return Err(NodeError::HandshakeRejected {
                reason: HandshakeRejectReason::Malformed,
            });
        }
        let hello = Self {
            network_id: r.string()?,
            chain_id: r.string()?,
            genesis_hash: r.bytes32()?,
            node_id: NodeId(r.bytes32()?),
            public_key: PeerPublicKey(r.bytes32()?),
            protocol_version: r.u16()?,
            codec_version: r.u16()?,
            crypto_suite: r.string()?,
            height: r.u64()?,
            feature_bits: r.u64()?,
            timestamp_ms: r.u64()?,
            nonce: r.bytes32()?,
            signature: r.bytes64()?,
        };
        r.finish()?;
        Ok(hello)
    }
}

pub fn build_hello(
    identity: &PeerIdentity,
    network_id: &str,
    chain_id: &str,
    genesis_hash: [u8; 32],
    height: u64,
    feature_bits: u64,
    nonce: [u8; 32],
) -> NodeResult<HandshakeHello> {
    let mut hello = HandshakeHello {
        network_id: network_id.to_string(),
        chain_id: chain_id.to_string(),
        genesis_hash,
        node_id: identity.node_id,
        public_key: identity.public_key,
        protocol_version: PROTOCOL_VERSION,
        codec_version: CODEC_VERSION,
        crypto_suite: CRYPTO_SUITE_ID.to_string(),
        height,
        feature_bits,
        timestamp_ms: unix_ms(),
        nonce,
        signature: [0u8; 64],
    };
    let unsigned = hello.unsigned_bytes()?;
    hello.signature = identity.sign(&unsigned);
    Ok(hello)
}

#[derive(Debug, Clone)]
pub struct LocalHandshakeView {
    pub network_id: String,
    pub chain_id: String,
    pub genesis_hash: [u8; 32],
    pub node_id: NodeId,
    pub now_ms: u64,
}

#[derive(Default)]
pub struct HandshakeReplayCache {
    seen: HashSet<[u8; 32]>,
}

impl HandshakeReplayCache {
    pub fn insert(&mut self, nonce: [u8; 32]) -> bool {
        self.seen.insert(nonce)
    }
}

pub fn evaluate_hello(
    local: &LocalHandshakeView,
    remote: &HandshakeHello,
    replay: &mut HandshakeReplayCache,
) -> Result<(), HandshakeRejectReason> {
    if remote.network_id != local.network_id {
        return Err(HandshakeRejectReason::NetworkMismatch);
    }
    if remote.chain_id != local.chain_id {
        return Err(HandshakeRejectReason::ChainMismatch);
    }
    if remote.genesis_hash != local.genesis_hash {
        return Err(HandshakeRejectReason::GenesisMismatch);
    }
    if remote.protocol_version != PROTOCOL_VERSION {
        return Err(HandshakeRejectReason::ProtocolVersion);
    }
    if remote.codec_version != CODEC_VERSION {
        return Err(HandshakeRejectReason::CodecVersion);
    }
    if remote.crypto_suite != CRYPTO_SUITE_ID {
        return Err(HandshakeRejectReason::CryptoSuite);
    }
    if remote.node_id == local.node_id {
        return Err(HandshakeRejectReason::SelfConnection);
    }
    if NodeId::from_public_key(&remote.public_key) != remote.node_id {
        return Err(HandshakeRejectReason::Malformed);
    }
    let skew = local.now_ms.abs_diff(remote.timestamp_ms);
    if skew > HANDSHAKE_SKEW_MS {
        return Err(HandshakeRejectReason::ClockSkew);
    }
    if !replay.insert(remote.nonce) {
        return Err(HandshakeRejectReason::Replay);
    }
    let unsigned = remote
        .unsigned_bytes()
        .map_err(|_| HandshakeRejectReason::Malformed)?;
    if verify(
        KeyDomain::P2pNode,
        &remote.public_key.0,
        &unsigned,
        &remote.signature,
    )
    .is_err()
    {
        return Err(HandshakeRejectReason::BadSignature);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::identity::PeerIdentity;

    #[test]
    fn accepts_compatible_peer() {
        let a = PeerIdentity::generate();
        let b = PeerIdentity::generate();
        let genesis = [7u8; 32];
        let hello = build_hello(
            &b,
            "net_dev",
            "chn_dev",
            genesis,
            3,
            FEATURE_TX_GOSSIP,
            [9u8; 32],
        )
        .unwrap();
        let encoded = hello.encode().unwrap();
        let decoded = HandshakeHello::decode(&encoded).unwrap();
        let mut replay = HandshakeReplayCache::default();
        evaluate_hello(
            &LocalHandshakeView {
                network_id: "net_dev".into(),
                chain_id: "chn_dev".into(),
                genesis_hash: genesis,
                node_id: a.node_id,
                now_ms: decoded.timestamp_ms,
            },
            &decoded,
            &mut replay,
        )
        .unwrap();
    }

    #[test]
    fn rejects_wrong_genesis() {
        let a = PeerIdentity::generate();
        let b = PeerIdentity::generate();
        let hello = build_hello(&b, "net_dev", "chn_dev", [1u8; 32], 0, 0, [2u8; 32]).unwrap();
        let mut replay = HandshakeReplayCache::default();
        let err = evaluate_hello(
            &LocalHandshakeView {
                network_id: "net_dev".into(),
                chain_id: "chn_dev".into(),
                genesis_hash: [2u8; 32],
                node_id: a.node_id,
                now_ms: hello.timestamp_ms,
            },
            &hello,
            &mut replay,
        )
        .unwrap_err();
        assert_eq!(err, HandshakeRejectReason::GenesisMismatch);
    }
}
