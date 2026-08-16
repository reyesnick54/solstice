use std::collections::{HashMap, HashSet, VecDeque};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::broadcast;
use tokio::task::JoinHandle;

use crate::chain::{Block, DevChain, Genesis, Transaction};
use crate::codec::{encode_frame, Channel, Frame};
use crate::consensus::auth::ConsensusAuthContext;
use crate::consensus::engine::Action;
use crate::consensus::messages::ConsensusMessage;
use crate::consensus::reactor::ConsensusReactor;
use crate::consensus::signer::ConsensusSigner;
use crate::consensus::types::TimeoutKind;
use crate::consensus::validators::ValidatorSet;
use crate::consensus::vote::CommitCertificate;
use crate::consensus::wal::ConsensusWal;
use crate::consensus::{ConsensusEngine, ConsensusParams};
use crate::crypto::DomainKey;
use crate::error::{HandshakeRejectReason, NodeError, NodeResult};
use crate::fork::ForkEvidence;
use crate::handshake::{
    build_hello, evaluate_hello, HandshakeHello, HandshakeReplayCache, LocalHandshakeView,
    FEATURE_BLOCK_GOSSIP, FEATURE_CONSENSUS, FEATURE_DEV_PRODUCER, FEATURE_STATE_SYNC,
    FEATURE_TX_GOSSIP,
};
use crate::identity::{unix_ms, NodeId, PeerAddress, PeerIdentity, PeerSession, SessionDirection};
use crate::mempool::{Mempool, MempoolConfig};
use crate::messages::NetMessage;
use crate::metrics::{Metrics, MetricsSnapshot};
use crate::peer::{ConnectedPeer, PeerLimits, PeerManager};
use crate::transport::bind_endpoint;

pub const MAX_SYNC_RANGE: u64 = 32;
pub const MAX_SEEN: usize = 4_096;
const _PER_PEER_QUEUE: usize = 128;

#[derive(Clone)]
pub struct NodeConfig {
    pub name: String,
    pub data_dir: PathBuf,
    pub listen: SocketAddr,
    pub operator_listen: SocketAddr,
    pub seeds: Vec<PeerAddress>,
    pub allow_list: Option<HashSet<NodeId>>,
    pub producer: bool,
    pub genesis: Genesis,
    pub limits: PeerLimits,
    pub mempool: MempoolConfig,
    pub consensus: Option<ConsensusNodeConfig>,
}

#[derive(Clone)]
pub struct ConsensusNodeConfig {
    pub validator_name: String,
    pub consensus_key: DomainKey,
    pub validator_set: ValidatorSet,
    pub params: ConsensusParams,
}

impl NodeConfig {
    pub fn development(
        name: &str,
        data_dir: PathBuf,
        listen: SocketAddr,
        operator_listen: SocketAddr,
    ) -> Self {
        Self {
            name: name.into(),
            data_dir,
            listen,
            operator_listen,
            seeds: Vec::new(),
            allow_list: None,
            producer: false,
            genesis: Genesis::development(),
            limits: PeerLimits::default(),
            mempool: MempoolConfig::default(),
            consensus: None,
        }
    }
}

#[derive(Debug, Clone)]
pub enum NodeEvent {
    Ready {
        name: String,
        listen: SocketAddr,
        node_id: NodeId,
    },
    PeerAuthenticated {
        node_id: NodeId,
        direction: SessionDirection,
        height: u64,
    },
    HandshakeRejected {
        reason: HandshakeRejectReason,
    },
    TxInMempool {
        tx_id: [u8; 32],
    },
    BlockCommitted {
        height: u64,
        block_id: [u8; 32],
        state_root: [u8; 32],
    },
    SyncCaughtUp {
        height: u64,
    },
    ForkDetected(ForkEvidence),
    PeerBanned {
        node_id: NodeId,
    },
    RateLimited {
        reason: String,
    },
    MalformedIgnored,
    ConsensusFinalized {
        height: u64,
        block_id: [u8; 32],
        state_root: [u8; 32],
        round: u32,
    },
    ConsensusRejected {
        reason: String,
    },
}

struct PeerIo {
    queues: Arc<Mutex<PriorityQueues>>,
    notify: Arc<tokio::sync::Notify>,
}

struct PriorityQueues {
    consensus: VecDeque<NetMessage>,
    block_sync: VecDeque<NetMessage>,
    tx: VecDeque<NetMessage>,
}

impl PriorityQueues {
    fn new() -> Self {
        Self {
            consensus: VecDeque::new(),
            block_sync: VecDeque::new(),
            tx: VecDeque::new(),
        }
    }

    fn push(&mut self, channel: Channel, message: NetMessage) -> bool {
        let (queue, cap) = match channel {
            Channel::Consensus | Channel::PeerControl => (&mut self.consensus, 256usize),
            Channel::StateSync | Channel::BlockGossip => (&mut self.block_sync, 128usize),
            Channel::TransactionGossip => (&mut self.tx, 64usize),
        };
        if queue.len() >= cap {
            return false;
        }
        queue.push_back(message);
        true
    }

    fn pop(&mut self) -> Option<(Channel, NetMessage)> {
        if let Some(message) = self.consensus.pop_front() {
            return Some((Channel::Consensus, message));
        }
        if let Some(message) = self.block_sync.pop_front() {
            return Some((Channel::StateSync, message));
        }
        self.tx
            .pop_front()
            .map(|message| (Channel::TransactionGossip, message))
    }
}

#[derive(Clone)]
struct ScheduledTimeout {
    kind: TimeoutKind,
    height: u64,
    round: u32,
    at: Instant,
}

struct SeenCache {
    set: HashSet<[u8; 32]>,
    order: VecDeque<[u8; 32]>,
}

impl SeenCache {
    fn new() -> Self {
        Self {
            set: HashSet::new(),
            order: VecDeque::new(),
        }
    }

