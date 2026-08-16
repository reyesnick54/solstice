//! Local SunRey development node. Not a production BFT engine.

use std::collections::VecDeque;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use sunrey_crypto::{
    crypto_policy_hash, development_fixture_secret, schema_registry_hash, suite_by_id, CryptoSuite,
    DevEd25519Sha256Suite, SigningSecret, DEV_ALGORITHM_ID, DEV_KEY_ID, DEV_SUITE_ID,
};
use sunrey_execution::{apply_transaction, install_genesis_assets};
use sunrey_protocol::{
    block_id, genesis_hash, hash_to_hex, transaction_id, transaction_root,
    unsigned_signature_payload, validate_block_header, BlockHeader, BlockResult, DomainHasher,
    GenesisV1, Hash32, RejectReason, SignatureDescriptor, SignedTransaction, TransactionFamily,
    UnsignedTransaction, BLOCK_VERSION_V1, DOMAIN_CONSENSUS_PARAMS, DOMAIN_VALSET,
    LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID,
};
use sunrey_state::ChainView;
use sunrey_storage::{ChainStore, FailPoint, StoredBlock};
use tracing::{error, info, warn};

pub const DEV_BLOCK_PRODUCER: &str = "DEV_BLOCK_PRODUCER";
pub const NODE_ROLE: &str = "LOCAL_DEVELOPMENT_SIMULATION";

#[derive(Debug, Default)]
pub struct NodeMetrics {
    pub blocks_committed: AtomicU64,
    pub txs_accepted: AtomicU64,
    pub txs_rejected: AtomicU64,
    pub replays: AtomicU64,
    pub db_errors: AtomicU64,
    pub last_commit_micros: AtomicU64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct NodeStatus {
    pub environment: String,
    pub role: String,
    pub producer: String,
    pub network_id: String,
    pub chain_id: String,
    pub genesis_hash: String,
    pub height: u64,
    pub latest_block_id: String,
    pub app_hash: String,
    pub transaction_root: String,
    pub queue_len: usize,
    pub ready: bool,
}

pub struct LocalNode {
    pub store: ChainStore,
    pub suite: DevEd25519Sha256Suite,
    pub genesis_hash: Hash32,
    queue: VecDeque<QueuedTx>,
    pub metrics: NodeMetrics,
}

struct QueuedTx {
    tx: SignedTransaction,
    tx_id: Hash32,
}

impl LocalNode {
    pub fn init(data_dir: impl AsRef<Path>) -> Result<Self, RejectReason> {
        let data_dir = data_dir.as_ref();
        if data_dir.join("genesis.bin").exists() {
            return Self::open(data_dir);
        }
        let suite = DevEd25519Sha256Suite;
        let schema_hash = schema_registry_hash(&suite);
        let genesis =
            sunrey_protocol::local_dev_genesis(schema_hash.to_vec(), DEV_SUITE_ID.to_string());
        let mut view = ChainView::default();
        install_genesis_assets(&mut view, &genesis);
        let app_hash = view.store.app_hash(&suite);
        let ghash = genesis_hash(&suite, &genesis);
        info!(
            event = "genesis",
            environment = "simulation",
            role = NODE_ROLE,
            network_id = LOCAL_DEV_NETWORK_ID,
            chain_id = LOCAL_DEV_CHAIN_ID,
            genesis_hash = hash_to_hex(&ghash),
            "initialized local development genesis"
        );
        let mut store = ChainStore::init(data_dir, genesis, ghash, app_hash)?;
        store.view = view;
        store.persist_state_and_meta()?;
        let node = Self {
            store,
            suite,
            genesis_hash: ghash,
            queue: VecDeque::new(),
            metrics: NodeMetrics::default(),
        };
        node.persist_queue()?;
        Ok(node)
    }

    pub fn open(data_dir: impl AsRef<Path>) -> Result<Self, RejectReason> {
        let suite = DevEd25519Sha256Suite;
        let store = ChainStore::open(&data_dir)?;
        let ghash = genesis_hash(&suite, &store.genesis);
        let queue = load_queue(store.data_dir())?;
        info!(
            event = "node_startup",
            environment = "simulation",
            role = NODE_ROLE,
            height = store.meta.height,
            genesis_hash = hash_to_hex(&ghash),
            "opened local development node"
        );
        Ok(Self { store, suite, genesis_hash: ghash, queue, metrics: NodeMetrics::default() })
    }

