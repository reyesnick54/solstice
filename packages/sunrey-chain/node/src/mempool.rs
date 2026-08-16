use std::collections::HashMap;

use crate::chain::{DevChain, Transaction, MAX_TX_BYTES};
use crate::error::{NodeError, NodeResult};
use crate::identity::unix_ms;

#[derive(Debug, Clone)]
pub struct MempoolConfig {
    pub max_count: usize,
    pub max_bytes: usize,
    pub max_per_actor: usize,
    pub max_tx_bytes: usize,
}

impl Default for MempoolConfig {
    fn default() -> Self {
        Self {
            max_count: 1_024,
            max_bytes: 2_000_000,
            max_per_actor: 16,
            max_tx_bytes: MAX_TX_BYTES,
        }
    }
}

#[derive(Debug, Clone)]
struct Entry {
    tx: Transaction,
    bytes: usize,
}

#[derive(Debug, Clone)]
pub struct Mempool {
    config: MempoolConfig,
    by_id: HashMap<[u8; 32], Entry>,
    bytes: usize,
}

impl Mempool {
    pub fn new(config: MempoolConfig) -> Self {
        Self {
            config,
            by_id: HashMap::new(),
            bytes: 0,
        }
    }

    pub fn count(&self) -> usize {
        self.by_id.len()
    }

    pub fn bytes(&self) -> usize {
        self.bytes
    }

    pub fn contains(&self, id: &[u8; 32]) -> bool {
        self.by_id.contains_key(id)
    }

    pub fn get(&self, id: &[u8; 32]) -> Option<&Transaction> {
        self.by_id.get(id).map(|e| &e.tx)
    }

    pub fn admit(&mut self, chain: &DevChain, tx: Transaction) -> NodeResult<[u8; 32]> {
        let now = unix_ms();
        if tx.encoded_len() > self.config.max_tx_bytes {
            return Err(NodeError::Mempool("transaction exceeds max size".into()));
        }
        chain.validate_tx_stateless(&tx, now)?;
        chain.validate_tx_stateful(&tx)?;
        let id = tx.id();
        if self.by_id.contains_key(&id) {
            return Err(NodeError::Mempool("duplicate transaction id".into()));
        }
        let per_actor = self
            .by_id
            .values()
            .filter(|e| e.tx.actor_id == tx.actor_id)
            .count();
        if per_actor >= self.config.max_per_actor {
            return Err(NodeError::Mempool("per-actor mempool limit".into()));
        }
        if self.by_id.len() >= self.config.max_count {
            return Err(NodeError::Mempool("global count limit".into()));
        }
        let size = tx.encoded_len();
        if self.bytes + size > self.config.max_bytes {
            return Err(NodeError::Mempool("global byte limit".into()));
        }
        self.bytes += size;
        self.by_id.insert(id, Entry { tx, bytes: size });
        Ok(id)
    }

    pub fn select_for_block(&self) -> Vec<Transaction> {
        let mut txs: Vec<_> = self.by_id.values().map(|e| e.tx.clone()).collect();
        txs.sort_by(|a, b| {
            a.actor_id
                .cmp(&b.actor_id)
                .then(a.nonce.cmp(&b.nonce))
                .then(a.id().cmp(&b.id()))
        });
        txs
    }

    pub fn remove_committed(&mut self, txs: &[Transaction]) {
        for tx in txs {
            if let Some(entry) = self.by_id.remove(&tx.id()) {
                self.bytes = self.bytes.saturating_sub(entry.bytes);
            }
        }
    }

    pub fn revalidate(&mut self, chain: &DevChain) {
        let now = unix_ms();
        let ids: Vec<_> = self.by_id.keys().copied().collect();
        for id in ids {
            let Some(entry) = self.by_id.get(&id) else {
                continue;
            };
            let ok = chain.validate_tx_stateless(&entry.tx, now).is_ok()
                && chain.validate_tx_stateful(&entry.tx).is_ok();
            if !ok {
                if let Some(removed) = self.by_id.remove(&id) {
                    self.bytes = self.bytes.saturating_sub(removed.bytes);
                }
            }
        }
    }
}