    fn insert(&mut self, id: [u8; 32]) -> bool {
        if !self.set.insert(id) {
            return false;
        }
        self.order.push_back(id);
        if self.order.len() > MAX_SEEN {
            if let Some(old) = self.order.pop_front() {
                self.set.remove(&old);
            }
        }
        true
    }
}

struct RateWindow {
    stamps: VecDeque<u64>,
}

impl RateWindow {
    fn new() -> Self {
        Self {
            stamps: VecDeque::new(),
        }
    }

    fn allow(&mut self, now: u64, limit: usize, window_ms: u64) -> bool {
        while self
            .stamps
            .front()
            .is_some_and(|t| now.saturating_sub(*t) > window_ms)
        {
            self.stamps.pop_front();
        }
        if self.stamps.len() >= limit {
            return false;
        }
        self.stamps.push_back(now);
        true
    }
}

pub struct DevelopmentNode {
    pub config: NodeConfig,
    pub identity: PeerIdentity,
    pub chain: Arc<Mutex<DevChain>>,
    pub mempool: Arc<Mutex<Mempool>>,
    pub peers: Arc<Mutex<PeerManager>>,
    pub metrics: Arc<Metrics>,
    pub forks: Arc<Mutex<Vec<ForkEvidence>>>,
    events: broadcast::Sender<NodeEvent>,
    sessions: Arc<Mutex<HashMap<NodeId, PeerSession>>>,
    ios: Arc<Mutex<HashMap<NodeId, PeerIo>>>,
    seen_tx: Arc<Mutex<SeenCache>>,
    seen_block: Arc<Mutex<SeenCache>>,
    replay: Arc<Mutex<HandshakeReplayCache>>,
    consensus: Option<Arc<Mutex<ConsensusReactor>>>,
    timeouts: Arc<Mutex<Vec<ScheduledTimeout>>>,
    consensus_evidence: Arc<Mutex<Vec<crate::consensus::evidence::EquivocationEvidence>>>,
    pub(crate) shutdown: tokio::sync::Notify,
    tasks: Mutex<Vec<JoinHandle<()>>>,
}

impl DevelopmentNode {
    pub fn open(config: NodeConfig) -> NodeResult<Self> {
        std::fs::create_dir_all(&config.data_dir).map_err(|e| NodeError::Store(e.to_string()))?;
        let identity = PeerIdentity::load_or_create(&config.data_dir)?;
        let chain = DevChain::open(&config.data_dir, config.genesis.clone())?;
        let peers = PeerManager::new(
            config.limits.clone(),
            config.seeds.clone(),
            config.allow_list.clone(),
        )
        .with_persistence(&config.data_dir)?;
        let (events, _) = broadcast::channel(256);
        let consensus = if let Some(cfg) = &config.consensus {
            let signer = ConsensusSigner::open(&config.data_dir, cfg.consensus_key.clone())?;
            let wal = ConsensusWal::open(&config.data_dir)?;
            let mut engine = ConsensusEngine::new(
                config.genesis.network_id.clone(),
                config.genesis.chain_id.clone(),
                cfg.validator_set.clone(),
                signer,
                wal,
                cfg.params,
            );
            let _ = engine.recover();
            Some(Arc::new(Mutex::new(ConsensusReactor::new(engine))))
        } else {
            None
        };
        Ok(Self {
            identity,
            chain: Arc::new(Mutex::new(chain)),
            mempool: Arc::new(Mutex::new(Mempool::new(config.mempool.clone()))),
            peers: Arc::new(Mutex::new(peers)),
            metrics: Arc::new(Metrics::default()),
            forks: Arc::new(Mutex::new(Vec::new())),
            events,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            ios: Arc::new(Mutex::new(HashMap::new())),
            seen_tx: Arc::new(Mutex::new(SeenCache::new())),
            seen_block: Arc::new(Mutex::new(SeenCache::new())),
            replay: Arc::new(Mutex::new(HandshakeReplayCache::default())),
            consensus,
            timeouts: Arc::new(Mutex::new(Vec::new())),
            consensus_evidence: Arc::new(Mutex::new(Vec::new())),
            shutdown: tokio::sync::Notify::new(),
            tasks: Mutex::new(Vec::new()),
            config,
        })
    }

    pub fn subscribe(&self) -> broadcast::Receiver<NodeEvent> {
        self.events.subscribe()
    }

    pub fn node_id(&self) -> NodeId {
        self.identity.node_id
    }

    pub fn height(&self) -> u64 {
        self.chain.lock().height()
    }

    pub fn state_root(&self) -> [u8; 32] {
        self.chain.lock().state_root()
    }

    pub fn finalized_height(&self) -> u64 {
        if let Some(consensus) = &self.consensus {
            consensus.lock().engine.finalized_height()
        } else {
            self.height()
        }
    }

    pub fn finalized_block(&self, height: u64) -> Option<Block> {
        if let Some(consensus) = &self.consensus {
            consensus
                .lock()
                .engine
                .store
                .finalized_block(height)
                .cloned()
        } else {
            self.chain.lock().block_by_height(height).cloned()
        }
    }

    pub fn commit_certificate(&self, height: u64) -> Option<CommitCertificate> {
        self.consensus
            .as_ref()
            .and_then(|c| c.lock().engine.store.commit_certificate(height).cloned())
    }

    pub fn validator_set_at_height(&self, _height: u64) -> Option<ValidatorSet> {
        self.config
            .consensus
            .as_ref()
            .map(|c| c.validator_set.clone())
    }

    pub fn consensus_round_at_commit(&self, height: u64) -> Option<u32> {
        self.consensus
            .as_ref()
            .and_then(|c| c.lock().engine.store.consensus_round_at_commit(height))
    }

    pub fn state_root_at_height(&self, height: u64) -> Option<[u8; 32]> {
        if let Some(consensus) = &self.consensus {
            consensus.lock().engine.store.state_root_at_height(height)
        } else {
            self.chain
                .lock()
                .block_by_height(height)
                .map(|b| b.header.state_root)
        }
    }