    fn persist_queue(&self) -> Result<(), RejectReason> {
        persist_queue(self.store.data_dir(), &self.queue)
    }

    pub fn set_fail_point(&mut self, point: FailPoint) {
        self.store.fail_point = point;
    }

    pub fn status(&self) -> NodeStatus {
        NodeStatus {
            environment: self.store.genesis.environment.clone(),
            role: NODE_ROLE.to_string(),
            producer: DEV_BLOCK_PRODUCER.to_string(),
            network_id: self.store.genesis.network_id.clone(),
            chain_id: self.store.genesis.chain_id.clone(),
            genesis_hash: hash_to_hex(&self.genesis_hash),
            height: self.store.meta.height,
            latest_block_id: self.store.meta.tip_block_id.clone(),
            app_hash: self.store.meta.app_hash.clone(),
            transaction_root: self.store.meta.transaction_root.clone(),
            queue_len: self.queue.len(),
            ready: true,
        }
    }

    pub fn submit_bytes(&mut self, bytes: &[u8]) -> Result<String, RejectReason> {
        let tx = SignedTransaction::decode(bytes).map_err(|reason| self.reject(reason))?;
        self.admit(tx)
    }

    pub fn submit_signed(&mut self, tx: SignedTransaction) -> Result<String, RejectReason> {
        self.admit(tx)
    }

    fn admit(&mut self, tx: SignedTransaction) -> Result<String, RejectReason> {
        let tx_id = match self.validate_for_admission(&tx, &self.store.view) {
            Ok(id) => id,
            Err(reason) => return Err(self.reject(reason)),
        };
        if self.queue.len() >= self.store.genesis.queue_bound as usize {
            return Err(self.reject(RejectReason::QueueFull));
        }
        if self.queue.iter().any(|queued| queued.tx_id == tx_id) {
            return Err(self.reject(RejectReason::Replay));
        }
        let hex = hash_to_hex(&tx_id);
        self.queue.push_back(QueuedTx { tx, tx_id });
        self.persist_queue()?;
        self.metrics.txs_accepted.fetch_add(1, Ordering::Relaxed);
        info!(event = "tx_accepted", tx_id = %hex, "transaction admitted to local queue");
        Ok(hex)
    }

    fn reject(&self, reason: RejectReason) -> RejectReason {
        self.metrics.txs_rejected.fetch_add(1, Ordering::Relaxed);
        if reason == RejectReason::Replay {
            self.metrics.replays.fetch_add(1, Ordering::Relaxed);
        }
        warn!(event = "tx_rejected", reason = reason.as_str(), "transaction rejected");
        reason
    }

    fn validate_for_admission(
        &self,
        tx: &SignedTransaction,
        view: &ChainView,
    ) -> Result<Hash32, RejectReason> {
        let encoded = tx.encode();
        if encoded.len() > self.store.genesis.max_tx_bytes as usize {
            return Err(RejectReason::SizeExceeded);
        }
        let unsigned = &tx.unsigned;
        if unsigned.network_id != self.store.genesis.network_id {
            return Err(RejectReason::WrongNetwork);
        }
        if unsigned.chain_id != self.store.genesis.chain_id {
            return Err(RejectReason::WrongChain);
        }
        if unsigned.codec_id != self.store.genesis.codec_id
            || unsigned.schema_version != self.store.genesis.state_schema_version
        {
            return Err(RejectReason::SchemaInvalid);
        }
        if !self.store.genesis.family_activated(unsigned.family) {
            return Err(RejectReason::TransactionNotActivated);
        }
        self.validate_payload(unsigned)?;
        if tx.auth.is_empty() {
            return Err(RejectReason::InvalidSignatureDescriptor);
        }
        let tx_id = transaction_id(&self.suite, unsigned);
        if view.seen_tx_ids.contains(&tx_id) {
            return Err(RejectReason::Replay);
        }
        let message = unsigned_signature_payload(&self.suite, unsigned);
        let mut signer = None;
        for descriptor in &tx.auth {
            self.validate_descriptor(descriptor)?;
            let suite = suite_by_id(&descriptor.suite_id).map_err(RejectReason::from)?;
            suite
                .verify(&descriptor.public_key, &message, &descriptor.signature)
                .map_err(RejectReason::from)?;
            signer = Some(descriptor.public_key.clone());
        }
        let signer = signer.ok_or(RejectReason::InvalidSignatureDescriptor)?;
        if unsigned.nonce != view.next_nonce(&signer) {
            return Err(RejectReason::Replay);
        }
        if !unsigned.idempotency_key.is_empty()
            && view.store.contains(&sunrey_state::ObjectStore::namespaced(
                sunrey_state::NS_IDEM,
                unsigned.idempotency_key.as_bytes(),
            ))
        {
            return Err(RejectReason::Replay);
        }
        Ok(tx_id)
    }

