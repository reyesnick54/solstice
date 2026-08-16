//! Deterministic typed object store. Iteration is BTree-ordered.

use std::collections::{BTreeMap, BTreeSet};

use sunrey_protocol::{state_root, DomainHasher, Hash32, RejectReason};

pub const NS_OBJECT: &[u8] = b"obj/";
pub const NS_SYSTEM: &[u8] = b"sys/";
pub const NS_EVIDENCE: &[u8] = b"evi/";
pub const NS_ASSET: &[u8] = b"ast/";
pub const NS_NONCE: &[u8] = b"non/";
pub const NS_IDEM: &[u8] = b"idm/";
pub const NS_TX: &[u8] = b"txi/";
pub const NS_FEE: &[u8] = b"fee/";

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ObjectStore {
    entries: BTreeMap<Vec<u8>, Vec<u8>>,
}

impl ObjectStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn from_entries(entries: BTreeMap<Vec<u8>, Vec<u8>>) -> Self {
        Self { entries }
    }

    pub fn get(&self, key: &[u8]) -> Option<&[u8]> {
        self.entries.get(key).map(|value| value.as_slice())
    }

    pub fn put(&mut self, key: Vec<u8>, value: Vec<u8>) {
        self.entries.insert(key, value);
    }

    pub fn contains(&self, key: &[u8]) -> bool {
        self.entries.contains_key(key)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&[u8], &[u8])> {
        self.entries.iter().map(|(k, v)| (k.as_slice(), v.as_slice()))
    }

    pub fn entries(&self) -> Vec<(Vec<u8>, Vec<u8>)> {
        self.entries.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    }

    pub fn app_hash(&self, hasher: &dyn DomainHasher) -> Hash32 {
        state_root(hasher, &self.entries())
    }

    pub fn namespaced(prefix: &[u8], key: &[u8]) -> Vec<u8> {
        let mut out = prefix.to_vec();
        out.extend_from_slice(key);
        out
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ChainView {
    pub store: ObjectStore,
    pub seen_tx_ids: BTreeSet<Hash32>,
}

impl ChainView {
    pub fn next_nonce(&self, public_key: &[u8]) -> u64 {
        let key = ObjectStore::namespaced(NS_NONCE, public_key);
        self.store
            .get(&key)
            .and_then(|bytes| <[u8; 8]>::try_from(bytes).ok())
            .map(u64::from_be_bytes)
            .map(|seen| seen + 1)
            .unwrap_or(0)
    }

    pub fn record_nonce(&mut self, public_key: &[u8], nonce: u64) -> Result<(), RejectReason> {
        let expected = self.next_nonce(public_key);
        if nonce != expected {
            return Err(RejectReason::Replay);
        }
        let key = ObjectStore::namespaced(NS_NONCE, public_key);
        self.store.put(key, nonce.to_be_bytes().to_vec());
        Ok(())
    }

    pub fn record_idempotency(&mut self, key: &str) -> Result<(), RejectReason> {
        if key.is_empty() {
            return Ok(());
        }
        let store_key = ObjectStore::namespaced(NS_IDEM, key.as_bytes());
        if self.store.contains(&store_key) {
            return Err(RejectReason::Replay);
        }
        self.store.put(store_key, vec![1]);
        Ok(())
    }

    pub fn record_tx_id(&mut self, tx_id: Hash32) -> Result<(), RejectReason> {
        if !self.seen_tx_ids.insert(tx_id) {
            return Err(RejectReason::DuplicateTransaction);
        }
        let key = ObjectStore::namespaced(NS_TX, &tx_id);
        self.store.put(key, vec![1]);
        Ok(())
    }
}