    pub fn consensus_metrics(&self) -> Option<crate::consensus::ConsensusMetricsSnapshot> {
        self.consensus.as_ref().map(|c| c.lock().metrics.snapshot())
    }

    pub fn consensus_evidence(&self) -> Vec<crate::consensus::evidence::EquivocationEvidence> {
        self.consensus_evidence.lock().clone()
    }

    pub fn validator_set_hash(&self) -> [u8; 32] {
        self.config.genesis.validator_set_hash
    }

    pub fn metrics_snapshot(&self) -> MetricsSnapshot {
        self.refresh_metrics();
        self.metrics.snapshot()
    }

    pub fn fork_evidence(&self) -> Vec<ForkEvidence> {
        self.forks.lock().clone()
    }

    fn emit(&self, event: NodeEvent) {
        let _ = self.events.send(event);
    }

    fn refresh_metrics(&self) {
        let peers = self.peers.lock();
        self.metrics
            .peer_count
            .store(peers.connected.len() as u64, Ordering::Relaxed);
        self.metrics
            .inbound_peers
            .store(peers.inbound_count() as u64, Ordering::Relaxed);
        self.metrics
            .outbound_peers
            .store(peers.outbound_count() as u64, Ordering::Relaxed);
        drop(peers);
        let mempool = self.mempool.lock();
        self.metrics
            .mempool_count
            .store(mempool.count() as u64, Ordering::Relaxed);
        self.metrics
            .mempool_bytes
            .store(mempool.bytes() as u64, Ordering::Relaxed);
        drop(mempool);
        let height = self.height();
        self.metrics.sync_height.store(height, Ordering::Relaxed);
        let max_peer = self
            .sessions
            .lock()
            .values()
            .map(|s| s.height)
            .max()
            .unwrap_or(height);
        self.metrics
            .sync_lag
            .store(max_peer.saturating_sub(height), Ordering::Relaxed);
        if let Some(consensus) = &self.consensus {
            let session_count = self.sessions.lock().len() as u64;
            let reactor = consensus.lock();
            reactor
                .metrics
                .consensus_peer_count
                .store(session_count, Ordering::Relaxed);
            reactor.metrics.validator_sync_lag.store(
                max_peer.saturating_sub(reactor.engine.store.finalized_height()),
                Ordering::Relaxed,
            );
        }
    }

    pub async fn start(self: &Arc<Self>) -> NodeResult<SocketAddr> {
        let endpoint = bind_endpoint(self.config.listen)?;
        let listen = endpoint
            .local_addr()
            .map_err(|e| NodeError::Transport(e.to_string()))?;
        let accept_endpoint = endpoint.clone();
        let node = Arc::clone(self);
        self.spawn(async move {
            loop {
                tokio::select! {
                    _ = node.shutdown.notified() => break,
                    incoming = accept_endpoint.accept() => {
                        let Some(incoming) = incoming else { break; };
                        let node = Arc::clone(&node);
                        tokio::spawn(async move {
                            match incoming.await {
                                Ok(conn) => {
                                    if let Err(err) = node.handle_connection(conn, SessionDirection::Inbound).await {
                                        tracing::debug!(error = %err, "inbound connection ended");
                                    }
                                }
                                Err(err) => tracing::debug!(error = %err, "inbound accept failed"),
                            }
                        });
                    }
                }
            }
        });
        let node = Arc::clone(self);
        self.spawn(async move {
            loop {
                tokio::select! {
                    _ = node.shutdown.notified() => break,
                    _ = tokio::time::sleep(Duration::from_millis(200)) => {
                        node.dial_seeds(&endpoint).await;
                    }
                }
            }
        });
        if self.consensus.is_some() {
            let node = Arc::clone(self);
            self.spawn(async move {
                loop {
                    tokio::select! {
                        _ = node.shutdown.notified() => break,
                        _ = tokio::time::sleep(Duration::from_millis(5)) => {
                            node.fire_consensus_timeouts();
                        }
                    }
                }
            });
            // Consensus starts after the first authenticated peer so the
            // opening proposal is not broadcast into an empty mesh.
        }
        self.emit(NodeEvent::Ready {
            name: self.config.name.clone(),
            listen,
            node_id: self.identity.node_id,
        });
        Ok(listen)
    }

    fn fire_consensus_timeouts(&self) {
        let now = Instant::now();
        let due: Vec<_> = {
            let mut timeouts = self.timeouts.lock();
            let due: Vec<_> = timeouts.iter().filter(|t| t.at <= now).cloned().collect();
            timeouts.retain(|t| t.at > now);
            due
        };
        if due.is_empty() {
            return;
        }
        let Some(consensus) = &self.consensus else {
            return;
        };
        let mut actions = Vec::new();
        {
            let mut reactor = consensus.lock();
            for timeout in due {
                actions.extend(reactor.on_timeout(timeout.kind, timeout.height, timeout.round));
            }
        }
        NodeHandle::from_node(self).apply_actions(actions);
    }

    pub async fn shutdown(&self) {
        self.shutdown.notify_waiters();
        let tasks: Vec<_> = self.tasks.lock().drain(..).collect();
        for task in tasks {
            task.abort();
        }
    }

    fn spawn<F>(&self, fut: F)
    where
        F: std::future::Future<Output = ()> + Send + 'static,
    {
        self.tasks.lock().push(tokio::spawn(fut));
    }

    async fn dial_seeds(&self, endpoint: &quinn::Endpoint) {
        let handle = NodeHandle::from_node(self);
        handle.dial_candidates(endpoint).await;
    }

    async fn handle_connection(
        &self,
        conn: quinn::Connection,
        direction: SessionDirection,
    ) -> NodeResult<()> {
        NodeHandle::from_node(self)
            .handle_connection(conn, direction)
            .await
    }