    fn validate_descriptor(&self, descriptor: &SignatureDescriptor) -> Result<(), RejectReason> {
        if descriptor.suite_id != DEV_SUITE_ID {
            return Err(RejectReason::InvalidCryptoSuite);
        }
        if descriptor.algorithm_id != DEV_ALGORITHM_ID {
            return Err(RejectReason::InvalidCryptoSuite);
        }
        if descriptor.key_id.is_empty()
            || descriptor.public_key.len() != 32
            || descriptor.signature.len() != 64
        {
            return Err(RejectReason::InvalidSignatureDescriptor);
        }
        Ok(())
    }

    fn validate_payload(&self, unsigned: &UnsignedTransaction) -> Result<(), RejectReason> {
        match unsigned.family {
            TransactionFamily::System => {
                let payload = sunrey_protocol::decode_system_payload(&unsigned.payload)?;
                if payload.op != "SET_OBJECT" && payload.op != "NOTE" {
                    return Err(RejectReason::StatelessInvalid);
                }
            }
            TransactionFamily::EvidenceAnchor => {
                let payload = sunrey_protocol::decode_evidence_anchor_payload(&unsigned.payload)?;
                if payload.vault_record_hash.len() != 64 {
                    return Err(RejectReason::StatelessInvalid);
                }
            }
            _ => return Err(RejectReason::TransactionNotActivated),
        }
        Ok(())
    }

    pub fn produce_block(&mut self) -> Result<BlockResult, RejectReason> {
        if self.store.fail_point == FailPoint::BeforeExecution {
            return Err(RejectReason::InvalidStateTransition);
        }
        let started = Instant::now();
        let mut taken = Vec::new();
        while taken.len() < self.store.genesis.max_block_txs as usize {
            match self.queue.pop_front() {
                Some(item) => taken.push(item),
                None => break,
            }
        }
        let mut next_view = self.store.view.clone();
        let mut included = Vec::new();
        let mut rejected = Vec::new();
        for item in taken {
            if self.store.fail_point == FailPoint::DuringExecution {
                return Err(RejectReason::InvalidStateTransition);
            }
            match self.apply_one(&mut next_view, item.tx) {
                Ok((tx, tx_id)) => included.push((tx, tx_id)),
                Err((tx_id, reason)) => {
                    rejected.push(sunrey_protocol::RejectedTx {
                        tx_id: hash_to_hex(&tx_id),
                        reason: reason.as_str().to_string(),
                    });
                    self.metrics.txs_rejected.fetch_add(1, Ordering::Relaxed);
                }
            }
        }
        let tx_ids: Vec<Hash32> = included.iter().map(|(_, id)| *id).collect();
        let transactions: Vec<SignedTransaction> = included.into_iter().map(|(tx, _)| tx).collect();
        let tx_root = transaction_root(&self.suite, &tx_ids);
        let app_hash = next_view.store.app_hash(&self.suite);
        let height = self.store.meta.height + 1;
        let parent = if height == 1 {
            self.genesis_hash
        } else {
            sunrey_protocol::hash_from_hex(&self.store.meta.tip_block_id)?
        };
        let header = BlockHeader {
            version: BLOCK_VERSION_V1,
            network_id: self.store.genesis.network_id.clone(),
            chain_id: self.store.genesis.chain_id.clone(),
            height,
            parent_block_id: parent,
            transaction_root: tx_root,
            app_hash,
            validator_set_hash: self
                .suite
                .hash(DOMAIN_VALSET, self.store.genesis.validator_placeholder.as_bytes()),
            consensus_parameter_hash: self
                .suite
                .hash(DOMAIN_CONSENSUS_PARAMS, &self.store.genesis.block_interval_ms.to_be_bytes()),
            timestamp_unix_ms: self.store.genesis.genesis_time_unix_ms
                + height * self.store.genesis.block_interval_ms,
            proposer: DEV_BLOCK_PRODUCER.to_string(),
            crypto_suite_id: DEV_SUITE_ID.to_string(),
        };
        validate_block_header(
            &header,
            &self.store.genesis.network_id,
            &self.store.genesis.chain_id,
            height,
            &parent,
            &tx_root,
            &app_hash,
        )?;
        let bid = block_id(&self.suite, &header);
        info!(
            event = "block_execution",
            height,
            tx_count = transactions.len(),
            producer = DEV_BLOCK_PRODUCER,
            "DEV_BLOCK_PRODUCER constructed local development block"
        );
        self.persist_queue()?;
        match self.store.commit_block(&header, bid, &transactions, &tx_ids, next_view) {
            Ok(()) => {}
            Err(reason) => {
                self.metrics.db_errors.fetch_add(1, Ordering::Relaxed);
                error!(event = "database_error", reason = reason.as_str(), "block commit failed");
                return Err(reason);
            }
        }
        let micros = started.elapsed().as_micros() as u64;
        self.metrics.last_commit_micros.store(micros, Ordering::Relaxed);
        self.metrics.blocks_committed.fetch_add(1, Ordering::Relaxed);
        info!(
            event = "block_commit",
            height,
            block_id = hash_to_hex(&bid),
            app_hash = hash_to_hex(&app_hash),
            duration_micros = micros,
            "block committed atomically"
        );
        Ok(BlockResult {
            height,
            block_id: hash_to_hex(&bid),
            transaction_root: hash_to_hex(&tx_root),
            app_hash: hash_to_hex(&app_hash),
            tx_ids: tx_ids.iter().map(hash_to_hex).collect(),
            rejected,
        })
    }

