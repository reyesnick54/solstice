use std::collections::{HashMap, HashSet};
use std::net::IpAddr;
use std::path::Path;
use std::time::Duration;

use crate::error::NodeResult;
use crate::identity::{unix_ms, NodeId, PeerAddress, SessionDirection};

#[derive(Debug, Clone)]
pub struct PeerLimits {
    pub max_inbound: usize,
    pub max_outbound: usize,
    pub max_per_ip: usize,
    pub ban_score: u32,
    pub ban_ms: u64,
    pub max_failures: u32,
}

impl Default for PeerLimits {
    fn default() -> Self {
        Self {
            max_inbound: 16,
            max_outbound: 16,
            max_per_ip: 3,
            ban_score: 100,
            ban_ms: 30_000,
            max_failures: 8,
        }
    }
}

#[derive(Debug, Clone)]
pub struct KnownPeer {
    pub node_id: Option<NodeId>,
    pub address: PeerAddress,
    pub last_seen_ms: u64,
    pub failure_count: u32,
    pub misbehavior_score: u32,
    pub banned_until_ms: u64,
    pub seed: bool,
}

#[derive(Debug, Clone)]
pub struct ConnectedPeer {
    pub node_id: NodeId,
    pub address: PeerAddress,
    pub ip: IpAddr,
    pub direction: SessionDirection,
    pub height: u64,
    pub last_seen_ms: u64,
    pub score: u32,
}

#[derive(Debug)]
pub struct PeerManager {
    pub limits: PeerLimits,
    pub allow_list: Option<HashSet<NodeId>>,
    pub seeds: Vec<PeerAddress>,
    pub known: HashMap<String, KnownPeer>,
    pub connected: HashMap<NodeId, ConnectedPeer>,
    pub connecting: HashSet<String>,
    persist_path: Option<std::path::PathBuf>,
}

impl PeerManager {
    pub fn new(
        limits: PeerLimits,
        seeds: Vec<PeerAddress>,
        allow_list: Option<HashSet<NodeId>>,
    ) -> Self {
        let mut known = HashMap::new();
        for seed in &seeds {
            known.insert(
                addr_key(seed),
                KnownPeer {
                    node_id: None,
                    address: seed.clone(),
                    last_seen_ms: 0,
                    failure_count: 0,
                    misbehavior_score: 0,
                    banned_until_ms: 0,
                    seed: true,
                },
            );
        }
        Self {
            limits,
            allow_list,
            seeds,
            known,
            connected: HashMap::new(),
            connecting: HashSet::new(),
            persist_path: None,
        }
    }

    pub fn with_persistence(mut self, dir: &Path) -> NodeResult<Self> {
        std::fs::create_dir_all(dir).ok();
        let path = dir.join("known-peers.json");
        if path.exists() {
            if let Ok(text) = std::fs::read_to_string(&path) {
                if let Ok(stored) = serde_json::from_str::<Vec<StoredPeer>>(&text) {
                    for item in stored {
                        self.known.entry(item.key.clone()).or_insert(KnownPeer {
                            node_id: item.node_id.map(NodeId),
                            address: PeerAddress {
                                host: item.host,
                                port: item.port,
                            },
                            last_seen_ms: item.last_seen_ms,
                            failure_count: item.failure_count,
                            misbehavior_score: item.misbehavior_score,
                            banned_until_ms: item.banned_until_ms,
                            seed: item.seed,
                        });
                    }
                }
            }
        }
        self.persist_path = Some(path);
        Ok(self)
    }

    pub fn persist(&self) {
        let Some(path) = &self.persist_path else {
            return;
        };
        let stored: Vec<StoredPeer> = self
            .known
            .iter()
            .map(|(key, peer)| StoredPeer {
                key: key.clone(),
                host: peer.address.host.clone(),
                port: peer.address.port,
                node_id: peer.node_id.map(|id| id.0),
                last_seen_ms: peer.last_seen_ms,
                failure_count: peer.failure_count,
                misbehavior_score: peer.misbehavior_score,
                banned_until_ms: peer.banned_until_ms,
                seed: peer.seed,
            })
            .collect();
        if let Ok(text) = serde_json::to_string_pretty(&stored) {
            let _ = std::fs::write(path, text);
        }
    }

    pub fn inbound_count(&self) -> usize {
        self.connected
            .values()
            .filter(|p| p.direction == SessionDirection::Inbound)
            .count()
    }

    pub fn outbound_count(&self) -> usize {
        self.connected
            .values()
            .filter(|p| p.direction == SessionDirection::Outbound)
            .count()
    }

