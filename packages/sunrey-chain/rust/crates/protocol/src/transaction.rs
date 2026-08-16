use serde::{Deserialize, Serialize};

use crate::codec::{
    decode_bytes, decode_string, decode_u32, decode_u64, encode_bytes, encode_string, encode_u32,
    encode_u64, CodecError,
};
use crate::RejectReason;

pub const MAX_TX_BYTES: u32 = 65_536;
const ENVELOPE_TAG: &str = "EnvelopeV1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TransactionFamily {
    System,
    EvidenceAnchor,
    NativeAsset,
    Identity,
    Oracle,
}

impl TransactionFamily {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::System => "SYSTEM",
            Self::EvidenceAnchor => "EVIDENCE_ANCHOR",
            Self::NativeAsset => "NATIVE_ASSET",
            Self::Identity => "IDENTITY",
            Self::Oracle => "ORACLE",
        }
    }

    pub fn parse(value: &str) -> Result<Self, RejectReason> {
        match value {
            "SYSTEM" => Ok(Self::System),
            "EVIDENCE_ANCHOR" => Ok(Self::EvidenceAnchor),
            "NATIVE_ASSET" => Ok(Self::NativeAsset),
            "IDENTITY" => Ok(Self::Identity),
            "ORACLE" => Ok(Self::Oracle),
            _ => Err(RejectReason::SchemaInvalid),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UnsignedTransaction {
    pub network_id: String,
    pub chain_id: String,
    pub codec_id: String,
    pub schema_version: u32,
    pub family: TransactionFamily,
    pub nonce: u64,
    pub idempotency_key: String,
    pub payload: Vec<u8>,
}

impl UnsignedTransaction {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, ENVELOPE_TAG);
        encode_string(&mut out, &self.network_id);
        encode_string(&mut out, &self.chain_id);
        encode_string(&mut out, &self.codec_id);
        encode_u32(&mut out, self.schema_version);
        encode_string(&mut out, self.family.as_str());
        encode_u64(&mut out, self.nonce);
        encode_string(&mut out, &self.idempotency_key);
        encode_bytes(&mut out, &self.payload);
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, RejectReason> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        if tag != ENVELOPE_TAG {
            return Err(RejectReason::UnsupportedVersion);
        }
        let network_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let chain_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let codec_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let schema_version = decode_u32(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let family = TransactionFamily::parse(
            &decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?,
        )?;
        let nonce = decode_u64(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let idempotency_key = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let payload = decode_bytes(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        if !input.is_empty() {
            return Err(RejectReason::SchemaInvalid);
        }
        Ok(Self {
            network_id,
            chain_id,
            codec_id,
            schema_version,
            family,
            nonce,
            idempotency_key,
            payload,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignatureDescriptor {
    pub suite_id: String,
    pub algorithm_id: String,
    pub key_id: String,
    pub public_key: Vec<u8>,
    pub signature: Vec<u8>,
}

impl SignatureDescriptor {
    pub fn encode(&self, out: &mut Vec<u8>) {
        encode_string(out, &self.suite_id);
        encode_string(out, &self.algorithm_id);
        encode_string(out, &self.key_id);
        encode_bytes(out, &self.public_key);
        encode_bytes(out, &self.signature);
    }

    pub fn decode(input: &mut &[u8]) -> Result<Self, CodecError> {
        Ok(Self {
            suite_id: decode_string(input)?,
            algorithm_id: decode_string(input)?,
            key_id: decode_string(input)?,
            public_key: decode_bytes(input)?,
            signature: decode_bytes(input)?,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignedTransaction {
    pub unsigned: UnsignedTransaction,
    pub auth: Vec<SignatureDescriptor>,
}

impl SignedTransaction {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = self.unsigned.encode();
        encode_u32(&mut out, self.auth.len() as u32);
        for descriptor in &self.auth {
            descriptor.encode(&mut out);
        }
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, RejectReason> {
        let unsigned = UnsignedTransaction::decode_prefix(bytes)?;
        let unsigned_len = unsigned.encode().len();
        if bytes.len() < unsigned_len {
            return Err(RejectReason::DecodeFailed);
        }
        let mut rest = &bytes[unsigned_len..];
        let count = decode_u32(&mut rest).map_err(|_| RejectReason::DecodeFailed)? as usize;
        if count == 0 {
            return Err(RejectReason::InvalidSignatureDescriptor);
        }
        let mut auth = Vec::with_capacity(count);
        for _ in 0..count {
            auth.push(
                SignatureDescriptor::decode(&mut rest).map_err(|_| RejectReason::DecodeFailed)?,
            );
        }
        if !rest.is_empty() {
            return Err(RejectReason::SchemaInvalid);
        }
        Ok(Self { unsigned, auth })
    }
}

impl UnsignedTransaction {
    fn decode_prefix(bytes: &[u8]) -> Result<Self, RejectReason> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        if tag != ENVELOPE_TAG {
            return Err(RejectReason::UnsupportedVersion);
        }
        let network_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let chain_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let codec_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let schema_version = decode_u32(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let family = TransactionFamily::parse(
            &decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?,
        )?;
        let nonce = decode_u64(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let idempotency_key = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        let payload = decode_bytes(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
        Ok(Self {
            network_id,
            chain_id,
            codec_id,
            schema_version,
            family,
            nonce,
            idempotency_key,
            payload,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SystemPayload {
    pub op: String,
    pub object_key: String,
    pub object_value: Vec<u8>,
}

pub fn encode_system_payload(payload: &SystemPayload) -> Vec<u8> {
    let mut out = Vec::new();
    encode_string(&mut out, &payload.op);
    encode_string(&mut out, &payload.object_key);
    encode_bytes(&mut out, &payload.object_value);
    out
}

pub fn decode_system_payload(bytes: &[u8]) -> Result<SystemPayload, RejectReason> {
    let mut input = bytes;
    let op = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
    let object_key = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
    let object_value = decode_bytes(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
    if !input.is_empty() {
        return Err(RejectReason::SchemaInvalid);
    }
    Ok(SystemPayload { op, object_key, object_value })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvidenceAnchorPayload {
    pub vault_record_hash: String,
    pub schema_id: String,
    pub purpose: String,
}

pub fn encode_evidence_anchor_payload(payload: &EvidenceAnchorPayload) -> Vec<u8> {
    let mut out = Vec::new();
    encode_string(&mut out, &payload.vault_record_hash);
    encode_string(&mut out, &payload.schema_id);
    encode_string(&mut out, &payload.purpose);
    out
}

pub fn decode_evidence_anchor_payload(bytes: &[u8]) -> Result<EvidenceAnchorPayload, RejectReason> {
    let mut input = bytes;
    let vault_record_hash = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
    let schema_id = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
    let purpose = decode_string(&mut input).map_err(|_| RejectReason::DecodeFailed)?;
    if !input.is_empty() {
        return Err(RejectReason::SchemaInvalid);
    }
    Ok(EvidenceAnchorPayload { vault_record_hash, schema_id, purpose })
}
