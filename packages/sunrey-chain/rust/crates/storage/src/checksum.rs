//! Integrity wrappers for durable records. Corrupted consensus data is never
//! replaced with defaults.

use sha2::{Digest, Sha256};
use sunrey_protocol::RejectReason;

pub const CHECKSUM_LEN: usize = 32;

pub fn sha256_bytes(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(sha256_bytes(bytes))
}

/// Prefix `payload` with SHA-256(payload).
pub fn wrap_checksum(payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(CHECKSUM_LEN + payload.len());
    out.extend_from_slice(&sha256_bytes(payload));
    out.extend_from_slice(payload);
    out
}

/// Verify and strip a checksum prefix. Never invents a substitute payload.
pub fn unwrap_checksum(bytes: &[u8]) -> Result<Vec<u8>, RejectReason> {
    if bytes.len() < CHECKSUM_LEN {
        return Err(RejectReason::CorruptStore);
    }
    let (stored, payload) = bytes.split_at(CHECKSUM_LEN);
    if stored != sha256_bytes(payload) {
        return Err(RejectReason::CorruptStore);
    }
    Ok(payload.to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_mutated_payload() {
        let mut wrapped = wrap_checksum(b"block-bytes");
        wrapped[40] ^= 0x01;
        assert_eq!(unwrap_checksum(&wrapped), Err(RejectReason::CorruptStore));
    }

    #[test]
    fn rejects_truncated_record() {
        assert_eq!(unwrap_checksum(&[0u8; 8]), Err(RejectReason::CorruptStore));
    }
}