    pub fn submit_tx(&self, tx: Transaction) -> NodeResult<[u8; 32]> {
        let chain = self.chain.lock();
        let mut mempool = self.mempool.lock();
        let id = mempool.admit(&chain, tx.clone())?;
        drop(mempool);
        drop(chain);
        self.seen_tx.lock().insert(id);
        self.refresh_metrics();
        self.emit(NodeEvent::TxInMempool { tx_id: id });
        self.broadcast(
            Channel::TransactionGossip,
            NetMessage::TxAnnounce { tx_id: id },
            None,
        );
        Ok(id)
    }

    pub fn produce_block(&self) -> NodeResult<Block> {
        if !self.config.producer {
            return Err(NodeError::Forbidden(
                "this node is not the development producer".into(),
            ));
        }
        let mut chain = self.chain.lock();
        let mut mempool = self.mempool.lock();
        let selected = mempool.select_for_block();
        let block = chain.propose_block(selected, unix_ms())?;
        let root = chain.apply_block(block.clone())?;
        mempool.remove_committed(&block.transactions);
        mempool.revalidate(&chain);
        drop(mempool);
        drop(chain);
        self.seen_block.lock().insert(block.block_id);
        self.refresh_metrics();
        self.emit(NodeEvent::BlockCommitted {
            height: block.header.height,
            block_id: block.block_id,
            state_root: root,
        });
        self.broadcast(
            Channel::BlockGossip,
            NetMessage::BlockAnnounce {
                height: block.header.height,
                block_id: block.block_id,
            },
            None,
        );
        Ok(block)
    }

    pub fn disconnect_peer(&self, node_id: NodeId) {
        self.ios.lock().remove(&node_id);
        self.sessions.lock().remove(&node_id);
        self.peers.lock().disconnect(node_id);
        self.refresh_metrics();
    }

    fn broadcast(&self, channel: Channel, message: NetMessage, except: Option<NodeId>) {
        NodeHandle::from_node(self).broadcast(channel, message, except);
    }
}

#[derive(Clone)]
struct NodeHandle {
    config: NodeConfig,
    identity: PeerIdentity,
    chain: Arc<Mutex<DevChain>>,
    mempool: Arc<Mutex<Mempool>>,
    peers: Arc<Mutex<PeerManager>>,
    metrics: Arc<Metrics>,
    forks: Arc<Mutex<Vec<ForkEvidence>>>,
    events: broadcast::Sender<NodeEvent>,
    sessions: Arc<Mutex<HashMap<NodeId, PeerSession>>>,
    ios: Arc<Mutex<HashMap<NodeId, PeerIo>>>,
    seen_tx: Arc<Mutex<SeenCache>>,
    seen_block: Arc<Mutex<SeenCache>>,
    replay: Arc<Mutex<HandshakeReplayCache>>,
    consensus: Option<Arc<Mutex<ConsensusReactor>>>,
    timeouts: Arc<Mutex<Vec<ScheduledTimeout>>>,
    consensus_evidence: Arc<Mutex<Vec<crate::consensus::evidence::EquivocationEvidence>>>,
}

impl NodeHandle {
    fn from_node(node: &DevelopmentNode) -> Self {
        Self {
            config: node.config.clone(),
            identity: node.identity.clone(),
            chain: Arc::clone(&node.chain),
            mempool: Arc::clone(&node.mempool),
            peers: Arc::clone(&node.peers),
            metrics: Arc::clone(&node.metrics),
            forks: Arc::clone(&node.forks),
            events: node.events.clone(),
            sessions: Arc::clone(&node.sessions),
            ios: Arc::clone(&node.ios),
            seen_tx: Arc::clone(&node.seen_tx),
            seen_block: Arc::clone(&node.seen_block),
            replay: Arc::clone(&node.replay),
            consensus: node.consensus.clone(),
            timeouts: Arc::clone(&node.timeouts),
            consensus_evidence: Arc::clone(&node.consensus_evidence),
        }
    }

    fn emit(&self, event: NodeEvent) {
        let _ = self.events.send(event);
    }

    async fn dial_candidates(&self, endpoint: &quinn::Endpoint) {
        let candidates = self.peers.lock().dial_candidates();
        for address in candidates {
            if self.peers.lock().can_dial(&address).is_err() {
                continue;
            }
            self.peers.lock().mark_connecting(&address);
            let delay = self.peers.lock().reconnect_delay(&address);
            let endpoint = endpoint.clone();
            let handle = self.clone();
            let identity_addr = address.clone();
            let peers = Arc::clone(&self.peers);
            tokio::spawn(async move {
                tokio::time::sleep(delay).await;
                let Ok(addr) = identity_addr.to_socket_addr() else {
                    peers.lock().clear_connecting(&identity_addr);
                    return;
                };
                match endpoint.connect(addr, "sunrey-dev-node") {
                    Ok(connecting) => match connecting.await {
                        Ok(conn) => {
                            if let Err(err) = handle
                                .handle_connection(conn, SessionDirection::Outbound)
                                .await
                            {
                                tracing::debug!(error = %err, "outbound connection ended");
                            }
                        }
                        Err(_) => {
                            peers.lock().record_failure(&identity_addr);
                            peers.lock().clear_connecting(&identity_addr);
                        }
                    },
                    Err(_) => {
                        peers.lock().record_failure(&identity_addr);
                        peers.lock().clear_connecting(&identity_addr);
                    }
                }
            });
        }
    }

