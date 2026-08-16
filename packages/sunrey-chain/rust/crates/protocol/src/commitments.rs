use crate::block::BlockHeader;
use crate::codec::{encode_bytes, encode_string};
use crate::genesis::GenesisV1;
use crate::transaction::UnsignedTransaction;
use crate::{
    DOMAIN_BLOCK_ID, DOMAIN_GENESIS, DOMAIN_LEAF, DOMAIN_MERKLE, DOMAIN_SIG, DOMAIN_STATE_ROOT,
    DOMAIN_TX_ID, DOMAIN_TX_ROOT,
};

pub const HASH_SIZE: usize = 32;
pub type Hash32 = [u8; HASH_SIZE];

/// Hash provider port. Business modules must not hard-code an algorithm.
pub trait DomainHasher {
    fn hash(&self, domain: &str, payload: &[u8]) -> Hash32;
}

pub fn domain_payload(domain: &str, payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    encode_string(&mut out, domain);
    out.extend_from_slice(payload);
    out
}

pub fn transaction_id(hasher: &dyn DomainHasher, unsigned: &UnsignedTransaction) -> Hash32 {
    hasher.hash(DOMAIN_TX_ID, &unsigned.encode())
}

pub fn unsigned_signature_payload(
    hasher: &dyn DomainHasher,
    unsigned: &UnsignedTransaction,
) -> Hash32 {
    hasher.hash(DOMAIN_SIG, &unsigned.encode())
}

pub fn genesis_hash(hasher: &dyn DomainHasher, genesis: &GenesisV1) -> Hash32 {
    hasher.hash(DOMAIN_GENESIS, &genesis.encode())
}

pub fn block_id(hasher: &dyn DomainHasher, header: &BlockHeader) -> Hash32 {
    hasher.hash(DOMAIN_BLOCK_ID, &header.encode())
}

pub fn merkle_root(hasher: &dyn DomainHasher, domain: &str, leaves: &[Hash32]) -> Hash32 {
    if leaves.is_empty() {
        return hasher.hash(domain, &[]);
    }
    let mut layer: Vec<Hash32> = leaves.to_vec();
    while layer.len() > 1 {
        if layer.len() % 2 == 1 {
            if let Some(last) = layer.last().copied() {
                layer.push(last);
            }
        }
        let mut next = Vec::with_capacity(layer.len() / 2);
        for pair in layer.chunks_exact(2) {
            let mut payload = Vec::with_capacity(HASH_SIZE * 2);
            payload.extend_from_slice(&pair[0]);
            payload.extend_from_slice(&pair[1]);
            next.push(hasher.hash(DOMAIN_MERKLE, &payload));
        }
        layer = next;
    }
    layer[0]
}

pub fn transaction_root(hasher: &dyn DomainHasher, tx_ids: &[Hash32]) -> Hash32 {
    merkle_root(hasher, DOMAIN_TX_ROOT, tx_ids)
}

pub fn state_root(hasher: &dyn DomainHasher, entries: &[(Vec<u8>, Vec<u8>)]) -> Hash32 {
    let mut leaves = Vec::with_capacity(entries.len());
    for (key, value) in entries {
        let mut payload = Vec::new();
        encode_bytes(&mut payload, key);
        encode_bytes(&mut payload, value);
        leaves.push(hasher.hash(DOMAIN_LEAF, &payload));
    }
    merkle_root(hasher, DOMAIN_STATE_ROOT, &leaves)
}
