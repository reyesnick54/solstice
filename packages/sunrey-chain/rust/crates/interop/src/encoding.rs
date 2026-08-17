use sha2::{Digest, Sha256};
use sunrey_protocol::{
    decode_bytes, decode_string, decode_u64, domain_payload, encode_bytes, encode_string,
    encode_u64, Hash32,
};

use crate::error::InteropError;

pub fn domain_hash(domain: &str, payload: &[u8]) -> Hash32 {
    let framed = domain_payload(domain, payload);
    Sha256::digest(&framed).into()
}

pub fn hex_hash(hash: &Hash32) -> String {
    hex::encode(hash)
}

pub fn require_size(bytes: &[u8], max: usize) -> Result<(), InteropError> {
    if bytes.len() > max {
        Err(InteropError::SizeExceeded)
    } else {
        Ok(())
    }
}

pub fn encode_kv(out: &mut Vec<u8>, key: &str, value: &[u8]) {
    encode_string(out, key);
    encode_bytes(out, value);
}

pub fn decode_kv(input: &mut &[u8]) -> Result<(String, Vec<u8>), InteropError> {
    let key = decode_string(input).map_err(|_| InteropError::SchemaInvalid)?;
    let value = decode_bytes(input).map_err(|_| InteropError::SchemaInvalid)?;
    Ok((key, value))
}

pub fn encode_u64_field(out: &mut Vec<u8>, name: &str, value: u64) {
    encode_string(out, name);
    encode_u64(out, value);
}

pub fn decode_u64_field(input: &mut &[u8], expected: &str) -> Result<u64, InteropError> {
    let name = decode_string(input).map_err(|_| InteropError::SchemaInvalid)?;
    if name != expected {
        return Err(InteropError::SchemaInvalid);
    }
    decode_u64(input).map_err(|_| InteropError::SchemaInvalid)
}

/// Sorted Merkle tree over key/value pairs. Leaves are domain-separated.
pub fn merkle_root(entries: &[(String, Vec<u8>)]) -> Hash32 {
    if entries.is_empty() {
        return domain_hash(crate::DOMAIN_MERKLE, b"empty");
    }
    let mut level: Vec<Hash32> = entries
        .iter()
        .map(|(k, v)| {
            let mut payload = Vec::new();
            encode_kv(&mut payload, k, v);
            domain_hash(crate::DOMAIN_LEAF, &payload)
        })
        .collect();
    while level.len() > 1 {
        let mut next = Vec::with_capacity(level.len().div_ceil(2));
        for pair in level.chunks(2) {
            if pair.len() == 1 {
                next.push(pair[0]);
            } else {
                let mut payload = Vec::new();
                encode_bytes(&mut payload, &pair[0]);
                encode_bytes(&mut payload, &pair[1]);
                next.push(domain_hash(crate::DOMAIN_MERKLE, &payload));
            }
        }
        level = next;
    }
    level[0]
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MembershipProof {
    pub key: String,
    pub value: Vec<u8>,
    pub index: u32,
    pub siblings: Vec<Hash32>,
    pub leaf_count: u32,
}

impl MembershipProof {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, &self.key);
        encode_bytes(&mut out, &self.value);
        encode_u64(&mut out, u64::from(self.index));
        encode_u64(&mut out, u64::from(self.leaf_count));
        encode_u64(&mut out, self.siblings.len() as u64);
        for sibling in &self.siblings {
            encode_bytes(&mut out, sibling);
        }
        out
    }
}

pub fn build_membership_proof(
    entries: &[(String, Vec<u8>)],
    key: &str,
) -> Result<MembershipProof, InteropError> {
    let index =
        entries.iter().position(|(k, _)| k == key).ok_or(InteropError::InvalidMembershipProof)?;
    let value = entries[index].1.clone();
    let siblings = collect_siblings(entries, index);
    Ok(MembershipProof {
        key: key.to_string(),
        value,
        index: index as u32,
        siblings,
        leaf_count: entries.len() as u32,
    })
}

pub fn verify_membership_proof(root: &Hash32, proof: &MembershipProof) -> Result<(), InteropError> {
    if proof.leaf_count == 0 {
        return Err(InteropError::InvalidMembershipProof);
    }
    let mut payload = Vec::new();
    encode_kv(&mut payload, &proof.key, &proof.value);
    let mut hash = domain_hash(crate::DOMAIN_LEAF, &payload);
    let mut index = proof.index as usize;
    let mut width = proof.leaf_count as usize;
    let mut sib = 0usize;
    while width > 1 {
        let sibling = *proof.siblings.get(sib).ok_or(InteropError::InvalidMembershipProof)?;
        sib += 1;
        let mut combined = Vec::new();
        if index % 2 == 0 {
            if index + 1 >= width {
                // odd promotion: no sibling consumed in builder either
                sib -= 1;
            } else {
                encode_bytes(&mut combined, &hash);
                encode_bytes(&mut combined, &sibling);
                hash = domain_hash(crate::DOMAIN_MERKLE, &combined);
            }
        } else {
            encode_bytes(&mut combined, &sibling);
            encode_bytes(&mut combined, &hash);
            hash = domain_hash(crate::DOMAIN_MERKLE, &combined);
        }
        index /= 2;
        width = width.div_ceil(2);
    }
    if &hash == root {
        Ok(())
    } else {
        Err(InteropError::InvalidMembershipProof)
    }
}

pub fn build_non_membership_proof(
    entries: &[(String, Vec<u8>)],
    key: &str,
) -> Result<(Option<MembershipProof>, Option<MembershipProof>), InteropError> {
    if entries.iter().any(|(k, _)| k == key) {
        return Err(InteropError::InvalidNonMembershipProof);
    }
    let mut left = None;
    let mut right = None;
    for (i, (k, _)) in entries.iter().enumerate() {
        if k.as_str() < key {
            left = Some(i);
        } else if k.as_str() > key && right.is_none() {
            right = Some(i);
        }
    }
    Ok((
        left.map(|i| build_membership_proof(entries, &entries[i].0)).transpose()?,
        right.map(|i| build_membership_proof(entries, &entries[i].0)).transpose()?,
    ))
}

fn collect_siblings(entries: &[(String, Vec<u8>)], mut index: usize) -> Vec<Hash32> {
    let mut level: Vec<Hash32> = entries
        .iter()
        .map(|(k, v)| {
            let mut payload = Vec::new();
            encode_kv(&mut payload, k, v);
            domain_hash(crate::DOMAIN_LEAF, &payload)
        })
        .collect();
    let mut siblings = Vec::new();
    while level.len() > 1 {
        if index % 2 == 1 {
            siblings.push(level[index - 1]);
        } else if index + 1 < level.len() {
            siblings.push(level[index + 1]);
        }
        let mut next = Vec::with_capacity(level.len().div_ceil(2));
        for pair in level.chunks(2) {
            if pair.len() == 1 {
                next.push(pair[0]);
            } else {
                let mut payload = Vec::new();
                encode_bytes(&mut payload, &pair[0]);
                encode_bytes(&mut payload, &pair[1]);
                next.push(domain_hash(crate::DOMAIN_MERKLE, &payload));
            }
        }
        index /= 2;
        level = next;
    }
    siblings
}