    async fn handle_connection(
        &self,
        conn: quinn::Connection,
        direction: SessionDirection,
    ) -> NodeResult<()> {
        let remote = conn.remote_address();
        let ip = remote.ip();
        if direction == SessionDirection::Inbound {
            if let Err(reason) = self.peers.lock().can_accept_inbound(ip) {
                self.metrics
                    .rate_limit_events
                    .fetch_add(1, Ordering::Relaxed);
                self.emit(NodeEvent::RateLimited {
                    reason: reason.into(),
                });
                conn.close(0u32.into(), b"limit");
                return Err(NodeError::Peer(reason.into()));
            }
        }
        let (mut send, mut recv) = match direction {
            SessionDirection::Inbound => conn
                .accept_bi()
                .await
                .map_err(|e| NodeError::Transport(e.to_string()))?,
            SessionDirection::Outbound => conn
                .open_bi()
                .await
                .map_err(|e| NodeError::Transport(e.to_string()))?,
        };

        let hello = {
            let chain = self.chain.lock();
            let mut bits = FEATURE_TX_GOSSIP | FEATURE_BLOCK_GOSSIP | FEATURE_STATE_SYNC;
            if self.config.producer {
                bits |= FEATURE_DEV_PRODUCER;
            }
            if self.consensus.is_some() {
                bits |= FEATURE_CONSENSUS;
            }
            build_hello(
                &self.identity,
                &chain.genesis.network_id,
                &chain.genesis.chain_id,
                chain.genesis.hash,
                chain.height(),
                bits,
                rand_nonce(),
            )?
        };
        write_message(
            &mut send,
            Channel::PeerControl,
            &NetMessage::Handshake(hello.encode()?),
        )
        .await?;

        let inbound = read_message(&mut recv).await?;
        let NetMessage::Handshake(raw) = inbound else {
            self.reject(HandshakeRejectReason::Malformed);
            return Err(NodeError::HandshakeRejected {
                reason: HandshakeRejectReason::Malformed,
            });
        };
        let remote_hello = match HandshakeHello::decode(&raw) {
            Ok(hello) => hello,
            Err(_) => {
                self.reject(HandshakeRejectReason::Malformed);
                return Err(NodeError::HandshakeRejected {
                    reason: HandshakeRejectReason::Malformed,
                });
            }
        };
        if let Err(reason) = self.evaluate(&remote_hello, remote.into()) {
            self.reject(reason);
            let _ = write_message(
                &mut send,
                Channel::PeerControl,
                &NetMessage::Disconnect {
                    reason: reason.as_str().into(),
                },
            )
            .await;
            conn.close(1u32.into(), reason.as_str().as_bytes());
            return Err(NodeError::HandshakeRejected { reason });
        }

        let session = PeerSession {
            node_id: remote_hello.node_id,
            public_key: remote_hello.public_key,
            address: PeerAddress::from_socket(remote),
            direction,
            height: remote_hello.height,
            protocol_version: remote_hello.protocol_version,
            codec_version: remote_hello.codec_version,
            crypto_suite: remote_hello.crypto_suite.clone(),
            feature_bits: remote_hello.feature_bits,
            established_at_ms: unix_ms(),
            last_seen_ms: unix_ms(),
        };
        if self.sessions.lock().contains_key(&session.node_id) {
            self.reject(HandshakeRejectReason::DuplicateIdentity);
            conn.close(1u32.into(), b"duplicate");
            return Err(NodeError::HandshakeRejected {
                reason: HandshakeRejectReason::DuplicateIdentity,
            });
        }
        self.sessions
            .lock()
            .insert(session.node_id, session.clone());
        self.peers.lock().record_session(ConnectedPeer {
            node_id: session.node_id,
            address: session.address.clone(),
            ip,
            direction,
            height: session.height,
            last_seen_ms: session.last_seen_ms,
            score: 0,
        });
        self.metrics
            .handshake_success
            .fetch_add(1, Ordering::Relaxed);
        self.emit(NodeEvent::PeerAuthenticated {
            node_id: session.node_id,
            direction,
            height: session.height,
        });

        let notify = Arc::new(tokio::sync::Notify::new());
        let queues = Arc::new(Mutex::new(PriorityQueues::new()));
        self.ios.lock().insert(
            session.node_id,
            PeerIo {
                queues: Arc::clone(&queues),
                notify: Arc::clone(&notify),
            },
        );
        if let Some(consensus) = &self.consensus {
            let actions = {
                let mut reactor = consensus.lock();
                if reactor.engine.started {
                    Vec::new()
                } else {
                    reactor.start()
                }
            };
            self.apply_actions(actions);
        }
        self.share_consensus_state(session.node_id);

        if session.height > self.chain.lock().height() {
            let from = self.chain.lock().height() + 1;
            let to = session.height.min(from + MAX_SYNC_RANGE - 1);
            let _ = write_message(
                &mut send,
                Channel::StateSync,
                &NetMessage::SyncRequest {
                    from_height: from,
                    to_height: to,
                },
            )
            .await;
        }

        let mut msg_rate = RateWindow::new();
        let mut sync_rate = RateWindow::new();
        let mut announce_rate = RateWindow::new();
        loop {
            loop {
                let outgoing = queues.lock().pop();
                let Some((channel, message)) = outgoing else {
                    break;
                };
                if write_message(&mut send, channel, &message).await.is_err() {
                    return Ok(());
                }
                self.metrics.bytes_sent.fetch_add(1, Ordering::Relaxed);
            }
            tokio::select! {
                biased;
                _ = notify.notified() => {}
                inbound = read_message(&mut recv) => {
                    let message = match inbound {
                        Ok(message) => message,
                        Err(NodeError::Codec(_)) => {
                            self.score(session.node_id, 20);
                            self.emit(NodeEvent::MalformedIgnored);
                            break;
                        }
                        Err(_) => break,
                    };
                    self.metrics.bytes_received.fetch_add(1, Ordering::Relaxed);
                    if !msg_rate.allow(unix_ms(), 64, 1_000) {
                        self.metrics.rate_limit_events.fetch_add(1, Ordering::Relaxed);
                        self.emit(NodeEvent::RateLimited { reason: "message flood".into() });
                        self.score(session.node_id, 10);
                        continue;
                    }
                    if let Err(err) = self.on_message(
                        session.node_id,
                        &message,
                        &mut sync_rate,
                        &mut announce_rate,
                    ).await {
                        tracing::debug!(error = %err, "peer message rejected");
                    }
                }
            }
        }

        self.ios.lock().remove(&session.node_id);
        self.sessions.lock().remove(&session.node_id);
        self.peers.lock().disconnect(session.node_id);
        Ok(())
    }

