//! Deterministic versioned cryptographic envelopes.
//!
//! Network and persisted cryptographic data use explicit tags and wire IDs.
//! Never rely on Rust enum ordinals or implicit serde representations.

use sunrey_protocol::{decode_bytes, decode_string, encode_bytes, encode_string, CodecError};

use crate::algorithm_ids::{AlgorithmWireId, KeyId};
use crate::signature_version::SignatureVersion;
use crate::CryptoError;

fn encode_u8(out: &mut Vec<u8>, value: u8) {
    out.push(value);
}

fn encode_u16(out: &mut Vec<u8>, value: u16) {
    out.extend_from_slice(&value.to_be_bytes());
}

fn decode_u8(input: &mut &[u8]) -> Result<u8, CodecError> {
    if input.is_empty() {
        return Err(CodecError::UnexpectedEof);
    }
    let value = input[0];
    *input = &input[1..];
    Ok(value)
}

fn decode_u16(input: &mut &[u8]) -> Result<u16, CodecError> {
    if input.len() < 2 {
        return Err(CodecError::UnexpectedEof);
    }
    let (head, rest) = input.split_at(2);
    *input = rest;
    Ok(u16::from_be_bytes(head.try_into().expect("2 bytes")))
}

const PUBLIC_KEY_ENVELOPE_TAG: &str = "PublicKeyEnvelopeV1";
const SIGNATURE_ENVELOPE_TAG: &str = "SignatureEnvelopeV1";
const HYBRID_SIGNATURE_ENVELOPE_TAG: &str = "HybridSignatureEnvelopeV1";

/// Hybrid combiner policy. Only `ClassicalAndPq` is defined today.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum HybridCombiner {
    ClassicalAndPq = 1,
}

impl HybridCombiner {
    pub fn from_u8(value: u8) -> Result<Self, CryptoError> {
        match value {
            1 => Ok(Self::ClassicalAndPq),
            _ => Err(CryptoError::InvalidDescriptor),
        }
    }

    pub fn to_u8(self) -> u8 {
        self as u8
    }
}

/// Hybrid verification policy. `RequireAll` is AND, not OR.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum HybridVerificationPolicy {
    RequireAll = 1,
    RequireClassical = 2,
    RequirePq = 3,
    VerifyLegacyOnly = 4,
}

impl HybridVerificationPolicy {
    pub fn from_u8(value: u8) -> Result<Self, CryptoError> {
        match value {
            1 => Ok(Self::RequireAll),
            2 => Ok(Self::RequireClassical),
            3 => Ok(Self::RequirePq),
            4 => Ok(Self::VerifyLegacyOnly),
            _ => Err(CryptoError::InvalidDescriptor),
        }
    }

    pub fn to_u8(self) -> u8 {
        self as u8
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicKeyEnvelope {
    pub algorithm: AlgorithmWireId,
    pub signature_version: SignatureVersion,
    pub key_id: KeyId,
    pub public_key: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignatureEnvelope {
    pub algorithm: AlgorithmWireId,
    pub signature_version: SignatureVersion,
    pub suite_id: String,
    pub key_id: KeyId,
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HybridSignatureEnvelope {
    pub combiner: HybridCombiner,
    pub verification_policy: HybridVerificationPolicy,
    pub classical: SignatureEnvelope,
    pub post_quantum: SignatureEnvelope,
}

fn map_codec(error: CodecError) -> CryptoError {
    match error {
        CodecError::LengthOverflow => CryptoError::InvalidDescriptor,
        _ => CryptoError::InvalidDescriptor,
    }
}

impl PublicKeyEnvelope {
    pub fn serialize_versioned(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, PUBLIC_KEY_ENVELOPE_TAG);
        encode_u16(&mut out, self.algorithm.to_u16());
        encode_u8(&mut out, self.signature_version.to_u8());
        encode_string(&mut out, self.key_id.as_str());
        encode_bytes(&mut out, &self.public_key);
        out
    }

    pub fn deserialize_versioned(bytes: &[u8]) -> Result<Self, CryptoError> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(map_codec)?;
        if tag != PUBLIC_KEY_ENVELOPE_TAG {
            return Err(CryptoError::InvalidDescriptor);
        }
        let algorithm = AlgorithmWireId::from_u16(decode_u16(&mut input).map_err(map_codec)?)?;
        let signature_version =
            SignatureVersion::from_u8(decode_u8(&mut input).map_err(map_codec)?)?;
        let key_id = KeyId::new(decode_string(&mut input).map_err(map_codec)?)?;
        let public_key = decode_bytes(&mut input).map_err(map_codec)?;
        if !input.is_empty() {
            return Err(CryptoError::InvalidDescriptor);
        }
        Ok(Self { algorithm, signature_version, key_id, public_key })
    }
}

impl SignatureEnvelope {
    pub fn serialize_versioned(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, SIGNATURE_ENVELOPE_TAG);
        encode_u16(&mut out, self.algorithm.to_u16());
        encode_u8(&mut out, self.signature_version.to_u8());
        encode_string(&mut out, &self.suite_id);
        encode_string(&mut out, self.key_id.as_str());
        encode_bytes(&mut out, &self.signature);
        out
    }

    pub fn deserialize_versioned(bytes: &[u8]) -> Result<Self, CryptoError> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(map_codec)?;
        if tag != SIGNATURE_ENVELOPE_TAG {
            return Err(CryptoError::InvalidDescriptor);
        }
        let algorithm = AlgorithmWireId::from_u16(decode_u16(&mut input).map_err(map_codec)?)?;
        let signature_version =
            SignatureVersion::from_u8(decode_u8(&mut input).map_err(map_codec)?)?;
        let suite_id = decode_string(&mut input).map_err(map_codec)?;
        let key_id = KeyId::new(decode_string(&mut input).map_err(map_codec)?)?;
        let signature = decode_bytes(&mut input).map_err(map_codec)?;
        if !input.is_empty() {
            return Err(CryptoError::InvalidDescriptor);
        }
        Ok(Self { algorithm, signature_version, suite_id, key_id, signature })
    }
}

