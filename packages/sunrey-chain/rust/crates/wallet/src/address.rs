//! Versioned SunRey Blockchain address format.
//!
//! Canonical binary is 42 bytes. Text is HRP + '1' + RFC 4648 base32.
//! Network class, algorithm, and a SHA-256 descriptor payload are bound
//! into the address. Cross-network reuse is rejected.

use sha2::{Digest, Sha256};

pub const ADDRESS_VERSION: u8 = 1;
pub const ADDRESS_MAX_BINARY: usize = 42;
pub const ADDRESS_MAX_TEXT: usize = 90;
const MAGIC: &[u8; 2] = b"SR";
const PAYLOAD_DOMAIN: &[u8] = b"SUNREY-ADDR-PAYLOAD-V1";
const CHECKSUM_DOMAIN: &[u8] = b"SUNREY-ADDR-V1";
const BASE32: &[u8] = b"abcdefghijklmnopqrstuvwxyz234567";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NetworkClass {
    Development = 1,
    ReservedTest = 2,
    ReservedProduction = 3,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AddressClass {
    SingleKey = 1,
    Policy = 2,
    MultiAuth = 3,
    Machine = 4,
    Institutional = 5,
    WatchOnly = 6,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AddressAlgorithm {
    Ed25519V1 = 1,
    HybridSimV1 = 2,
    PqSimV1 = 3,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockchainAddress {
    pub text: String,
    pub binary: Vec<u8>,
    pub network_id: String,
    pub network_class: NetworkClass,
    pub address_class: AddressClass,
    pub algorithm: AddressAlgorithm,
    pub payload: [u8; 32],
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum AddressError {
    #[error("wrong-network address")]
    WrongNetwork,
    #[error("address checksum failed")]
    ChecksumFailure,
    #[error("malformed address")]
    Malformed,
    #[error("unknown address version")]
    UnknownVersion,
    #[error("unknown address class")]
    UnknownClass,
    #[error("unknown address algorithm")]
    UnknownAlgorithm,
}

impl NetworkClass {
    pub fn from_network_id(network_id: &str) -> Option<Self> {
        if matches!(network_id, "net_sunrey_simulation" | "net_sunrey_local_dev") {
            return Some(Self::Development);
        }
        if network_id == "net_sunrey_reserved_test" || network_id.starts_with("net_sunrey_testnet_")
        {
            return Some(Self::ReservedTest);
        }
        if network_id == "net_sunrey_reserved_production" {
            return Some(Self::ReservedProduction);
        }
        None
    }

    pub fn hrp(self) -> &'static str {
        match self {
            Self::Development => "srdev",
            Self::ReservedTest => "srtst",
            Self::ReservedProduction => "srprd",
        }
    }

    pub fn from_hrp(hrp: &str) -> Option<Self> {
        match hrp {
            "srdev" => Some(Self::Development),
            "srtst" => Some(Self::ReservedTest),
            "srprd" => Some(Self::ReservedProduction),
            _ => None,
        }
    }

    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            1 => Some(Self::Development),
            2 => Some(Self::ReservedTest),
            3 => Some(Self::ReservedProduction),
            _ => None,
        }
    }
}

impl AddressClass {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            1 => Some(Self::SingleKey),
            2 => Some(Self::Policy),
            3 => Some(Self::MultiAuth),
            4 => Some(Self::Machine),
            5 => Some(Self::Institutional),
            6 => Some(Self::WatchOnly),
            _ => None,
        }
    }
}

impl AddressAlgorithm {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            1 => Some(Self::Ed25519V1),
            2 => Some(Self::HybridSimV1),
            3 => Some(Self::PqSimV1),
            _ => None,
        }
    }
}

fn sha256(parts: &[&[u8]]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part);
    }
    hasher.finalize().into()
}

pub fn descriptor_payload(
    network_id: &str,
    class: AddressClass,
    algorithm: AddressAlgorithm,
    descriptor: &[u8],
) -> [u8; 32] {
    sha256(&[PAYLOAD_DOMAIN, network_id.as_bytes(), &[class as u8], &[algorithm as u8], descriptor])
}

fn encode_base32(bytes: &[u8]) -> String {
    let mut bits = 0u32;
    let mut value = 0u32;
    let mut out = String::new();
    for byte in bytes {
        value = (value << 8) | u32::from(*byte);
        bits += 8;
        while bits >= 5 {
            let idx = ((value >> (bits - 5)) & 31) as usize;
            out.push(BASE32[idx] as char);
            bits -= 5;
        }
    }
    if bits > 0 {
        let idx = ((value << (5 - bits)) & 31) as usize;
        out.push(BASE32[idx] as char);
    }
    out
}

fn decode_base32(text: &str) -> Option<Vec<u8>> {
    let mut bits = 0u32;
    let mut value = 0u32;
    let mut out = Vec::new();
    for ch in text.bytes() {
        let idx = BASE32.iter().position(|item| *item == ch)?;
        value = (value << 5) | idx as u32;
        bits += 5;
        if bits >= 8 {
            out.push(((value >> (bits - 8)) & 255) as u8);
            bits -= 8;
        }
    }
    Some(out)
}

fn checksum(prefix: &[u8]) -> [u8; 4] {
    let digest = sha256(&[CHECKSUM_DOMAIN, prefix]);
    [digest[0], digest[1], digest[2], digest[3]]
}