    fn evaluate(
        &self,
        hello: &HandshakeHello,
        address: PeerAddress,
    ) -> Result<(), HandshakeRejectReason> {
        if self.peers.lock().is_banned(&address, Some(hello.node_id)) {
            return Err(HandshakeRejectReason::Banned);
        }
        if !self.peers.lock().allow(hello.node_id) {
            return Err(HandshakeRejectReason::AllowList);
        }
        let chain = self.chain.lock();
        let local = LocalHandshakeView {
            network_id: chain.genesis.network_id.clone(),
            chain_id: chain.genesis.chain_id.clone(),
            genesis_hash: chain.genesis.hash,
            node_id: self.identity.node_id,
            now_ms: unix_ms(),
        };
        drop(chain);
        evaluate_hello(&local, hello, &mut self.replay.lock())
    }

    fn reject(&self, reason: HandshakeRejectReason) {
        self.metrics.inc_handshake_reject(reason.as_str());
        self.emit(NodeEvent::HandshakeRejected { reason });
    }

    fn score(&self, node_id: NodeId, delta: u32) {
        if self.peers.lock().add_score(node_id, delta) {
            self.metrics.peer_bans.fetch_add(1, Ordering::Relaxed);
            self.emit(NodeEvent::PeerBanned { node_id });
            self.ios.lock().remove(&node_id);
        }
    }

    fn send_to(&self, node_id: NodeId, channel: Channel, message: NetMessage) {
        if let Some(io) = self.ios.lock().get(&node_id) {
            if io.queues.lock().push(channel, message) {
                io.notify.notify_one();
            }
        }
    }

    fn broadcast(&self, channel: Channel, message: NetMessage, except: Option<NodeId>) {
        let ios = self.ios.lock();
        for (id, io) in ios.iter() {
            if Some(*id) == except {
                continue;
            }
            if io.queues.lock().push(channel, message.clone()) {
                io.notify.notify_one();
            }
        }
    }

    async fn on_message(
        &self,
        from: NodeId,
        message: &NetMessage,
        sync_rate: &mut RateWindow,
        announce_rate: &mut RateWindow,
    ) -> NodeResult<()> {
        self.peers.lock().touch(from);
        match message {
            NetMessage::Ping { nonce } => {
                self.send_to(
                    from,
                    Channel::PeerControl,
                    NetMessage::Pong { nonce: *nonce },
                );
            }
            NetMessage::Disconnect { .. } => {}
            NetMessage::TxAnnounce { tx_id } => {
                self.metrics
                    .tx_gossip_received
                    .fetch_add(1, Ordering::Relaxed);
                if !announce_rate.allow(unix_ms(), 32, 1_000) {
                    self.metrics
                        .rate_limit_events
                        .fetch_add(1, Ordering::Relaxed);
                    self.emit(NodeEvent::RateLimited {
                        reason: "tx announce flood".into(),
                    });
                    return Ok(());
                }
                if self.seen_tx.lock().insert(*tx_id) {
                    self.send_to(
                        from,
                        Channel::TransactionGossip,
                        NetMessage::TxRequest { tx_id: *tx_id },
                    );
                }
            }
            NetMessage::TxRequest { tx_id } => {
                if let Some(tx) = self.mempool.lock().get(tx_id).cloned() {
                    self.send_to(
                        from,
                        Channel::TransactionGossip,
                        NetMessage::TxResponse { tx },
                    );
                }
            }
            NetMessage::TxResponse { tx } => {
                self.metrics
                    .tx_gossip_received
                    .fetch_add(1, Ordering::Relaxed);
                let admitted = {
                    let chain = self.chain.lock();
                    let mut mempool = self.mempool.lock();
                    mempool.admit(&chain, tx.clone())
                };
                match admitted {
                    Ok(id) => {
                        self.emit(NodeEvent::TxInMempool { tx_id: id });
                        self.broadcast(
                            Channel::TransactionGossip,
                            NetMessage::TxAnnounce { tx_id: id },
                            Some(from),
                        );
                    }
                    Err(_) => {
                        self.metrics
                            .tx_gossip_rejected
                            .fetch_add(1, Ordering::Relaxed);
                        self.score(from, 5);
                    }
                }
            }
            NetMessage::BlockAnnounce { height, block_id } => {
                self.metrics
                    .block_gossip_received
                    .fetch_add(1, Ordering::Relaxed);
                let local_height = self.chain.lock().height();
                if *height == local_height {
                    if let Some(local) = self.chain.lock().block_by_height(*height).cloned() {
                        if local.block_id != *block_id {
                            self.record_fork(&local, *block_id, from, [0u8; 32]);
                        }
                    }
                }
                if *height == local_height + 1 && self.seen_block.lock().insert(*block_id) {
                    self.send_to(
                        from,
                        Channel::BlockGossip,
                        NetMessage::BlockRequest { height: *height },
                    );
                } else if *height > local_height + 1 {
                    let from_h = local_height + 1;
                    let to = (*height).min(from_h + MAX_SYNC_RANGE - 1);
                    self.send_to(
                        from,
                        Channel::StateSync,
                        NetMessage::SyncRequest {
                            from_height: from_h,
                            to_height: to,
                        },
                    );
                }
            }
            NetMessage::BlockRequest { height } => {
                if let Some(block) = self.chain.lock().block_by_height(*height).cloned() {
                    self.send_to(
                        from,
                        Channel::BlockGossip,
                        NetMessage::BlockResponse { block },
                    );
                }
            }
            NetMessage::BlockResponse { block } => {
                self.metrics
                    .block_gossip_received
                    .fetch_add(1, Ordering::Relaxed);
                self.apply_remote_block(from, block.clone())?;
            }
            NetMessage::SyncRequest {
                from_height,
                to_height,
            } => {
                if !sync_rate.allow(unix_ms(), 4, 1_000) {
                    self.metrics
                        .rate_limit_events
                        .fetch_add(1, Ordering::Relaxed);
                    self.emit(NodeEvent::RateLimited {
                        reason: "sync request flood".into(),
                    });
                    self.score(from, 15);
                    return Ok(());
                }
                if to_height.saturating_sub(*from_height) + 1 > MAX_SYNC_RANGE {
                    self.metrics
                        .rate_limit_events
                        .fetch_add(1, Ordering::Relaxed);
                    self.emit(NodeEvent::RateLimited {
                        reason: "excessive block-range request".into(),
                    });
                    self.score(from, 20);
                    return Ok(());
                }
                let mut blocks = Vec::new();
                let chain = self.chain.lock();
                for height in *from_height..=*to_height {
                    if let Some(block) = chain.block_by_height(height) {
                        blocks.push(block.clone());
                    }
                }
                drop(chain);
                self.send_to(
                    from,
                    Channel::StateSync,
                    NetMessage::SyncResponse { blocks },
                );
            }
            NetMessage::SyncResponse { blocks } => {
                for block in blocks {
                    self.apply_remote_block(from, block.clone())?;
                }
                self.emit(NodeEvent::SyncCaughtUp {
                    height: self.chain.lock().height(),
                });
            }
            NetMessage::Handshake(_) | NetMessage::Pong { .. } => {}
            NetMessage::Consensus(message) => {
                self.on_consensus_message(from, message.clone());
            }
        }
        Ok(())
    }