impl HybridSignatureEnvelope {
    pub fn serialize_versioned(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, HYBRID_SIGNATURE_ENVELOPE_TAG);
        encode_u8(&mut out, self.combiner.to_u8());
        encode_u8(&mut out, self.verification_policy.to_u8());
        encode_bytes(&mut out, &self.classical.serialize_versioned());
        encode_bytes(&mut out, &self.post_quantum.serialize_versioned());
        out
    }

    pub fn deserialize_versioned(bytes: &[u8]) -> Result<Self, CryptoError> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(map_codec)?;
        if tag != HYBRID_SIGNATURE_ENVELOPE_TAG {
            return Err(CryptoError::InvalidDescriptor);
        }
        let combiner = HybridCombiner::from_u8(decode_u8(&mut input).map_err(map_codec)?)?;
        let verification_policy =
            HybridVerificationPolicy::from_u8(decode_u8(&mut input).map_err(map_codec)?)?;
        let classical_bytes = decode_bytes(&mut input).map_err(map_codec)?;
        let post_quantum_bytes = decode_bytes(&mut input).map_err(map_codec)?;
        if !input.is_empty() {
            return Err(CryptoError::InvalidDescriptor);
        }
        Ok(Self {
            combiner,
            verification_policy,
            classical: SignatureEnvelope::deserialize_versioned(&classical_bytes)?,
            post_quantum: SignatureEnvelope::deserialize_versioned(&post_quantum_bytes)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::DEV_SUITE_ID;

    fn sample_public_key_envelope() -> PublicKeyEnvelope {
        PublicKeyEnvelope {
            algorithm: AlgorithmWireId::Ed25519,
            signature_version: SignatureVersion::ClassicalV1,
            key_id: KeyId::new("dev_fixture_key_v1").unwrap(),
            public_key: vec![0x42; 32],
        }
    }

    fn sample_signature_envelope() -> SignatureEnvelope {
        SignatureEnvelope {
            algorithm: AlgorithmWireId::Ed25519,
            signature_version: SignatureVersion::ClassicalV1,
            suite_id: DEV_SUITE_ID.to_string(),
            key_id: KeyId::new("dev_fixture_key_v1").unwrap(),
            signature: vec![0x55; 64],
        }
    }

    #[test]
    fn public_key_envelope_round_trip_is_deterministic() {
        let envelope = sample_public_key_envelope();
        let encoded = envelope.serialize_versioned();
        let decoded = PublicKeyEnvelope::deserialize_versioned(&encoded).unwrap();
        assert_eq!(decoded, envelope);
        let encoded_again = decoded.serialize_versioned();
        assert_eq!(encoded, encoded_again);
    }

    #[test]
    fn signature_envelope_round_trip_is_deterministic() {
        let envelope = sample_signature_envelope();
        let encoded = envelope.serialize_versioned();
        let decoded = SignatureEnvelope::deserialize_versioned(&encoded).unwrap();
        assert_eq!(decoded, envelope);
        assert_eq!(encoded, decoded.serialize_versioned());
    }

    #[test]
    fn hybrid_envelope_round_trip_is_deterministic() {
        let envelope = HybridSignatureEnvelope {
            combiner: HybridCombiner::ClassicalAndPq,
            verification_policy: HybridVerificationPolicy::RequireAll,
            classical: sample_signature_envelope(),
            post_quantum: SignatureEnvelope {
                algorithm: AlgorithmWireId::MlDsa65V1,
                signature_version: SignatureVersion::PqNativeV1,
                suite_id: "sunrey-mldsa-65-v1".to_string(),
                key_id: KeyId::new("pq_key_v1").unwrap(),
                signature: vec![0x01; 100],
            },
        };
        let encoded = envelope.serialize_versioned();
        let decoded = HybridSignatureEnvelope::deserialize_versioned(&encoded).unwrap();
        assert_eq!(decoded, envelope);
        assert_eq!(encoded, decoded.serialize_versioned());
    }

    #[test]
    fn unknown_algorithm_in_envelope_fails_closed() {
        let mut bad = sample_public_key_envelope().serialize_versioned();
        // algorithm wire id is at a fixed offset after tag length fields; corrupt u16.
        bad[30] = 0xff;
        bad[31] = 0xff;
        assert!(PublicKeyEnvelope::deserialize_versioned(&bad).is_err());
    }

    #[test]
    fn malformed_envelope_rejects_trailing_bytes() {
        let mut encoded = sample_signature_envelope().serialize_versioned();
        encoded.push(0x00);
        assert!(SignatureEnvelope::deserialize_versioned(&encoded).is_err());
    }

    #[test]
    fn wrong_tag_rejects() {
        let mut encoded = sample_public_key_envelope().serialize_versioned();
        encoded[10] ^= 0xff;
        assert!(PublicKeyEnvelope::deserialize_versioned(&encoded).is_err());
    }
}