pub fn encode_address(
    network_id: &str,
    class: AddressClass,
    algorithm: AddressAlgorithm,
    descriptor: &[u8],
) -> Result<BlockchainAddress, AddressError> {
    let network_class =
        NetworkClass::from_network_id(network_id).ok_or(AddressError::WrongNetwork)?;
    let payload = descriptor_payload(network_id, class, algorithm, descriptor);
    let mut prefix = [0u8; 38];
    prefix[0..2].copy_from_slice(MAGIC);
    prefix[2] = ADDRESS_VERSION;
    prefix[3] = network_class as u8;
    prefix[4] = class as u8;
    prefix[5] = algorithm as u8;
    prefix[6..38].copy_from_slice(&payload);
    let sum = checksum(&prefix);
    let mut binary = prefix.to_vec();
    binary.extend_from_slice(&sum);
    if binary.len() != ADDRESS_MAX_BINARY {
        return Err(AddressError::Malformed);
    }
    let mut body = vec![ADDRESS_VERSION, class as u8, algorithm as u8];
    body.extend_from_slice(&payload);
    body.extend_from_slice(&sum);
    let text = format!("{}1{}", network_class.hrp(), encode_base32(&body));
    if text.len() > ADDRESS_MAX_TEXT {
        return Err(AddressError::Malformed);
    }
    Ok(BlockchainAddress {
        text,
        binary,
        network_id: network_id.to_string(),
        network_class,
        address_class: class,
        algorithm,
        payload,
    })
}

pub fn parse_address(
    text: &str,
    expected_network_id: Option<&str>,
) -> Result<BlockchainAddress, AddressError> {
    if text.len() > ADDRESS_MAX_TEXT {
        return Err(AddressError::Malformed);
    }
    let sep = text.find('1').ok_or(AddressError::Malformed)?;
    let hrp = &text[..sep];
    let body = &text[sep + 1..];
    let network_class = NetworkClass::from_hrp(hrp).ok_or(AddressError::WrongNetwork)?;
    let decoded = decode_base32(body).ok_or(AddressError::Malformed)?;
    if decoded.len() < 39 {
        return Err(AddressError::Malformed);
    }
    if decoded[0] != ADDRESS_VERSION {
        return Err(AddressError::UnknownVersion);
    }
    let class = AddressClass::from_u8(decoded[1]).ok_or(AddressError::UnknownClass)?;
    let algorithm = AddressAlgorithm::from_u8(decoded[2]).ok_or(AddressError::UnknownAlgorithm)?;
    let mut payload = [0u8; 32];
    payload.copy_from_slice(&decoded[3..35]);
    let given = &decoded[35..39];
    let mut prefix = [0u8; 38];
    prefix[0..2].copy_from_slice(MAGIC);
    prefix[2] = ADDRESS_VERSION;
    prefix[3] = network_class as u8;
    prefix[4] = class as u8;
    prefix[5] = algorithm as u8;
    prefix[6..38].copy_from_slice(&payload);
    if given != checksum(&prefix) {
        return Err(AddressError::ChecksumFailure);
    }
    if let Some(expected) = expected_network_id {
        let expected_class =
            NetworkClass::from_network_id(expected).ok_or(AddressError::WrongNetwork)?;
        if expected_class != network_class {
            return Err(AddressError::WrongNetwork);
        }
    }
    let mut binary = prefix.to_vec();
    binary.extend_from_slice(given);
    Ok(BlockchainAddress {
        text: text.to_string(),
        binary,
        network_id: expected_network_id.unwrap_or("net_sunrey_simulation").to_string(),
        network_class,
        address_class: class,
        algorithm,
        payload,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_and_checksum() {
        let addr = encode_address(
            "net_sunrey_simulation",
            AddressClass::SingleKey,
            AddressAlgorithm::Ed25519V1,
            b"alice-public",
        )
        .unwrap();
        assert!(addr.text.starts_with("srdev1"));
        let parsed = parse_address(&addr.text, Some("net_sunrey_simulation")).unwrap();
        assert_eq!(parsed.payload, addr.payload);
        let mut broken = addr.text.clone();
        broken.replace_range(broken.len() - 1.., if broken.ends_with('a') { "b" } else { "a" });
        assert_eq!(
            parse_address(&broken, Some("net_sunrey_simulation")),
            Err(AddressError::ChecksumFailure)
        );
    }

    #[test]
    fn testnet_hrp_is_srtst() {
        let addr = encode_address(
            "net_sunrey_testnet_1",
            AddressClass::SingleKey,
            AddressAlgorithm::Ed25519V1,
            b"alice-public",
        )
        .unwrap();
        assert!(addr.text.starts_with("srtst1"));
        let parsed = parse_address(&addr.text, Some("net_sunrey_testnet_1")).unwrap();
        assert_eq!(parsed.network_class, NetworkClass::ReservedTest);
    }

    #[test]
    fn wrong_network_rejected() {
        let addr = encode_address(
            "net_sunrey_reserved_production",
            AddressClass::SingleKey,
            AddressAlgorithm::Ed25519V1,
            b"alice-public",
        )
        .unwrap();
        assert_eq!(
            parse_address(&addr.text, Some("net_sunrey_simulation")),
            Err(AddressError::WrongNetwork)
        );
    }
}