    fn share_consensus_state(&self, to: NodeId) {
        let Some(consensus) = &self.consensus else {
            return;
        };
        let reactor = consensus.lock();
        let engine = &reactor.engine;
        self.send_to(
            to,
            Channel::Consensus,
            NetMessage::Consensus(ConsensusMessage::RoundStateHint {
                height: engine.height,
                round: engine.round,
                step: engine.step,
            }),
        );
        if let Some(proposal) = engine.proposals.get(&(engine.height, engine.round)) {
            if let Some(block) = engine.blocks.get(&proposal.block_id) {
                self.send_to(
                    to,
                    Channel::Consensus,
                    NetMessage::Consensus(ConsensusMessage::ProposalResponse {
                        proposal: proposal.clone(),
                        block: block.clone(),
                    }),
                );
            }
        }
        if let Some(set) = engine.prevotes.get(&(engine.height, engine.round)) {
            for vote in set.votes() {
                self.send_to(
                    to,
                    Channel::Consensus,
                    NetMessage::Consensus(ConsensusMessage::Prevote(vote.clone())),
                );
            }
        }
        if let Some(set) = engine.precommits.get(&(engine.height, engine.round)) {
            for vote in set.votes() {
                self.send_to(
                    to,
                    Channel::Consensus,
                    NetMessage::Consensus(ConsensusMessage::Precommit(vote.clone())),
                );
            }
        }
        let height = engine.store.finalized_height();
        if height > 0 {
            if let (Some(certificate), Some(block)) = (
                engine.store.commit_certificate(height).cloned(),
                engine.store.finalized_block(height).cloned(),
            ) {
                self.send_to(
                    to,
                    Channel::Consensus,
                    NetMessage::Consensus(ConsensusMessage::CommitResponse { certificate, block }),
                );
            }
        }
    }

    fn on_consensus_message(&self, from: NodeId, message: ConsensusMessage) {
        let Some(consensus) = &self.consensus else {
            return;
        };
        let set = self
            .config
            .consensus
            .as_ref()
            .map(|c| c.validator_set.clone())
            .unwrap_or_default();
        let ctx = ConsensusAuthContext {
            network_id: &self.config.genesis.network_id,
            chain_id: &self.config.genesis.chain_id,
            genesis_hash: self.config.genesis.hash,
            validator_set: &set,
            peer_id: Some(from),
            peer_is_validator: set.validators.iter().any(|_| true),
        };
        let (actions, gossip) = {
            let mut reactor = consensus.lock();
            reactor.ingest(&ctx, message.clone())
        };
        if gossip {
            self.broadcast(
                Channel::Consensus,
                NetMessage::Consensus(message),
                Some(from),
            );
        }
        self.apply_actions(actions);
        let more = {
            let mut reactor = consensus.lock();
            reactor.drain_buffer()
        };
        self.apply_actions(more);
    }