    fn apply_one(
        &self,
        view: &mut ChainView,
        tx: SignedTransaction,
    ) -> Result<(SignedTransaction, Hash32), (Hash32, RejectReason)> {
        let tx_id = transaction_id(&self.suite, &tx.unsigned);
        if let Err(reason) = self.validate_for_admission(&tx, view) {
            return Err((tx_id, reason));
        }
        let signer = tx.auth[0].public_key.clone();
        if let Err(reason) = view.record_tx_id(tx_id) {
            return Err((tx_id, reason));
        }
        if let Err(reason) = view.record_nonce(&signer, tx.unsigned.nonce) {
            return Err((tx_id, reason));
        }
        if let Err(reason) = view.record_idempotency(&tx.unsigned.idempotency_key) {
            return Err((tx_id, reason));
        }
        if let Err(reason) = apply_transaction(view, &tx) {
            return Err((tx_id, reason));
        }
        Ok((tx, tx_id))
    }

    pub fn validate_stored_block(&self, stored: &StoredBlock) -> Result<(), RejectReason> {
        let mut tx_ids = Vec::new();
        let mut seen = std::collections::BTreeSet::new();
        for tx in &stored.transactions {
            if tx.unsigned.network_id != self.store.genesis.network_id {
                return Err(RejectReason::WrongNetwork);
            }
            if tx.unsigned.chain_id != self.store.genesis.chain_id {
                return Err(RejectReason::WrongChain);
            }
            let tx_id = transaction_id(&self.suite, &tx.unsigned);
            if !seen.insert(tx_id) {
                return Err(RejectReason::DuplicateTransaction);
            }
            tx_ids.push(tx_id);
        }
        let tx_root = transaction_root(&self.suite, &tx_ids);
        let parent = if stored.header.height == 1 {
            self.genesis_hash
        } else {
            let previous = self.store.load_block(stored.header.height - 1)?;
            block_id(&self.suite, &previous.header)
        };
        validate_block_header(
            &stored.header,
            &self.store.genesis.network_id,
            &self.store.genesis.chain_id,
            stored.header.height,
            &parent,
            &tx_root,
            &stored.header.app_hash,
        )?;
        if stored.header.crypto_suite_id != DEV_SUITE_ID {
            return Err(RejectReason::InvalidCryptoSuite);
        }
        Ok(())
    }