    pub fn is_banned(&self, address: &PeerAddress, node_id: Option<NodeId>) -> bool {
        let now = unix_ms();
        if let Some(known) = self.known.get(&addr_key(address)) {
            if known.banned_until_ms > now {
                return true;
            }
        }
        if let Some(id) = node_id {
            self.known
                .values()
                .any(|k| k.node_id == Some(id) && k.banned_until_ms > now)
        } else {
            false
        }
    }

    pub fn allow(&self, node_id: NodeId) -> bool {
        self.allow_list
            .as_ref()
            .map(|set| set.contains(&node_id))
            .unwrap_or(true)
    }

    pub fn can_accept_inbound(&self, ip: IpAddr) -> Result<(), &'static str> {
        if self.inbound_count() >= self.limits.max_inbound {
            return Err("inbound limit");
        }
        let same_ip = self.connected.values().filter(|p| p.ip == ip).count();
        if same_ip >= self.limits.max_per_ip {
            return Err("per-ip limit");
        }
        Ok(())
    }

    pub fn can_dial(&self, address: &PeerAddress) -> Result<(), &'static str> {
        if self.outbound_count() >= self.limits.max_outbound {
            return Err("outbound limit");
        }
        if self.connecting.contains(&addr_key(address)) {
            return Err("already connecting");
        }
        if self
            .connected
            .values()
            .any(|p| p.address.host == address.host && p.address.port == address.port)
        {
            return Err("already connected");
        }
        if self.is_banned(address, None) {
            return Err("banned");
        }
        Ok(())
    }

    pub fn mark_connecting(&mut self, address: &PeerAddress) {
        self.connecting.insert(addr_key(address));
    }

    pub fn clear_connecting(&mut self, address: &PeerAddress) {
        self.connecting.remove(&addr_key(address));
    }

    pub fn record_session(&mut self, peer: ConnectedPeer) {
        let key = addr_key(&peer.address);
        self.connecting.remove(&key);
        self.known.insert(
            key,
            KnownPeer {
                node_id: Some(peer.node_id),
                address: peer.address.clone(),
                last_seen_ms: peer.last_seen_ms,
                failure_count: 0,
                misbehavior_score: peer.score,
                banned_until_ms: 0,
                seed: self
                    .seeds
                    .iter()
                    .any(|s| s.host == peer.address.host && s.port == peer.address.port),
            },
        );
        self.connected.insert(peer.node_id, peer);
        self.persist();
    }

    pub fn disconnect(&mut self, node_id: NodeId) -> Option<ConnectedPeer> {
        let removed = self.connected.remove(&node_id);
        self.persist();
        removed
    }

    pub fn touch(&mut self, node_id: NodeId) {
        if let Some(peer) = self.connected.get_mut(&node_id) {
            peer.last_seen_ms = unix_ms();
            if let Some(known) = self.known.get_mut(&addr_key(&peer.address)) {
                known.last_seen_ms = peer.last_seen_ms;
            }
        }
    }

    pub fn record_failure(&mut self, address: &PeerAddress) {
        let key = addr_key(address);
        let entry = self.known.entry(key).or_insert(KnownPeer {
            node_id: None,
            address: address.clone(),
            last_seen_ms: unix_ms(),
            failure_count: 0,
            misbehavior_score: 0,
            banned_until_ms: 0,
            seed: false,
        });
        entry.failure_count = entry.failure_count.saturating_add(1);
        self.persist();
    }

    pub fn add_score(&mut self, node_id: NodeId, delta: u32) -> bool {
        let now = unix_ms();
        let mut banned = false;
        if let Some(peer) = self.connected.get_mut(&node_id) {
            peer.score = peer.score.saturating_add(delta);
            if let Some(known) = self.known.get_mut(&addr_key(&peer.address)) {
                known.misbehavior_score = peer.score;
                if peer.score >= self.limits.ban_score {
                    known.banned_until_ms = now.saturating_add(self.limits.ban_ms);
                    banned = true;
                }
            }
        }
        self.persist();
        banned
    }

    pub fn reconnect_delay(&self, address: &PeerAddress) -> Duration {
        let failures = self
            .known
            .get(&addr_key(address))
            .map(|k| k.failure_count)
            .unwrap_or(0);
        let exp = failures.min(6);
        Duration::from_millis(200 * (1u64 << exp))
    }

    pub fn dial_candidates(&self) -> Vec<PeerAddress> {
        let mut out = Vec::new();
        for peer in self.known.values() {
            if self.can_dial(&peer.address).is_ok() {
                out.push(peer.address.clone());
            }
        }
        out
    }
}

fn addr_key(address: &PeerAddress) -> String {
    format!("{}:{}", address.host, address.port)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct StoredPeer {
    key: String,
    host: String,
    port: u16,
    node_id: Option<[u8; 32]>,
    last_seen_ms: u64,
    failure_count: u32,
    misbehavior_score: u32,
    banned_until_ms: u64,
    seed: bool,
}