    fn apply_actions(&self, actions: Vec<Action>) {
        for action in actions {
            match action {
                Action::Broadcast(message) => {
                    self.broadcast(Channel::Consensus, NetMessage::Consensus(message), None);
                }
                Action::RequestProposal {
                    height,
                    round,
                    block_id,
                } => {
                    self.broadcast(
                        Channel::Consensus,
                        NetMessage::Consensus(ConsensusMessage::ProposalRequest {
                            height,
                            round,
                            block_id,
                        }),
                        None,
                    );
                }
                Action::RequestCommit { height } => {
                    self.broadcast(
                        Channel::Consensus,
                        NetMessage::Consensus(ConsensusMessage::CommitRequest { height }),
                        None,
                    );
                }
                Action::NeedProposalBlock { height, .. } => {
                    if self.chain.lock().height() + 1 != height {
                        continue;
                    }
                    let block = {
                        let chain = self.chain.lock();
                        let mempool = self.mempool.lock();
                        let selected = mempool.select_for_block();
                        chain.propose_block(selected, unix_ms())
                    };
                    if let Ok(block) = block {
                        if let Some(consensus) = &self.consensus {
                            let next = consensus.lock().on_local_block(block);
                            self.apply_actions(next);
                        }
                    }
                }
                Action::Finalize { block, certificate } => {
                    let applied = {
                        let mut chain = self.chain.lock();
                        if chain.block_by_id(&block.block_id).is_some() {
                            Ok(block.header.state_root)
                        } else if block.header.height == chain.height() + 1 {
                            chain.apply_block(block.clone())
                        } else {
                            Err(NodeError::Sync(
                                "commit height not next local height".into(),
                            ))
                        }
                    };
                    if let Ok(root) = applied {
                        let mut mempool = self.mempool.lock();
                        mempool.remove_committed(&block.transactions);
                        drop(mempool);
                        self.seen_block.lock().insert(block.block_id);
                        self.emit(NodeEvent::BlockCommitted {
                            height: block.header.height,
                            block_id: block.block_id,
                            state_root: root,
                        });
                        self.emit(NodeEvent::ConsensusFinalized {
                            height: certificate.height,
                            block_id: certificate.block_id,
                            state_root: certificate.state_root,
                            round: certificate.round,
                        });
                        if let Some(consensus) = &self.consensus {
                            consensus.lock().metrics.observe_latency(
                                "finality",
                                0,
                                crate::identity::unix_ms(),
                            );
                        }
                    }
                }
                Action::ScheduleTimeout {
                    kind,
                    height,
                    round,
                    delay,
                } => {
                    self.timeouts.lock().push(ScheduledTimeout {
                        kind,
                        height,
                        round,
                        at: Instant::now() + delay,
                    });
                }
                Action::Evidence(evidence) => {
                    self.consensus_evidence.lock().push(evidence);
                }
                Action::Reject { reason } => {
                    if let Some(consensus) = &self.consensus {
                        consensus
                            .lock()
                            .metrics
                            .consensus_message_rejects
                            .fetch_add(1, Ordering::Relaxed);
                    }
                    self.emit(NodeEvent::ConsensusRejected {
                        reason: reason.as_str().into(),
                    });
                }
            }
        }
    }

    fn apply_remote_block(&self, from: NodeId, block: Block) -> NodeResult<()> {
        if let Some(consensus) = &self.consensus {
            consensus
                .lock()
                .engine
                .apply_remote_block_for_catchup(block.clone());
            self.broadcast(
                Channel::Consensus,
                NetMessage::Consensus(ConsensusMessage::CommitRequest {
                    height: block.header.height,
                }),
                Some(from),
            );
            return Ok(());
        }
        let mut chain = self.chain.lock();
        if block.header.height <= chain.height() {
            if let Some(local) = chain.block_by_height(block.header.height) {
                if local.block_id != block.block_id {
                    let local = local.clone();
                    drop(chain);
                    self.record_fork(&local, block.block_id, from, block.header.state_root);
                }
            }
            return Ok(());
        }
        if block.header.height != chain.height() + 1 {
            return Ok(());
        }
        match chain.apply_block(block.clone()) {
            Ok(root) => {
                let mut mempool = self.mempool.lock();
                mempool.remove_committed(&block.transactions);
                mempool.revalidate(&chain);
                drop(mempool);
                drop(chain);
                self.seen_block.lock().insert(block.block_id);
                self.emit(NodeEvent::BlockCommitted {
                    height: block.header.height,
                    block_id: block.block_id,
                    state_root: root,
                });
                self.broadcast(
                    Channel::BlockGossip,
                    NetMessage::BlockAnnounce {
                        height: block.header.height,
                        block_id: block.block_id,
                    },
                    Some(from),
                );
                Ok(())
            }
            Err(err) => {
                drop(chain);
                self.score(from, 25);
                Err(err)
            }
        }
    }

    fn record_fork(&self, local: &Block, remote_id: [u8; 32], from: NodeId, remote_root: [u8; 32]) {
        let evidence = ForkEvidence::new(
            local.header.height,
            local.block_id,
            remote_id,
            from,
            local.header.state_root,
            remote_root,
        );
        self.forks.lock().push(evidence.clone());
        self.metrics.fork_detected.fetch_add(1, Ordering::Relaxed);
        self.emit(NodeEvent::ForkDetected(evidence));
    }
}

async fn write_message<S: AsyncWriteExt + Unpin>(
    send: &mut S,
    channel: Channel,
    message: &NetMessage,
) -> NodeResult<()> {
    let payload = message.encode()?;
    let raw = encode_frame(&Frame {
        channel,
        flags: 0,
        payload,
    })?;
    send.write_all(&(raw.len() as u32).to_be_bytes())
        .await
        .map_err(|e| NodeError::Transport(e.to_string()))?;
    send.write_all(&raw)
        .await
        .map_err(|e| NodeError::Transport(e.to_string()))?;
    send.flush()
        .await
        .map_err(|e| NodeError::Transport(e.to_string()))
}

async fn read_message<R: AsyncReadExt + Unpin>(recv: &mut R) -> NodeResult<NetMessage> {
    let mut len_buf = [0u8; 4];
    recv.read_exact(&mut len_buf)
        .await
        .map_err(|e| NodeError::Transport(e.to_string()))?;
    let len = u32::from_be_bytes(len_buf);
    if len > crate::codec::MAX_FRAME_BYTES + 16 {
        return Err(NodeError::Codec("oversized frame".into()));
    }
    let mut raw = vec![0u8; len as usize];
    recv.read_exact(&mut raw)
        .await
        .map_err(|e| NodeError::Transport(e.to_string()))?;
    let frame = crate::codec::decode_frame(&raw)?;
    NetMessage::decode(&frame.payload)
}

fn rand_nonce() -> [u8; 32] {
    let mut nonce = [0u8; 32];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut nonce);
    nonce
}

impl From<SocketAddr> for PeerAddress {
    fn from(value: SocketAddr) -> Self {
        PeerAddress::from_socket(value)
    }
}

/// Wallet helper used by tests and the required demo. Not a P2P key.
pub fn generate_wallet() -> DomainKey {
    DomainKey::generate(crate::crypto::KeyDomain::TxWallet)
}