    pub fn sign_dev_tx(
        &self,
        unsigned: UnsignedTransaction,
        secret: &SigningSecret,
    ) -> Result<SignedTransaction, RejectReason> {
        let message = unsigned_signature_payload(&self.suite, &unsigned);
        let signature = self.suite.sign(secret, &message).map_err(RejectReason::from)?;
        Ok(SignedTransaction {
            unsigned,
            auth: vec![SignatureDescriptor {
                suite_id: DEV_SUITE_ID.to_string(),
                algorithm_id: DEV_ALGORITHM_ID.to_string(),
                key_id: DEV_KEY_ID.to_string(),
                public_key: secret.public_key(),
                signature,
            }],
        })
    }

    pub fn fixture_secret() -> SigningSecret {
        development_fixture_secret()
    }

    pub fn lookup_tx(
        &self,
        tx_id_hex: &str,
    ) -> Result<(u64, SignedTransaction, String), RejectReason> {
        let height = self.store.lookup_tx_height(tx_id_hex)?;
        let block = self.store.load_block(height)?;
        for tx in block.transactions {
            if hash_to_hex(&transaction_id(&self.suite, &tx.unsigned)) == tx_id_hex {
                return Ok((height, tx, hash_to_hex(&block_id(&self.suite, &block.header))));
            }
        }
        Err(RejectReason::NotFound)
    }

    pub fn get_state(&self, key: &str) -> Option<Vec<u8>> {
        let raw = key.as_bytes();
        self.store
            .view
            .store
            .get(raw)
            .map(|v| v.to_vec())
            .or_else(|| {
                self.store
                    .view
                    .store
                    .get(&sunrey_state::ObjectStore::namespaced(sunrey_state::NS_OBJECT, raw))
                    .map(|v| v.to_vec())
            })
            .or_else(|| {
                self.store
                    .view
                    .store
                    .get(&sunrey_state::ObjectStore::namespaced(sunrey_state::NS_SYSTEM, raw))
                    .map(|v| v.to_vec())
            })
            .or_else(|| {
                self.store
                    .view
                    .store
                    .get(&sunrey_state::ObjectStore::namespaced(sunrey_state::NS_EVIDENCE, raw))
                    .map(|v| v.to_vec())
            })
    }

    pub fn verify_chain(&self) -> Result<(), RejectReason> {
        let mut expected_parent = self.genesis_hash;
        for height in 1..=self.store.meta.height {
            let mut stored = self.store.load_block(height)?;
            stored.block_id = block_id(&self.suite, &stored.header);
            if stored.header.parent_block_id != expected_parent {
                return Err(RejectReason::IncorrectParent);
            }
            self.validate_stored_block(&stored)?;
            expected_parent = stored.block_id;
        }
        Ok(())
    }

    pub fn genesis(&self) -> &GenesisV1 {
        &self.store.genesis
    }

    pub fn crypto_policy_commitment(&self) -> String {
        hash_to_hex(&crypto_policy_hash(&self.suite))
    }
}

pub fn parent_genesis_hash(node: &LocalNode) -> Hash32 {
    node.genesis_hash
}

fn persist_queue(dir: &Path, queue: &VecDeque<QueuedTx>) -> Result<(), RejectReason> {
    let mut out = Vec::new();
    sunrey_protocol::encode_u32(&mut out, queue.len() as u32);
    for item in queue {
        sunrey_protocol::encode_bytes(&mut out, &item.tx.encode());
    }
    let path = dir.join("queue.bin");
    let tmp = dir.join("queue.tmp");
    std::fs::write(&tmp, &out).map_err(|_| RejectReason::PersistenceFailure)?;
    std::fs::rename(tmp, path).map_err(|_| RejectReason::PersistenceFailure)?;
    Ok(())
}

fn load_queue(dir: &Path) -> Result<VecDeque<QueuedTx>, RejectReason> {
    let path = dir.join("queue.bin");
    if !path.exists() {
        return Ok(VecDeque::new());
    }
    let bytes = std::fs::read(path).map_err(|_| RejectReason::CorruptStore)?;
    let mut input = bytes.as_slice();
    let count =
        sunrey_protocol::decode_u32(&mut input).map_err(|_| RejectReason::CorruptStore)? as usize;
    let mut queue = VecDeque::new();
    for _ in 0..count {
        let encoded =
            sunrey_protocol::decode_bytes(&mut input).map_err(|_| RejectReason::CorruptStore)?;
        let tx = SignedTransaction::decode(&encoded)?;
        let tx_id = transaction_id(&DevEd25519Sha256Suite, &tx.unsigned);
        queue.push_back(QueuedTx { tx, tx_id });
    }
    Ok(queue)
}
